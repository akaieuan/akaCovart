"use client";

import { memo } from "react";
import { cn } from "@/lib/utils";
import { useStudio } from "@/lib/store";
import type { StrKey } from "./keys";
import type { SegOption } from "./Segmented";
import { CONTROL, FOCUS } from "./typography";

// ── Font picker (2-col button grid, single-select) ────────────────────────────
// A compact selector for the cover-text face. The long family names ("Instrument
// Serif", "Space Grotesk") don't fit a single segmented row, so this lays them
// out two-up. Each button previews its own face so the choice is visible — the
// inline fontFamily is the content, so this is the one control that doesn't
// take the CONTROL role; only the face is overridden inline per option.
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
    <div className={cn("grid grid-cols-2 gap-1 rounded-control border border-edge bg-grey-880 p-1", className)}>
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
              CONTROL,
              FOCUS,
              "h-8 truncate rounded-[2px] px-2 text-grey-250 transition-colors hover:bg-wash-active hover:text-grey-100 active:bg-wash-active",
              active && "bg-grey-100 text-bg hover:bg-grey-100",
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
