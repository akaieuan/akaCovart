"use client";

import { memo } from "react";
import { cn } from "@/lib/utils";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { useStudio } from "@/lib/store";
import type { StrKey } from "./keys";
import { CONTROL, FOCUS, TRAY, TRAY_IDLE, TRAY_ITEM, TRAY_PRESSED } from "./typography";

// ── Segmented control (shadcn ToggleGroup, single-select) ─────────────────────
// The shared TRAY recipe (typography.ts): items sized by their label, never
// narrower than the text, wrapping to a second row when six scene names won't
// fit — the fill must always contain its label. State is carried by FILL
// (active = grey-100), never by weight, so nothing jitters on select.
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
      className={cn(TRAY, "w-full", className)}
    >
      {options.map((op) => (
        <ToggleGroupItem
          key={op.value}
          value={op.value}
          // TRAY_ITEM's min-w-fit overrides the toggle atom's min-w-9 — the
          // explicit minimum that let a column shrink under its own label.
          className={cn(CONTROL, FOCUS, TRAY_ITEM, TRAY_IDLE, TRAY_PRESSED)}
        >
          {op.label}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  );
}

export const Segmented = memo(SegmentedInner);
Segmented.displayName = "Segmented";
