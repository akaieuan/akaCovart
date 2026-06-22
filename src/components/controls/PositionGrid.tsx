"use client";

import { memo } from "react";
import { useStudio } from "@/lib/store";
import { Label } from "./primitives";
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
        <Label sub>Position</Label>
        <span className="font-sans text-[11px] text-grey-400">
          or drag on canvas ⤢
        </span>
      </div>
      <div className="grid w-[120px] grid-cols-3 gap-[5px]">
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
                className={
                  "flex aspect-[1.4] rounded-[3px] border p-[5px] transition-colors " +
                  (active
                    ? "border-grey-500 bg-grey-600"
                    : "border-grey-800 bg-grey-880 hover:border-grey-500")
                }
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
                  className={
                    "h-1 w-1 rounded-full " +
                    (active ? "bg-grey-100" : "bg-grey-400")
                  }
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
