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
  const rendering = useStudio((s) => s.rendering);
  const recording = useStudio((s) => s.recording);
  const busy = rendering || recording;

  const isVideo = mode === "animate" || mode === "audio";

  const label = isVideo
    ? recording
      ? "Recording…"
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
