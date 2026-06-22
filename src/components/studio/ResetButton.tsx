"use client";

import { RotateCcw } from "lucide-react";

import { useStudio } from "@/lib/store";
import { cn } from "@/lib/utils";

/** RESET — restore all generation/animation params to their defaults. */
export function ResetButton({ className }: { className?: string }) {
  const resetParams = useStudio((s) => s.resetParams);
  return (
    <button
      type="button"
      onClick={resetParams}
      title="Reset all parameters to defaults"
      className={cn(
        "flex h-9 flex-none items-center justify-center gap-[6px] rounded-[5px] border border-grey-800 bg-grey-880 px-4 text-[12px] font-normal text-grey-300 transition-colors hover:border-grey-500 hover:text-grey-100",
        className,
      )}
    >
      <RotateCcw className="size-[12px]" />
      Reset
    </button>
  );
}
