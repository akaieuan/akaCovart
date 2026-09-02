"use client";

import { memo, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { Slider as UISlider } from "@/components/ui/slider";
import { useStudio } from "@/lib/store";
import { Label } from "./Label";
import type { NumKey } from "./keys";
import { DATA, FOCUS, FOCUS_FIELD, SLOT } from "./typography";

// ── Slider row (shadcn Slider + click-to-edit value) ─────────────────────────
// Self-subscribing: reads ONLY its own numeric store slice via a narrow
// selector and writes through the stable `setState` action. Wrapped in
// React.memo so a tick on another slider never re-renders this row.
// The value is DATA (mono) in a fixed 4ch SLOT, so the label never shifts as
// the figure ticks; the edit input shares the button's exact geometry so the
// row doesn't jump when editing starts.
export interface SliderRowProps {
  paramKey: NumKey;
  label: string;
  min: number;
  max: number;
  step?: number;
  /** Render as a quieter "sub" row (indented child of a toggle group). */
  sub?: boolean;
}

function SliderRowInner({
  paramKey,
  label,
  min,
  max,
  step = 1,
  sub,
}: SliderRowProps) {
  const value = useStudio((s) => s[paramKey]);
  const setState = useStudio((s) => s.setState);
  const onChange = (v: number) =>
    setState({ [paramKey]: v } as Parameters<typeof setState>[0]);

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(String(value));
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editing]);

  // Clamp to [min,max] and snap to step (relative to min, like a range input).
  const clampSnap = (raw: number): number => {
    if (Number.isNaN(raw)) return value;
    let v = Math.min(max, Math.max(min, raw));
    if (step > 0) v = min + Math.round((v - min) / step) * step;
    v = Math.min(max, Math.max(min, v));
    return Math.round(v * 1e6) / 1e6;
  };

  const commit = () => {
    onChange(clampSnap(Number(draft)));
    setEditing(false);
  };

  const startEdit = () => {
    setDraft(String(value));
    setEditing(true);
  };

  return (
    <div className={cn("mb-3", sub && "pl-3")}>
      <div className="mb-1 flex h-5 items-center justify-between gap-2">
        <Label sub={sub}>{label}</Label>
        {editing ? (
          <input
            ref={inputRef}
            type="number"
            min={min}
            max={max}
            step={step}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => {
              if (e.key === "Enter") commit();
              else if (e.key === "Escape") setEditing(false);
            }}
            // Number inputs always match :focus-visible, so the auto-focus shows
            // the field outline without a pointer-vs-keyboard heuristic.
            className={cn(
              DATA,
              SLOT,
              FOCUS_FIELD,
              "-mr-1 h-4 rounded-[3px] border border-edge bg-grey-880 px-1 text-grey-100",
            )}
          />
        ) : (
          <button
            type="button"
            onClick={startEdit}
            title="Click to edit"
            // Hairline underline on hover = the click-to-edit affordance.
            className={cn(
              DATA,
              SLOT,
              FOCUS,
              "-mr-1 h-4 cursor-text rounded-[3px] px-1 text-grey-200 transition-colors hover:text-grey-100 hover:shadow-[inset_0_-1px_0_var(--color-grey-500)]",
            )}
          >
            {value}
          </button>
        )}
      </div>
      <UISlider
        value={[value]}
        min={min}
        max={max}
        step={step}
        onValueChange={(v) => {
          const n = Array.isArray(v) ? v[0] : v;
          if (typeof n === "number") onChange(n);
        }}
      />
    </div>
  );
}

export const SliderRow = memo(SliderRowInner);
SliderRow.displayName = "SliderRow";
