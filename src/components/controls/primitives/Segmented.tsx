"use client";

import { memo } from "react";
import { cn } from "@/lib/utils";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { useStudio } from "@/lib/store";
import type { StrKey } from "./keys";

// ── Segmented control (shadcn ToggleGroup, single-select) ─────────────────────
export interface SegOption {
  value: string;
  label: string;
}

// Self-subscribing: reads ONLY its own string store slice and writes through
// the stable `setState` action. Memoized so it ignores unrelated store churn.
export interface SegmentedProps {
  paramKey: StrKey;
  options: SegOption[];
  className?: string;
}

function SegmentedInner({ paramKey, options, className }: SegmentedProps) {
  const value = useStudio((s) => s[paramKey]);
  const setState = useStudio((s) => s.setState);

  return (
    <ToggleGroup
      value={[value]}
      onValueChange={(vals) => {
        const next = vals[0];
        // Ignore deselect (clicking the active segment) — keep one selected.
        if (typeof next === "string")
          setState({ [paramKey]: next } as Parameters<typeof setState>[0]);
      }}
      spacing={6}
      className={cn("w-full", className)}
    >
      {options.map((op) => (
        <ToggleGroupItem
          key={op.value}
          value={op.value}
          variant="outline"
          className={cn(
            "h-auto flex-1 rounded-[5px] border-grey-800/80 bg-grey-880/40 px-0 py-[7px] font-sans text-[11px] font-normal text-grey-350 transition-colors",
            "hover:border-grey-700 hover:bg-grey-850/60 hover:text-grey-150",
            "data-pressed:border-grey-500/70 data-pressed:bg-grey-100 data-pressed:font-medium data-pressed:text-grey-950",
            "aria-pressed:border-grey-500/70 aria-pressed:bg-grey-100 aria-pressed:font-medium aria-pressed:text-grey-950",
          )}
        >
          {op.label}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  );
}

export const Segmented = memo(SegmentedInner);
Segmented.displayName = "Segmented";
