"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2, Music, Pause, Play, Upload } from "lucide-react";

import {
  audioSession,
  decodeFile,
  analyzeClip,
  transport,
} from "@/audio";
import { useStudio, MAX_CLIP } from "@/lib/store";
import { GroupLabel, SliderRow, ToggleRow } from "@/components/controls/primitives";
import Waveform from "./Waveform";

const ACCEPT = "audio/mpeg,audio/wav,.mp3,.wav";

/**
 * AudioPanel — the AUDIO-mode parameter body.
 *
 * Owns the audio import/analyze lifecycle: decode a file into the audio session
 * singleton, run the offline analysis for the current 60s window, load the
 * transport, and expose play/pause + the AUDIO REACT controls. The Waveform
 * child edits the clip window; this panel watches it and re-analyzes (debounced).
 */
export default function AudioPanel() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const audioName = useStudio((s) => s.audioName);
  const audioStatus = useStudio((s) => s.audioStatus);
  const audioDuration = useStudio((s) => s.audioDuration);
  const clipStart = useStudio((s) => s.clipStart);
  const clipEnd = useStudio((s) => s.clipEnd);
  const audioPlaying = useStudio((s) => s.audioPlaying);
  const setState = useStudio((s) => s.setState);

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

        // Default window: first MAX_CLIP seconds (clamped to track length).
        const dur = buffer.duration;
        const end = Math.min(dur, MAX_CLIP);
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
    <div className="px-5 pt-4 pb-2">
      <div className="mb-4 font-sans text-[11px] leading-[1.7] text-grey-350">
        Import an MP3 or WAV, trim a {MAX_CLIP}s window, and the engine reacts
        live to its analyzed energy &amp; beats. Export a synced video loop.
      </div>

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
        className={
          "flex w-full flex-col items-center justify-center gap-[7px] rounded-[5px] border border-dashed px-4 py-6 text-center transition-colors " +
          (dragOver
            ? "border-grey-400 bg-grey-850"
            : "border-grey-700 bg-grey-880 hover:border-grey-500 hover:bg-grey-850")
        }
      >
        {busy ? (
          <Loader2 className="size-[18px] animate-spin text-grey-200" />
        ) : audioName ? (
          <Music className="size-[18px] text-grey-200" />
        ) : (
          <Upload className="size-[18px] text-grey-300" />
        )}
        <span className="max-w-full truncate font-sans text-[12px] font-medium text-grey-150">
          {audioName ?? "Drop audio or click"}
        </span>
        <span className="font-sans text-[11px] text-grey-400">
          {busy
            ? audioStatus === "decoding"
              ? "Decoding…"
              : `Analyzing ${Math.round(progress * 100)}%`
            : "MP3 · WAV"}
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
        <div className="mt-2 font-sans text-[11px] text-red-400">
          {error}
        </div>
      )}

      {/* ── Waveform + transport (once a file is loaded) ─────────────────── */}
      {hasAudio && audioDuration > 0 && (
        <>
          <div className="mt-5">
            <GroupLabel variant="beat">Clip window</GroupLabel>
            <Waveform onScrub={scheduleReanalyze} />
          </div>

          {/* Transport */}
          <div className="mt-4 flex items-center gap-3">
            <button
              type="button"
              onClick={togglePlay}
              aria-label={audioPlaying ? "Pause" : "Play"}
              className="flex h-10 flex-none items-center gap-[8px] rounded-[4px] bg-grey-100 px-[18px] font-sans text-[12px] font-medium text-bg transition-colors hover:bg-white"
            >
              {audioPlaying ? (
                <Pause className="size-[13px]" />
              ) : (
                <Play className="size-[13px]" />
              )}
              {audioPlaying ? "Pause" : "Play"}
            </button>
            <div className="flex-1 text-right font-sans text-[12px] tabular-nums text-grey-200">
              {fmt(now)} <span className="text-grey-450">/</span> {fmt(clipDur)}
            </div>
          </div>
        </>
      )}

      {/* ── AUDIO REACT ─────────────────────────────────────────────────── */}
      <div className="mt-6">
        <GroupLabel variant="beat">Audio react</GroupLabel>
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

function fmt(t: number): string {
  if (!isFinite(t) || t < 0) t = 0;
  const m = Math.floor(t / 60);
  const s = Math.floor(t % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}
