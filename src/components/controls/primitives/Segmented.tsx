"use client";

import { memo } from "react";
import { cn } from "@/lib/utils";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { useStudio } from "@/lib/store";
import type { StrKey } from "./keys";
import { CONTROL, FOCUS } from "./typography";

// ── Segmented control (shadcn ToggleGroup, single-select) ─────────────────────
// The tray recipe: one edge border + grey-880 fill, 2px-radius items inside.
// State is carried by FILL (active = grey-100), never by weight — a 400→500
// swap made Mood / Source / Case jitter when the selection moved.
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
      spacing={1}
      className={cn("w-full rounded-control border border-edge bg-grey-880 p-1", className)}
    >
      {options.map((op) => (
        <ToggleGroupItem
          key={op.value}
          value={op.value}
          className={cn(
            CONTROL,
            FOCUS,
            "h-8 flex-1 rounded-[2px] px-1 text-grey-250 transition-colors hover:bg-wash-active hover:text-grey-100 active:bg-wash-active data-pressed:bg-grey-100 data-pressed:text-bg data-pressed:hover:bg-grey-100",
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
