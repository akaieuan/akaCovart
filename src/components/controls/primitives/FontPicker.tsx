"use client";

import { memo } from "react";
import { cn } from "@/lib/utils";
import { useStudio } from "@/lib/store";
import type { StrKey } from "./keys";
import type { SegOption } from "./Segmented";

// ── Font picker (2-col button grid, single-select) ────────────────────────────
// A compact selector for the cover-text face. The long family names ("Instrument
// Serif", "Space Grotesk") don't fit a single segmented row, so this lays them
// out two-up. Each button previews its own face so the choice is visible.
//
// Self-subscribing: reads ONLY its own string store slice (paramKey, i.e.
// `textFont`) and writes through the stable `setState` action. Memoized so it
// ignores unrelated store churn — same pattern as Segmented.
export interface FontPickerProps {
  paramKey: StrKey;
  options: SegOption[];
  className?: string;
}

function FontPickerInner({ paramKey, options, className }: FontPickerProps) {
  const value = useStudio((s) => s[paramKey]);
  const setState = useStudio((s) => s.setState);

  return (
    <div className={cn("grid grid-cols-2 gap-[6px]", className)}>
      {options.map((op) => {
        const active = value === op.value;
        return (
          <button
            key={op.value}
            type="button"
            aria-pressed={active}
            onClick={() =>
              setState({ [paramKey]: op.value } as Parameters<
                typeof setState
              >[0])
            }
            style={{ fontFamily: `"${op.value}", sans-serif` }}
            className={cn(
              "h-auto truncate rounded-[5px] border border-grey-800/80 bg-grey-880/40 px-2 py-[9px] text-[12px] font-normal leading-none text-grey-300 transition-colors",
              "hover:border-grey-700 hover:bg-grey-850/60 hover:text-grey-150",
              active && "border-grey-500/70 bg-grey-100 text-grey-950",
            )}
          >
            {op.label}
          </button>
        );
      })}
    </div>
  );
}

export const FontPicker = memo(FontPickerInner);
FontPicker.displayName = "FontPicker";
