"use client";

import { memo, useEffect, useRef, useState } from "react";
import { Slider as UISlider } from "@/components/ui/slider";
import { useStudio } from "@/lib/store";
import { Label } from "./Label";
import type { NumKey } from "./keys";

// ── Slider row (shadcn Slider + click-to-edit value) ─────────────────────────
// Self-subscribing: reads ONLY its own numeric store slice via a narrow
// selector and writes through the stable `setState` action. Wrapped in
// React.memo so a tick on another slider never re-renders this row.
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
    <div className="mb-[18px]">
      <div className="mb-[7px] flex items-center justify-between gap-2">
        <Label sub={sub} className="!text-grey-300">
          {label}
        </Label>
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
            className="w-[52px] rounded-[4px] border border-grey-600 bg-grey-880/80 px-1.5 py-0.5 text-right font-sans text-[11px] font-medium tabular-nums text-grey-100 outline-none focus:border-grey-450"
          />
        ) : (
          <button
            type="button"
            onClick={startEdit}
            title="Click to edit"
            className="-mr-1.5 cursor-text rounded-[4px] bg-transparent px-1.5 py-0.5 font-sans text-[11px] font-medium tabular-nums text-grey-150 transition-colors hover:bg-grey-800/50 hover:text-grey-100"
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
