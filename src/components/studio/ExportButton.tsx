"use client";

import { Download, Film, Loader2 } from "lucide-react";

import { useStudio } from "@/lib/store";
import { getFormat } from "@/lib/formats";
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
  const format = useStudio((s) => s.format);
  const exportProgress = useStudio((s) => s.exportProgress);
  const exportLabel = useStudio((s) => s.exportLabel);
  const exportResult = useStudio((s) => s.exportResult);
  const busy = rendering || recording;

  // Animate exports video for BOTH drivers: a looping clip (BPM) or a synced clip
  // (Track). Still exports a PNG in the active delivery format.
  const isVideo = mode === "animate";
  const trackSynced = isVideo && animSource === "track";
  const f = getFormat(format);
  // Square keeps its familiar "3000²" wording; other formats show their size.
  const stillLabel =
    f.id === "square" ? "Download PNG · 3000²" : `Download PNG · ${f.w}×${f.h}`;

  const label = isVideo
    ? recording
      ? // While recording, prefer the live progress label from the export
        // pipeline (already includes the percent); fall back to the static text.
        exportLabel ?? "Recording…"
      : trackSynced
        ? "Export synced video"
        : "Export video loop"
    : rendering
      ? "Rendering…"
      : stillLabel;

  // Reflect determinate progress for assistive tech (the label carries the
  // human-readable percent, so we don't duplicate it in the text).
  const valueNow =
    exportProgress != null ? Math.round(exportProgress * 100) : undefined;

  return (
    <div className={cn("flex w-full flex-col", className)}>
      <button
        type="button"
        onClick={onExport}
        disabled={busy}
        aria-valuenow={valueNow}
        className="flex h-11 w-full items-center justify-center gap-[9px] rounded-[4px] bg-grey-100 text-[12px] font-medium text-bg transition-colors hover:bg-white disabled:opacity-70"
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
      {exportResult != null && (
        <div className="mt-1.5 text-center font-sans text-[11px] text-grey-400">
          {exportResult}
        </div>
      )}
    </div>
  );
}
