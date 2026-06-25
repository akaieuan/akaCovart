import { renderFormatTo, resolveMood } from "@/engine";
import type { Mood } from "@/engine";
import { renderParams, type StudioState } from "@/lib/store";
import { ensureCoverFont } from "@/lib/fonts";
import { getFormat, type Format } from "@/lib/formats";

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
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        const mood: Mood = resolveMood(
          state.seed >>> 0,
          state.mood as Mood | "random",
        );
        // Square keeps the legacy name; other formats append their id.
        const suffix = f.id === "square" ? "" : `_${f.id}`;
        a.href = url;
        a.download = `albumart_${mood}_${state.seed >>> 0}${suffix}.png`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 3000);
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
// socials all open it) that is also byte-SEAMLESS — we render an exact integer
// number of resolve-cycles offscreen, so the first and last frames match. This
// does NOT depend on the live canvas / requestAnimationFrame, so it works even
// when the tab is throttled.
//
// FALLBACK (no WebCodecs or no H.264 encoder): MediaRecorder, preferring a WebM
// container. Chromium's MediaRecorder *MP4* output is a fragmented mp4 that
// QuickTime/Finder refuse to open — that was the "exports are corrupted / won't
// open" bug — so we never reach for it; WebM is valid, and on Safari (where only
// MP4 is offered) Safari's MP4 is itself valid.
export function exportVideo(
  canvas: HTMLCanvasElement,
  state: StudioState,
  done: () => void,
): void {
  encodeLoopMp4(state)
    .then((ok) => {
      if (ok) done();
      else recordCanvasFallback(canvas, state, done);
    })
    .catch((err) => {
      console.error("[export] mp4 encode failed; using recorder fallback", err);
      recordCanvasFallback(canvas, state, done);
    });
}

// H.264 needs even dimensions.
function even(n: number): number {
  return Math.max(2, Math.round(n / 2) * 2);
}

// Frames for an INTEGER number of resolve-cycles (seamless), ~6s target. Mirrors
// the live loop's beat math so the exported loop matches what plays in the editor.
function loopFrames(state: StudioState, fps: number): number {
  const bps = (state.animBPM || 128) / 60;
  const loopBeats = Math.max(1, Math.round(0.5 + ((state.txtLoopBeats ?? 20) / 100) * 7.5));
  const cycleSec = loopBeats / bps;
  const nCycles = Math.max(1, Math.round(6 / cycleSec));
  return Math.min(900, Math.max(1, Math.round(nCycles * cycleSec * fps)));
}

// First H.264 profile the encoder actually supports here (High → Main → Baseline).
async function pickAvcCodec(w: number, h: number, fps: number): Promise<string | null> {
  if (typeof VideoEncoder === "undefined" || !VideoEncoder.isConfigSupported) return null;
  for (const codec of ["avc1.640028", "avc1.4D0028", "avc1.42E01E", "avc1.42001f"]) {
    try {
      const s = await VideoEncoder.isConfigSupported({
        codec,
        width: w,
        height: h,
        bitrate: 8_000_000,
        framerate: fps,
      });
      if (s && s.supported) return codec;
    } catch {
      /* try the next profile */
    }
  }
  return null;
}

// Returns true if it produced + downloaded an mp4; false if it can't (no codec
// support) so the caller can fall back.
async function encodeLoopMp4(state: StudioState): Promise<boolean> {
  if (typeof VideoEncoder === "undefined" || typeof VideoFrame === "undefined") return false;

  const fps = 30;
  const f = getFormat(state.format);
  // Cap the longest edge so the per-frame square render + encode stay quick and
  // within the encoder's max dimensions; keep the delivery aspect ratio.
  const MAX_EDGE = 1080;
  const scale = Math.min(1, MAX_EDGE / Math.max(f.w, f.h));
  const w = even(f.w * scale);
  const h = even(f.h * scale);

  const codec = await pickAvcCodec(w, h, fps);
  if (!codec) return false;

  // Load the muxer + ensure the cover font is downloaded before any frame draws.
  const [{ Muxer, ArrayBufferTarget }] = await Promise.all([
    import("mp4-muxer"),
    ensureCoverFont(state.textFont),
  ]);

  const totalFrames = loopFrames(state, fps);
  const sp = 0.3 + (state.animSpeed / 100) * 1.7; // BPM-driver speed mapping (CanvasStage)

  const muxer = new Muxer({
    target: new ArrayBufferTarget(),
    video: { codec: "avc", width: w, height: h, frameRate: fps },
    fastStart: "in-memory",
  });

  let encErr: unknown = null;
  const encoder = new VideoEncoder({
    output: (chunk, meta) => muxer.addVideoChunk(chunk, meta),
    error: (e) => {
      encErr = e;
    },
  });
  const bitrate = Math.min(16_000_000, Math.max(6_000_000, Math.round(w * h * fps * 0.15)));
  encoder.configure({ codec, width: w, height: h, bitrate, framerate: fps, latencyMode: "quality" });

  // Offscreen frame canvas (delivery aspect) + a reused square scratch for the
  // cover-crop, so we never allocate a canvas per frame.
  const off = document.createElement("canvas");
  off.width = w;
  off.height = h;
  const scratch = document.createElement("canvas");
  const base = renderParams(state);

  try {
    for (let i = 0; i < totalFrames; i++) {
      if (encErr) throw encErr;
      const rt = i / fps; // real-time seconds → drives beat / kick / loopPhase
      renderFormatTo(off, { ...base, _anim: true, _bake: true, _rt: rt, _t: rt * sp }, scratch);
      const frame = new VideoFrame(off, {
        timestamp: Math.round((i * 1_000_000) / fps),
        duration: Math.round(1_000_000 / fps),
      });
      encoder.encode(frame, { keyFrame: i % fps === 0 });
      frame.close();
      // Relieve encoder backpressure and let the UI breathe (busy state stays live).
      if (encoder.encodeQueueSize > 8) {
        await new Promise<void>((r) => setTimeout(r, 0));
      }
    }
    await encoder.flush();
    if (encErr) throw encErr;
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
  return true;
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

// MediaRecorder fallback over the live canvas (only when WebCodecs/H.264 is
// unavailable). WebM-first so the file is always valid; mp4 only if it's the
// sole option (Safari, where its mp4 is well-formed).
function recordCanvasFallback(
  canvas: HTMLCanvasElement,
  state: StudioState,
  done: () => void,
): void {
  if (!canvas.captureStream || typeof MediaRecorder === "undefined") {
    done();
    return;
  }
  const stream = canvas.captureStream(30);
  let mime = "video/webm";
  const want = ["video/webm;codecs=vp9", "video/webm;codecs=vp8", "video/webm", "video/mp4"];
  if (MediaRecorder.isTypeSupported) {
    for (const w of want) {
      if (MediaRecorder.isTypeSupported(w)) {
        mime = w;
        break;
      }
    }
  }
  let rec: MediaRecorder;
  try {
    rec = new MediaRecorder(stream, { mimeType: mime });
  } catch {
    try {
      rec = new MediaRecorder(stream);
      mime = "video/webm";
    } catch {
      done();
      return;
    }
  }
  const ext = mime.indexOf("mp4") >= 0 ? "mp4" : "webm";
  const chunks: Blob[] = [];
  rec.ondataavailable = (e) => {
    if (e.data && e.data.size) chunks.push(e.data);
  };
  rec.onstop = () => {
    triggerDownload(
      new Blob(chunks, { type: mime.split(";")[0] }),
      `akacovart_${state.seed >>> 0}.${ext}`,
    );
    done();
  };
  // Record an integer number of resolve-cycles (seamless) — same beat math as the
  // deterministic path.
  const fps = 30;
  const cycleFrames = loopFrames(state, fps);
  const durationMs = Math.round((cycleFrames / fps) * 1000);
  rec.start();
  setTimeout(() => {
    try {
      rec.stop();
    } catch {
      /* ignore */
    }
  }, durationMs);
}
