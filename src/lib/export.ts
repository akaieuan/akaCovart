import { renderFormatTo, resolveMood } from "@/engine";
import type { Mood } from "@/engine";
import { renderParams, type StudioState } from "@/lib/store";
import { ensureCoverFont } from "@/lib/fonts";
import { getFormat, type Format } from "@/lib/formats";
import { audioSession, transport } from "@/audio";
import { createTrackMotion, stepTrackMotion } from "@/audio/trackMotion";
import { applyAuto } from "@/components/canvas/autoModulate";

// ── PNG export for a given format ────────────────────────────────────────────
// renderFormatTo handles the square render -> cover-crop -> frame-space type, so
// the exported file matches what the editor shows for that format exactly.
export function exportFormat(
  state: StudioState,
  f: Format,
  done: () => void,
): void {
  const go = () => {
    try {
      const dest = document.createElement("canvas");
      dest.width = f.w;
      dest.height = f.h;
      renderFormatTo(dest, renderParams(state));
      dest.toBlob((blob) => {
        if (!blob) {
          done();
          return;
        }
        const mood: Mood = resolveMood(
          state.seed >>> 0,
          state.mood as Mood | "random",
        );
        // Square keeps the legacy name; other formats append their id.
        const suffix = f.id === "square" ? "" : `_${f.id}`;
        triggerDownload(blob, `albumart_${mood}_${state.seed >>> 0}${suffix}.png`);
        done();
      }, "image/png");
    } catch (err) {
      console.error(err);
      done();
    }
  };
  // Make sure the chosen cover font is downloaded before rendering (canvas can't
  // paint a web font the browser hasn't fetched).
  ensureCoverFont(state.textFont).then(() => requestAnimationFrame(go));
}

// Still PNG export of the currently-active format (used by the sidebar button).
export function exportPng(state: StudioState, done: () => void): void {
  exportFormat(state, getFormat(state.format), done);
}

// ── Video export ─────────────────────────────────────────────────────────────
// PRIMARY: a DETERMINISTIC encode via WebCodecs into a real .mp4 (moov-at-front
// via the muxer's "in-memory" fastStart, so QuickTime / Finder Quick Look / the
// socials all open it). BPM source = a short, silent, seamless loop (an integer
// number of resolve-cycles, so first frame == last). Track source = the FULL
// analyzed clip window, motion-synced to the feature timeline, with the clip
// audio muxed in as AAC.
//
// FALLBACKS (no WebCodecs / H.264 / AAC): MediaRecorder over the live canvas —
// for a track, with the transport's audio tapped in, so the export ALWAYS has
// sound. WebM-first: Chromium's recorder mp4 is a fragmented file QuickTime
// rejects, while its WebM is valid everywhere it's offered.

const FPS = 30;

// Hard cap on the exported clip length (very long "full" tracks would take an
// unreasonable time + memory to encode). Logged when it engages.
const MAX_TRACK_SECONDS = 120;

// Truthful outcome of a video export, surfaced to the UI so the user is never
// left guessing (or handed a silent/wrong file without notice).
export interface ExportOutcome {
  ok: boolean;
  kind: "mp4" | "webm" | "none";
  seconds: number;
  hasAudio: boolean;
  error?: string;
}

export function exportVideo(
  canvas: HTMLCanvasElement,
  state: StudioState,
  done: (outcome: ExportOutcome) => void,
  onProgress?: (frac: number, label: string) => void,
): void {
  const tl = audioSession.timeline;

  // Hard guard: a Track export with no valid analyzed session must NOT silently
  // fall through to the silent BPM loop — report and bail so the UI can explain.
  if (state.animSource === "track" && (!tl || tl.duration <= 0 || !audioSession.buffer)) {
    done({
      ok: false,
      kind: "none",
      seconds: 0,
      hasAudio: false,
      error: "No analyzed track — import a track (Source · Track) or switch Source to BPM",
    });
    return;
  }

  const useTrack =
    state.animSource === "track" && !!tl && tl.duration > 0 && !!audioSession.buffer;

  if (useTrack) {
    // Track export MUST carry audio. Prefer the fast WebCodecs MP4+AAC; if it can't
    // include audio or fails for ANY reason, record the canvas + the clip audio in
    // real time (universal, always has sound) — never a silent clip.
    encodeTrackMp4(state, onProgress)
      .then((res) => {
        if (res) {
          console.info("[export] track → WebCodecs MP4 + AAC audio");
          done({ ok: true, kind: "mp4", seconds: res.seconds, hasAudio: res.hasAudio });
        } else {
          console.info("[export] track → recording canvas + audio (no WebCodecs/AAC)");
          recordTrackWithAudio(canvas, state, done, onProgress);
        }
      })
      .catch((err) => {
        console.error("[export] track encode failed → recording canvas + audio", err);
        recordTrackWithAudio(canvas, state, done, onProgress);
      });
    return;
  }

  encodeLoopMp4(state, onProgress)
    .then((res) => {
      if (res) done({ ok: true, kind: "mp4", seconds: res.seconds, hasAudio: res.hasAudio });
      else recordCanvasFallback(canvas, state, done, onProgress);
    })
    .catch((err) => {
      console.error("[export] loop encode failed; recorder fallback", err);
      recordCanvasFallback(canvas, state, done, onProgress);
    });
}

// ── Shared encode helpers ─────────────────────────────────────────────────────

// Even, capped delivery dimensions for the encoder (H.264 needs even dims; the
// cap keeps the per-frame render + encode quick while keeping the format aspect).
function exportDims(state: StudioState): { w: number; h: number } {
  const f = getFormat(state.format);
  const MAX_EDGE = 1080;
  const scale = Math.min(1, MAX_EDGE / Math.max(f.w, f.h));
  const even = (n: number) => Math.max(2, Math.round(n / 2) * 2);
  return { w: even(f.w * scale), h: even(f.h * scale) };
}

function videoBitrate(w: number, h: number): number {
  return Math.min(16_000_000, Math.max(6_000_000, Math.round(w * h * FPS * 0.15)));
}

// Resolve-loop length in beats (shared with the live loop + the BPM encoder).
function loopBeatsOf(state: StudioState): number {
  return Math.max(1, Math.round(0.5 + ((state.txtLoopBeats ?? 20) / 100) * 7.5));
}

// Frames for an INTEGER number of resolve-cycles (seamless), ~6s target. Mirrors
// the live loop's beat math so the exported loop matches what plays in the editor.
function loopFrames(state: StudioState): number {
  const bps = (state.animBPM || 128) / 60;
  const cycleSec = loopBeatsOf(state) / bps;
  const nCycles = Math.max(1, Math.round(6 / cycleSec));
  return Math.min(900, Math.max(1, Math.round(nCycles * cycleSec * FPS)));
}

// First H.264 profile the encoder actually supports here (High → Main → Baseline).
async function pickAvcCodec(w: number, h: number): Promise<string | null> {
  if (typeof VideoEncoder === "undefined" || !VideoEncoder.isConfigSupported) return null;
  for (const codec of ["avc1.640028", "avc1.4D0028", "avc1.42E01E", "avc1.42001f"]) {
    try {
      const s = await VideoEncoder.isConfigSupported({
        codec,
        width: w,
        height: h,
        bitrate: 8_000_000,
        framerate: FPS,
      });
      if (s && s.supported) return codec;
    } catch {
      /* try the next profile */
    }
  }
  return null;
}

async function aacSupported(sampleRate: number, numberOfChannels: number): Promise<boolean> {
  if (typeof AudioEncoder === "undefined" || !AudioEncoder.isConfigSupported) return false;
  try {
    const s = await AudioEncoder.isConfigSupported({
      codec: "mp4a.40.2",
      sampleRate,
      numberOfChannels,
      bitrate: 160_000,
    });
    return !!(s && s.supported);
  } catch {
    return false;
  }
}

// ── The ONE WebCodecs → mp4-muxer encode core ────────────────────────────────
// Renders `totalFrames` offscreen (frameParams builds each frame's render params
// from the clip-relative time `rt`) and muxes optional clip audio as AAC. Returns
// false when this environment can't produce the requested file (no H.264, or
// audio requested but no AAC) so the caller can fall back — it never ships a
// wrong (short / silent) file.
async function encodeMp4(
  state: StudioState,
  totalFrames: number,
  frameParams: (base: Record<string, unknown>, rt: number) => Record<string, unknown>,
  audio?: { buf: AudioBuffer; startSec: number; endSec: number },
  onProgress?: (frac: number, label: string) => void,
): Promise<false | { seconds: number; hasAudio: boolean }> {
  if (typeof VideoEncoder === "undefined" || typeof VideoFrame === "undefined") return false;
  const { w, h } = exportDims(state);
  const codec = await pickAvcCodec(w, h);
  if (!codec) return false;

  const sr = audio ? audio.buf.sampleRate : 0;
  const ch = audio ? Math.min(2, audio.buf.numberOfChannels) : 0;
  if (audio && !(await aacSupported(sr, ch))) return false;

  // Load the muxer + ensure the cover font is downloaded before any frame draws.
  const [{ Muxer, ArrayBufferTarget }] = await Promise.all([
    import("mp4-muxer"),
    ensureCoverFont(state.textFont),
  ]);

  const muxer = new Muxer({
    target: new ArrayBufferTarget(),
    video: { codec: "avc", width: w, height: h, frameRate: FPS },
    ...(audio ? { audio: { codec: "aac" as const, numberOfChannels: ch, sampleRate: sr } } : {}),
    fastStart: "in-memory",
  });

  let encErr: unknown = null;
  const encoder = new VideoEncoder({
    output: (chunk, meta) => muxer.addVideoChunk(chunk, meta),
    error: (e) => {
      encErr = e;
    },
  });
  encoder.configure({ codec, width: w, height: h, bitrate: videoBitrate(w, h), framerate: FPS, latencyMode: "quality" });

  // Offscreen frame canvas (delivery aspect) + a reused square scratch for the
  // cover-crop, so we never allocate a canvas per frame.
  const off = document.createElement("canvas");
  off.width = w;
  off.height = h;
  const scratch = document.createElement("canvas");
  const base = renderParams(state);

  const secs = Math.round(totalFrames / FPS);

  try {
    for (let i = 0; i < totalFrames; i++) {
      if (encErr) throw encErr;
      renderFormatTo(off, frameParams(base, i / FPS), scratch);
      const frame = new VideoFrame(off, {
        timestamp: Math.round((i * 1_000_000) / FPS),
        duration: Math.round(1_000_000 / FPS),
      });
      encoder.encode(frame, { keyFrame: i % FPS === 0 });
      frame.close();
      // Report progress + yield so the UI actually repaints (the loop is otherwise
      // synchronous). This yield is separate from the backpressure yield below.
      if (onProgress && i % 15 === 0) {
        const pct = Math.round((i / totalFrames) * 100);
        onProgress(i / totalFrames, `Encoding ${secs}s${audio ? " + audio" : " loop"} · ${pct}%`);
        await new Promise<void>((r) => setTimeout(r, 0));
      }
      // Relieve encoder backpressure and let the UI breathe (busy state stays live).
      if (encoder.encodeQueueSize > 8) await new Promise<void>((r) => setTimeout(r, 0));
    }
    await encoder.flush();
    if (encErr) throw encErr;
    if (audio) {
      await encodeClipAudio(audio.buf, audio.startSec, audio.endSec, sr, ch, (c, m) =>
        muxer.addAudioChunk(c, m),
      );
    }
    muxer.finalize();
  } finally {
    try {
      encoder.close();
    } catch {
      /* already closed */
    }
  }

  triggerDownload(
    new Blob([muxer.target.buffer], { type: "video/mp4" }),
    `akacovart_${state.seed >>> 0}.mp4`,
  );
  return { seconds: totalFrames / FPS, hasAudio: !!audio };
}

// BPM loop: an integer number of resolve-cycles, silent, seamless.
function encodeLoopMp4(
  state: StudioState,
  onProgress?: (frac: number, label: string) => void,
): Promise<false | { seconds: number; hasAudio: boolean }> {
  const sp = 0.3 + (state.animSpeed / 100) * 1.7; // BPM-driver speed mapping (CanvasStage)
  return encodeMp4(
    state,
    loopFrames(state),
    (base, rt) => {
      // AUTO: mirror the live BPM-driver's per-frame wander (CanvasStage) so a
      // selected Auto look is actually baked into the export, not just previewed.
      const p = state.auto ? applyAuto(base, rt, state.autoIntensity) : base;
      return {
        ...p,
        _anim: true,
        _bake: true,
        _rt: rt,
        _t: rt * sp,
      };
    },
    undefined,
    onProgress,
  );
}

// Track: the FULL analyzed clip window, motion stepped from the feature timeline
// (the same springs the live preview uses, via trackMotion), audio muxed as AAC.
function encodeTrackMp4(
  state: StudioState,
  onProgress?: (frac: number, label: string) => void,
): Promise<false | { seconds: number; hasAudio: boolean }> {
  const tl = audioSession.timeline;
  const buf = audioSession.buffer;
  if (!tl || !buf) return Promise.resolve(false);

  // Clip window the timeline was analyzed for (audio slice matches it exactly).
  const clipStart = Math.max(0, audioSession.clipStart);
  const clipEnd = Math.min(buf.duration, audioSession.clipEnd);
  let clipDur = Math.max(0, Math.min(tl.duration, clipEnd - clipStart));
  if (clipDur <= 0) return Promise.resolve(false);
  if (clipDur > MAX_TRACK_SECONDS) {
    console.warn(`[export] clip ${clipDur.toFixed(1)}s capped to ${MAX_TRACK_SECONDS}s`);
    clipDur = MAX_TRACK_SECONDS;
  }

  const bps = (state.animBPM || 128) / 60;
  const loopBeats = loopBeatsOf(state);
  const intensity = (state.audioReactive ? state.audioIntensity : 0) / 50;
  const motion = createTrackMotion();

  return encodeMp4(
    state,
    Math.max(1, Math.round(clipDur * FPS)),
    (base, rt) => {
      const anim = stepTrackMotion(motion, tl.sampleByTime(rt), 1 / FPS, intensity, rt, bps, loopBeats, true);
      // AUTO: mirror the live track-driver's wander, scaled by the SAME smoothed
      // audio features stepTrackMotion just updated (CanvasStage does the same).
      const p = state.auto ? applyAuto(base, rt, state.autoIntensity, motion.feat) : base;
      return { ...p, _anim: true, _bake: true, _audioAnim: anim, _t: anim.t, _rt: rt };
    },
    { buf, startSec: clipStart, endSec: clipStart + clipDur },
    onProgress,
  );
}

// Encode [startSec, endSec] of the decoded buffer to AAC, feeding chunks to `add`.
async function encodeClipAudio(
  buf: AudioBuffer,
  startSec: number,
  endSec: number,
  sr: number,
  ch: number,
  add: (chunk: EncodedAudioChunk, meta?: EncodedAudioChunkMetadata) => void,
): Promise<void> {
  const start = Math.max(0, Math.floor(startSec * sr));
  const end = Math.min(buf.length, Math.floor(endSec * sr));
  const n = end - start;
  if (n <= 0) return;
  const chans: Float32Array[] = [];
  for (let c = 0; c < ch; c++) chans.push(buf.getChannelData(Math.min(c, buf.numberOfChannels - 1)));

  let aErr: unknown = null;
  const aenc = new AudioEncoder({
    output: (chunk, meta) => add(chunk, meta),
    error: (e) => {
      aErr = e;
    },
  });
  aenc.configure({ codec: "mp4a.40.2", sampleRate: sr, numberOfChannels: ch, bitrate: 160_000 });

  const BLOCK = 1024;
  for (let o = 0; o < n; o += BLOCK) {
    if (aErr) throw aErr;
    const frames = Math.min(BLOCK, n - o);
    // f32-planar layout: all of channel 0, then all of channel 1, …
    const planar = new Float32Array(frames * ch);
    for (let c = 0; c < ch; c++) {
      const src = chans[c];
      const dst = c * frames;
      for (let j = 0; j < frames; j++) planar[dst + j] = src[start + o + j];
    }
    const ad = new AudioData({
      format: "f32-planar",
      sampleRate: sr,
      numberOfFrames: frames,
      numberOfChannels: ch,
      timestamp: Math.round((o / sr) * 1_000_000),
      data: planar,
    });
    aenc.encode(ad);
    ad.close();
    if (aenc.encodeQueueSize > 16) await new Promise<void>((r) => setTimeout(r, 0));
  }
  await aenc.flush();
  if (aErr) throw aErr;
  try {
    aenc.close();
  } catch {
    /* already closed */
  }
}

function triggerDownload(blob: Blob, name: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

// ── The ONE MediaRecorder runner (both fallbacks) ─────────────────────────────
// Records `stream` for `durationMs` and downloads the result. WebM-first (see the
// header comment); the first supported mime from `mimes` wins. Returns false if a
// recorder can't be constructed at all, so the caller can degrade further.
function recordStream(
  stream: MediaStream,
  durationMs: number,
  state: StudioState,
  done: (outcome: ExportOutcome) => void,
  opts: { mimes: string[]; onStart?: () => void; onStop?: () => void },
  onProgress?: (frac: number, label: string) => void,
): boolean {
  if (typeof MediaRecorder === "undefined") return false;
  let mime = "";
  if (MediaRecorder.isTypeSupported) {
    for (const m of opts.mimes) {
      if (MediaRecorder.isTypeSupported(m)) {
        mime = m;
        break;
      }
    }
  }
  let rec: MediaRecorder;
  try {
    rec = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream);
  } catch {
    try {
      rec = new MediaRecorder(stream);
    } catch {
      return false;
    }
  }
  const outMime = rec.mimeType || mime || "video/webm";
  const ext = outMime.indexOf("mp4") >= 0 ? "mp4" : "webm";
  const hasAudio = stream.getAudioTracks().length > 0;
  const secs = Math.round(durationMs / 1000);
  const chunks: Blob[] = [];

  // Time-based progress (a recorder has no frame counter): tick over durationMs.
  const started = Date.now();
  const tick = onProgress
    ? setInterval(() => {
        const frac = Math.min(1, (Date.now() - started) / durationMs);
        const pct = Math.round(frac * 100);
        onProgress(frac, `Recording ${secs}s${hasAudio ? " + audio" : ""} · ${pct}%`);
      }, 250)
    : null;

  rec.ondataavailable = (e) => {
    if (e.data && e.data.size) chunks.push(e.data);
  };
  rec.onstop = () => {
    if (tick) clearInterval(tick);
    opts.onStop?.();
    triggerDownload(new Blob(chunks, { type: outMime.split(";")[0] }), `akacovart_${state.seed >>> 0}.${ext}`);
    done({ ok: true, kind: ext === "mp4" ? "mp4" : "webm", seconds: durationMs / 1000, hasAudio });
  };
  opts.onStart?.();
  rec.start();
  setTimeout(() => {
    try {
      rec.stop();
    } catch {
      /* ignore */
    }
  }, durationMs);
  return true;
}

// BPM fallback: record the live canvas for an integer number of resolve-cycles
// (seamless) — same beat math as the deterministic path. Silent (no track).
function recordCanvasFallback(
  canvas: HTMLCanvasElement,
  state: StudioState,
  done: (outcome: ExportOutcome) => void,
  onProgress?: (frac: number, label: string) => void,
): void {
  const fail = (error: string) =>
    done({ ok: false, kind: "none", seconds: 0, hasAudio: false, error });
  if (!canvas.captureStream) {
    fail("This browser can't capture the canvas for video export");
    return;
  }
  const durationMs = Math.round((loopFrames(state) / FPS) * 1000);
  const ok = recordStream(
    canvas.captureStream(FPS),
    durationMs,
    state,
    done,
    { mimes: ["video/webm;codecs=vp9", "video/webm;codecs=vp8", "video/webm", "video/mp4"] },
    onProgress,
  );
  if (!ok) fail("This browser can't record video");
}

// Track fallback that ALWAYS carries audio: play the clip and record the live
// (track-driven) canvas + the transport's audio in real time for the clip length.
function recordTrackWithAudio(
  canvas: HTMLCanvasElement,
  state: StudioState,
  done: (outcome: ExportOutcome) => void,
  onProgress?: (frac: number, label: string) => void,
): void {
  const buf = audioSession.buffer;
  const tl = audioSession.timeline;
  if (!buf || !tl || !canvas.captureStream) {
    recordCanvasFallback(canvas, state, done, onProgress);
    return;
  }
  const clipDur = Math.max(
    0.2,
    Math.min(MAX_TRACK_SECONDS, Math.min(tl.duration, audioSession.clipEnd - audioSession.clipStart)),
  );
  // Tap the clip audio BEFORE starting playback so the source routes into it.
  const audioStream = transport.captureStream();
  const tracks: MediaStreamTrack[] = [...canvas.captureStream(FPS).getVideoTracks()];
  if (audioStream) tracks.push(...audioStream.getAudioTracks());

  const ok = recordStream(
    new MediaStream(tracks),
    Math.round(clipDur * 1000) + 200,
    state,
    done,
    {
      mimes: ["video/webm;codecs=vp9,opus", "video/webm;codecs=vp8,opus", "video/webm", "video/mp4"],
      // Play the clip from its start; the live track-driven canvas animates in sync.
      onStart: () => {
        try {
          transport.seek(0);
          transport.play();
        } catch {
          /* ignore */
        }
      },
      onStop: () => {
        try {
          transport.pause();
        } catch {
          /* ignore */
        }
      },
    },
    onProgress,
  );
  if (!ok) recordCanvasFallback(canvas, state, done, onProgress);
}
