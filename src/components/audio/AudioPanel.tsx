"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2, Music, Pause, Play, Upload } from "lucide-react";

import {
  audioSession,
  decodeFile,
  analyzeClip,
  transport,
} from "@/audio";
import {
  useStudio,
  maxClipSeconds,
  DEFAULT_CLIP,
  CLIP_PRESETS,
  type ClipLength,
} from "@/lib/store";
import { GroupLabel, SliderRow, ToggleRow } from "@/components/controls/primitives";
import {
  CONTROL,
  DATA,
  DATA_SM,
  FOCUS,
  MICRO,
} from "@/components/controls/primitives/typography";
import { cn } from "@/lib/utils";
import Waveform from "./Waveform";

const ACCEPT = "audio/mpeg,audio/wav,.mp3,.wav";

/**
 * AudioControls — the embeddable audio-driver body.
 *
 * Owns the audio import/analyze lifecycle: decode a file into the audio session
 * singleton, run the offline analysis for the current window, load the
 * transport, and expose play/pause + the AUDIO REACT controls. The Waveform
 * child edits the clip window; this watches it and re-analyzes (debounced).
 *
 * Renders WITHOUT outer page padding so it can sit inside the Animate motion
 * panel (which supplies its own padding + the shared Auto group). The `intro`
 * flag toggles the short explanatory blurb (shown standalone, hidden inline).
 */
export function AudioControls({ intro = true }: { intro?: boolean }) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const audioName = useStudio((s) => s.audioName);
  const audioStatus = useStudio((s) => s.audioStatus);
  const audioDuration = useStudio((s) => s.audioDuration);
  const clipStart = useStudio((s) => s.clipStart);
  const clipEnd = useStudio((s) => s.clipEnd);
  const clipLength = useStudio((s) => s.clipLength);
  const audioPlaying = useStudio((s) => s.audioPlaying);
  const setState = useStudio((s) => s.setState);
  const setClipLength = useStudio((s) => s.setClipLength);

  // Each analysis run gets a token so a stale (superseded) run can't overwrite
  // the session/state after a newer window has been requested.
  const runToken = useRef(0);

  // ── Analyze the current window into the session timeline ───────────────────
  const runAnalysis = useCallback(async () => {
    const buffer = audioSession.buffer;
    if (!buffer) return;
    const token = ++runToken.current;
    const { clipStart: cs, clipEnd: ce } = useStudio.getState();

    setState({ audioStatus: "analyzing" });
    setProgress(0);
    try {
      const timeline = await analyzeClip(buffer, cs, ce, (p) => {
        if (token === runToken.current) setProgress(p);
      });
      if (token !== runToken.current) return; // superseded
      audioSession.timeline = timeline;
      audioSession.clipStart = cs;
      audioSession.clipEnd = ce;
      transport.load(buffer, cs, ce);
      setState({ audioStatus: "ready", audioPlaying: transport.playing });
    } catch (err) {
      if (token !== runToken.current) return;
      setError(err instanceof Error ? err.message : "Analysis failed");
      setState({ audioStatus: "ready" });
    }
  }, [setState]);

  // ── Decode + first analysis on file select ─────────────────────────────────
  const loadFile = useCallback(
    async (file: File) => {
      setError(null);
      // Reset transport/playing for the incoming file.
      transport.pause();
      setState({
        audioName: file.name,
        audioStatus: "decoding",
        audioPlaying: false,
      });
      setProgress(0);
      try {
        const { buffer, peaks } = await decodeFile(file);
        audioSession.buffer = buffer;
        audioSession.peaks = peaks;

        // Default window: first (active length) seconds, clamped to track length.
        const dur = buffer.duration;
        const len = useStudio.getState().clipLength;
        const end = maxClipSeconds(len, dur);
        setState({ audioDuration: dur, clipStart: 0, clipEnd: end });

        await runAnalysis();
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Could not decode this file",
        );
        setState({ audioStatus: "idle", audioName: null });
      }
    },
    [runAnalysis, setState],
  );

  const onPick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) void loadFile(file);
    e.target.value = ""; // allow re-selecting the same file
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) void loadFile(file);
  };

  // ── Debounced re-analyze when the clip window changes (after first load) ────
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scheduleReanalyze = useCallback(() => {
    if (!audioSession.buffer) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      void runAnalysis();
    }, 280);
  }, [runAnalysis]);

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  // Pick a window length: refit clipStart/clipEnd in the store, then re-analyze
  // (debounced) just like a drag does.
  const pickLength = useCallback(
    (len: ClipLength) => {
      setClipLength(len);
      scheduleReanalyze();
    },
    [setClipLength, scheduleReanalyze],
  );

  // ── Transport ──────────────────────────────────────────────────────────────
  const togglePlay = () => {
    if (audioStatus !== "ready" && audioStatus !== "analyzing") return;
    if (!audioSession.buffer) return;
    if (transport.playing) {
      transport.pause();
      setState({ audioPlaying: false });
    } else {
      transport.play();
      setState({ audioPlaying: transport.playing });
    }
  };

  // Live time readout, ticked while playing.
  const [now, setNow] = useState(0);
  useEffect(() => {
    if (!audioPlaying) {
      setNow(transport.currentTime);
      return;
    }
    let raf = 0;
    const tick = () => {
      setNow(transport.currentTime);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [audioPlaying]);

  const busy = audioStatus === "decoding" || audioStatus === "analyzing";
  const clipDur = Math.max(0, clipEnd - clipStart);
  const hasAudio = audioStatus === "ready" || audioStatus === "analyzing";

  return (
    <div>
      {intro && (
        <div className={cn(CONTROL, "mb-4 text-grey-300")}>
          Import a track, trim a clip window (up to{" "}
          <span className={DATA}>{DEFAULT_CLIP}</span>s or the full track), then
          export a synced video.
        </div>
      )}

      {/* ── Dropzone / file picker ──────────────────────────────────────── */}
      <input
        ref={fileInputRef}
        type="file"
        accept={ACCEPT}
        onChange={onPick}
        className="sr-only"
      />
      <button
        type="button"
        onClick={() => fileInputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        className={cn(
          FOCUS,
          "flex w-full flex-col items-center justify-center gap-2 rounded-control border border-dashed px-4 py-6 text-center transition-colors",
          dragOver
            ? "border-grey-200 bg-wash-active"
            : "border-edge-hover bg-grey-880 hover:border-white/30 hover:bg-wash",
        )}
      >
        {busy ? (
          <Loader2 className="size-[18px] animate-spin text-grey-200" />
        ) : audioName ? (
          <Music className="size-[18px] text-grey-200" />
        ) : (
          <Upload className="size-[18px] text-grey-300" />
        )}
        <span className={cn(CONTROL, "max-w-full truncate text-grey-100")}>
          {audioName ?? "Drop audio or click"}
        </span>
        <span className={cn(MICRO, "text-grey-300")}>
          {busy ? (
            audioStatus === "decoding" ? (
              "Decoding…"
            ) : (
              <>
                Analyzing{" "}
                <span className={DATA_SM}>{Math.round(progress * 100)}%</span>
              </>
            )
          ) : (
            "MP3 · WAV"
          )}
        </span>
      </button>

      {/* Analyze progress bar */}
      {audioStatus === "analyzing" && (
        <div className="mt-2 h-[3px] w-full overflow-hidden rounded-full bg-grey-850">
          <div
            className="h-full bg-grey-200 transition-[width] duration-150"
            style={{ width: `${Math.round(progress * 100)}%` }}
          />
        </div>
      )}

      {error && (
        <div className={cn(MICRO, "mt-2 text-red-400")}>{error}</div>
      )}

      {/* ── Waveform + transport (once a file is loaded) ─────────────────── */}
      {hasAudio && audioDuration > 0 && (
        <>
          <div className="mt-5">
            <GroupLabel>Clip window</GroupLabel>
            <Waveform onScrub={scheduleReanalyze} />

            {/* Length presets — the shared tray recipe (Segmented / ModeToggle). */}
            <div className="mt-3 flex items-center gap-1 rounded-control border border-edge bg-grey-880 p-1">
              {CLIP_PRESETS.map((len) => {
                const active = clipLength === len;
                return (
                  <button
                    key={String(len)}
                    type="button"
                    onClick={() => pickLength(len)}
                    aria-pressed={active}
                    className={cn(
                      DATA_SM,
                      FOCUS,
                      "flex h-8 flex-1 items-center justify-center rounded-[2px] transition-colors",
                      active
                        ? "bg-grey-100 text-bg"
                        : "text-grey-250 hover:bg-wash-active hover:text-grey-100 active:bg-wash-active",
                    )}
                  >
                    {len === "full" ? "Full" : `${len}s`}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Transport */}
          <div className="mt-4 flex items-center gap-3">
            <button
              type="button"
              onClick={togglePlay}
              aria-label={audioPlaying ? "Pause" : "Play"}
              className={cn(
                CONTROL,
                FOCUS,
                "flex h-10 flex-none items-center gap-2 rounded-control bg-grey-100 px-4 font-medium text-bg transition-colors hover:bg-white active:bg-grey-200",
              )}
            >
              {audioPlaying ? (
                <Pause className="size-[13px]" />
              ) : (
                <Play className="size-[13px]" />
              )}
              {audioPlaying ? "Pause" : "Play"}
            </button>
            <div className={cn(DATA, "flex-1 text-right text-grey-200")}>
              {fmt(now)}{" "}
              <span aria-hidden className="text-grey-500">
                /
              </span>{" "}
              {fmt(clipDur)}
            </div>
          </div>
        </>
      )}

      {/* ── AUDIO REACT ─────────────────────────────────────────────────── */}
      <div className="mt-6">
        <GroupLabel>Audio react</GroupLabel>
        <ToggleRow label="Reactive" paramKey="audioReactive" />
        <SliderRow
          label="Intensity"
          paramKey="audioIntensity"
          min={0}
          max={100}
        />
      </div>
    </div>
  );
}

/**
 * AudioPanel — standalone wrapper around AudioControls (page padding + intro).
 * Kept for any standalone use; the Animate motion panel embeds AudioControls
 * directly so it can share that panel's padding + Auto group.
 */
export default function AudioPanel() {
  return (
    <div className="px-5 pt-4 pb-2">
      <AudioControls intro />
    </div>
  );
}

function fmt(t: number): string {
  if (!isFinite(t) || t < 0) t = 0;
  const m = Math.floor(t / 60);
  const s = Math.floor(t % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}
