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
            "h-auto flex-1 rounded-[3px] border-grey-800 bg-transparent px-0 py-2 font-sans text-[11px] font-normal text-grey-350",
            "hover:border-grey-500 hover:bg-transparent hover:text-grey-200",
            "data-pressed:border-grey-500 data-pressed:bg-grey-600 data-pressed:text-grey-100",
            "aria-pressed:border-grey-500 aria-pressed:bg-grey-600 aria-pressed:text-grey-100",
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
