"use client";

import { RotateCcw } from "lucide-react";

import { useStudio } from "@/lib/store";
import { cn } from "@/lib/utils";
import { CONTROL, FOCUS } from "@/components/controls/primitives/typography";

/** RESET — restore all generation/animation params to their defaults. */
export function ResetButton({ className }: { className?: string }) {
  const resetParams = useStudio((s) => s.resetParams);
  return (
    // 40px on its own; in the footer row it stretches to the ModeToggle tray
    // beside it (tray = 32px items + 4px inset + 1px edge = 42px) so the two
    // stay level instead of 2px off.
    <button
      type="button"
      onClick={resetParams}
      title="Reset all parameters to defaults"
      className={cn(
        CONTROL,
        FOCUS,
        "flex min-h-10 flex-none items-center justify-center gap-1.5 rounded-control border border-edge bg-grey-880 px-4 text-grey-250 transition-colors hover:border-edge-hover hover:text-grey-100 active:bg-grey-850",
        className,
      )}
    >
      <RotateCcw className="size-[12px]" />
      Reset
    </button>
  );
}
