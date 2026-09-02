"use client";

import { Download, Film, Loader2 } from "lucide-react";

import { useStudio } from "@/lib/store";
import { getFormat } from "@/lib/formats";
import { cn } from "@/lib/utils";
import { CONTROL, DATA_SM, FOCUS, MICRO } from "@/components/controls/primitives/typography";

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
  const exportLabel = useStudio((s) => s.exportLabel);
  const exportResult = useStudio((s) => s.exportResult);
  const busy = rendering || recording;

  // Animate exports video for BOTH drivers: a looping clip (BPM) or a synced clip
  // (Track). Still exports a PNG in the active delivery format.
  const isVideo = mode === "animate";
  const trackSynced = isVideo && animSource === "track";
  const f = getFormat(format);
  // The pixel size is DATA — it rides in the mono role beside the sans label so
  // the words stay sans and only the numerals go mono.
  const stillDims = f.id === "square" ? "3000 × 3000" : `${f.w} × ${f.h}`;

  // The word part of the label. While recording, prefer the live progress label
  // from the export pipeline (already includes the percent); fall back to the
  // static text. Body figures are tabular, so the percent doesn't reflow.
  const label = isVideo
    ? recording
      ? (exportLabel ?? "Recording…")
      : trackSynced
        ? "Export synced video"
        : "Export video loop"
    : rendering
      ? "Rendering…"
      : "Download PNG";

  return (
    <div className={cn("flex w-full flex-col", className)}>
      <button
        type="button"
        onClick={onExport}
        disabled={busy}
        // A button can't carry aria-valuenow (role mismatch); the label already
        // carries the percent and aria-busy flags the in-progress state.
        aria-busy={busy}
        className={cn(
          CONTROL,
          FOCUS,
          "flex h-11 w-full items-center justify-center gap-2 rounded-control bg-grey-100 font-medium text-bg transition-colors hover:bg-white active:bg-grey-200 disabled:opacity-60 disabled:hover:bg-grey-100",
        )}
      >
        {busy ? (
          <Loader2 className="size-[14px] animate-spin" />
        ) : isVideo ? (
          <Film className="size-[14px]" />
        ) : (
          <Download className="size-[14px]" />
        )}
        <span>{label}</span>
        {!isVideo && !rendering && (
          <span className={cn(DATA_SM, "text-bg/70")}>{stillDims}</span>
        )}
      </button>
      {exportResult != null && (
        <div className={cn(MICRO, "mt-2 text-center text-grey-300")}>{exportResult}</div>
      )}
    </div>
  );
}
