"use client";

import { memo } from "react";
import { cn } from "@/lib/utils";
import { useStudio } from "@/lib/store";
import { Label } from "./primitives";
import { FOCUS, MICRO } from "./primitives/typography";
import { POS_COLS, POS_ROWS } from "./controls-config";

// ── Text position 3x3 grid ───────────────────────────────────────────────────
// Self-subscribing: reads ONLY the three text-position slices it needs to show
// the active cell, and writes via the stable `setState` action. Memoized so it
// re-renders only when textX/textY/textAlign change (e.g. dragging on canvas),
// not when any other slider ticks.
function PositionGridInner() {
  const textX = useStudio((s) => s.textX);
  const textY = useStudio((s) => s.textY);
  const textAlign = useStudio((s) => s.textAlign);
  const setState = useStudio((s) => s.setState);

  return (
    <>
      <div className="mb-2 flex items-baseline justify-between">
        <Label>Position</Label>
        <span className={cn(MICRO, "text-grey-300")}>or drag on canvas ⤢</span>
      </div>
      <div className="grid w-[132px] grid-cols-3 gap-1">
        {POS_ROWS.map((ry, ri) =>
          POS_COLS.map((col, ci) => {
            const active =
              Math.abs(textX - col.x) < 0.02 &&
              Math.abs(textY - ry) < 0.02 &&
              textAlign === col.align;
            return (
              <button
                key={`${ri}-${ci}`}
                type="button"
                aria-label={`Position ${col.align} ${
                  ri === 0 ? "top" : ri === 2 ? "bottom" : "middle"
                }`}
                onClick={() =>
                  setState({
                    textX: col.x,
                    textY: ry,
                    textAlign: col.align,
                  })
                }
                // Active = grey-100 edge + grey-100 dot; the fill stays the tray grey.
                className={cn(
                  FOCUS,
                  "flex aspect-[1.25] rounded-control border p-1 transition-colors",
                  active
                    ? "border-grey-100 bg-grey-880"
                    : "border-edge bg-grey-880 hover:border-edge-hover",
                )}
                style={{
                  alignItems:
                    col.align === "left"
                      ? "flex-start"
                      : col.align === "right"
                        ? "flex-end"
                        : "center",
                  justifyContent:
                    ri === 0
                      ? "flex-start"
                      : ri === 2
                        ? "flex-end"
                        : "center",
                }}
              >
                <span
                  className={cn(
                    "h-1 w-1 rounded-full",
                    active ? "bg-grey-100" : "bg-grey-350",
                  )}
                />
              </button>
            );
          }),
        )}
      </div>
    </>
  );
}

export const PositionGrid = memo(PositionGridInner);
PositionGrid.displayName = "PositionGrid";
