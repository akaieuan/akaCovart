"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Slider as UISlider } from "@/components/ui/slider";
import { Switch as UISwitch } from "@/components/ui/switch";
import { Input as UIInput } from "@/components/ui/input";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

// Shared micro-typography for every label/value in the panel.
const MICRO = "font-sans text-[11px] font-normal";

// ── Micro-label ──────────────────────────────────────────────────────────────
export function Label({
  children,
  sub,
  className,
}: {
  children: ReactNode;
  sub?: boolean;
  className?: string;
}) {
  return (
    <span className={cn(MICRO, sub ? "text-grey-350" : "text-grey-300", className)}>
      {children}
    </span>
  );
}

// ── Group sub-heading ────────────────────────────────────────────────────────
export function GroupLabel({
  children,
  variant = "default",
}: {
  children: ReactNode;
  variant?: "default" | "sub" | "beat";
}) {
  if (variant === "sub") {
    return <div className={cn(MICRO, "mb-2 text-grey-350")}>{children}</div>;
  }
  if (variant === "beat") {
    return (
      <div
        className={cn(
          "mb-[14px] font-sans text-[12px] font-medium text-grey-350",
        )}
      >
        {children}
      </div>
    );
  }
  return <div className={cn(MICRO, "mt-[18px] mb-3 font-medium text-grey-300")}>{children}</div>;
}

export function Divider() {
  return <div className="my-4 h-px bg-border-soft" />;
}

// ── Slider row (shadcn Slider + click-to-edit value) ─────────────────────────
export function SliderRow({
  label,
  value,
  min,
  max,
  step = 1,
  sub,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  sub?: boolean;
  onChange: (v: number) => void;
}) {
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
    <div className="mb-4">
      <div className="mb-2 flex items-baseline justify-between">
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
            className="w-[44px] rounded-[2px] border border-grey-600 bg-grey-880 px-1 text-right font-sans text-[11px] font-normal text-grey-100 outline-none"
          />
        ) : (
          <button
            type="button"
            onClick={startEdit}
            title="Click to edit"
            className="cursor-text bg-transparent font-sans text-[11px] font-normal text-grey-150 hover:text-grey-100"
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

// ── Toggle row (label + shadcn Switch) ───────────────────────────────────────
export function ToggleRow({
  label,
  value,
  onChange,
}: {
  label: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="mt-[18px] mb-3 flex items-center justify-between">
      <Label className="!text-grey-300">{label}</Label>
      <UISwitch checked={value} onCheckedChange={onChange} />
    </div>
  );
}

// ── Segmented control (shadcn ToggleGroup, single-select) ─────────────────────
export interface SegOption {
  value: string;
  label: string;
}

export function Segmented({
  value,
  options,
  onChange,
  className,
}: {
  value: string;
  options: SegOption[];
  onChange: (v: string) => void;
  className?: string;
}) {
  return (
    <ToggleGroup
      value={[value]}
      onValueChange={(vals) => {
        const next = vals[0];
        // Ignore deselect (clicking the active segment) — keep one selected.
        if (typeof next === "string") onChange(next);
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

// ── Text input (shadcn Input, mono micro-type) ───────────────────────────────
export function TextRow({
  value,
  placeholder,
  muted,
  onChange,
  className,
}: {
  value: string;
  placeholder?: string;
  muted?: boolean;
  onChange: (v: string) => void;
  className?: string;
}) {
  return (
    <UIInput
      type="text"
      value={value}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      className={cn(
        "h-[38px] rounded-[3px] border-grey-780 bg-grey-880 px-3 font-sans text-[12px] text-ink",
        muted ? "font-normal text-grey-200" : "font-medium",
        className,
      )}
    />
  );
}
