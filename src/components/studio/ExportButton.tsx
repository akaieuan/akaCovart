"use client";

import { Download, Film, Loader2 } from "lucide-react";

import { useStudio } from "@/lib/store";
import { cn } from "@/lib/utils";

/** Primary export button (DOWNLOAD PNG / EXPORT VIDEO LOOP) with busy spinner. */
export function ExportButton({
  onExport,
  className,
}: {
  onExport: () => void;
  className?: string;
}) {
  const mode = useStudio((s) => s.mode);
  const animSource = useStudio((s) => s.animSource);
  const rendering = useStudio((s) => s.rendering);
  const recording = useStudio((s) => s.recording);
  const busy = rendering || recording;

  // Animate exports video for BOTH drivers: a looping clip (BPM) or a synced clip
  // (Track). Still exports a 3000² PNG.
  const isVideo = mode === "animate";
  const trackSynced = isVideo && animSource === "track";

  const label = isVideo
    ? recording
      ? "Recording…"
      : trackSynced
        ? "Export synced video"
        : "Export video loop"
    : rendering
      ? "Rendering…"
      : "Download PNG · 3000²";

  return (
    <button
      type="button"
      onClick={onExport}
      disabled={busy}
      className={cn(
        "flex h-11 w-full items-center justify-center gap-[9px] rounded-[4px] bg-grey-100 text-[12px] font-medium text-bg transition-colors hover:bg-white disabled:opacity-70",
        className,
      )}
    >
      {busy ? (
        <Loader2 className="size-[14px] animate-spin" />
      ) : isVideo ? (
        <Film className="size-[14px]" />
      ) : (
        <Download className="size-[14px]" />
      )}
      {label}
    </button>
  );
}
