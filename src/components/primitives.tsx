"use client";

import { type ReactNode } from "react";

// ── Micro-label ──────────────────────────────────────────────────────────────
export function Label({
  children,
  sub,
  className = "",
}: {
  children: ReactNode;
  sub?: boolean;
  className?: string;
}) {
  return (
    <span
      className={
        "font-mono text-[9px] font-medium tracking-[0.14em] " +
        (sub ? "text-grey-350 " : "text-grey-300 ") +
        className
      }
    >
      {children}
    </span>
  );
}

// ── Collapsible section ──────────────────────────────────────────────────────
export function Section({
  title,
  open,
  onToggle,
  children,
}: {
  title: string;
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
}) {
  return (
    <div className="border-b border-[#161619]">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center justify-between bg-transparent px-5 py-[15px] font-mono text-[9px] font-semibold tracking-[0.22em] text-grey-250"
      >
        {title}
        <span className="font-mono text-[14px] font-normal text-grey-350">
          {open ? "−" : "+"}
        </span>
      </button>
      {open && <div className="px-5 pb-[18px]">{children}</div>}
    </div>
  );
}

// ── Slider ───────────────────────────────────────────────────────────────────
export function Slider({
  label,
  value,
  min,
  max,
  step = 1,
  sub,
  last,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  sub?: boolean;
  last?: boolean;
  onChange: (v: number) => void;
}) {
  return (
    <div className={last ? "mb-0" : "mb-4"}>
      <div className="mb-2 flex items-baseline justify-between">
        <Label sub={sub} className="!text-grey-300">
          <span dangerouslySetInnerHTML={{ __html: label }} />
        </Label>
        <span className="font-mono text-[10px] font-medium text-grey-150">
          {value}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </div>
  );
}

// ── Toggle ───────────────────────────────────────────────────────────────────
export function Toggle({
  label,
  value,
  onChange,
}: {
  label: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="my-[18px] mb-3 flex items-center justify-between">
      <Label className="!text-grey-300">{label}</Label>
      <button
        type="button"
        onClick={() => onChange(!value)}
        className={
          "inline-flex items-center rounded-full border px-3 py-[5px] font-mono text-[9px] font-semibold tracking-[0.14em] " +
          (value
            ? "border-grey-500 bg-grey-600 text-grey-100"
            : "border-grey-800 bg-transparent text-grey-350")
        }
      >
        {value ? "ON" : "OFF"}
      </button>
    </div>
  );
}

// ── Segmented control ────────────────────────────────────────────────────────
export interface SegOption {
  value: string;
  label: string;
}

export function Segmented({
  value,
  options,
  onChange,
  className = "",
}: {
  value: string;
  options: SegOption[];
  onChange: (v: string) => void;
  className?: string;
}) {
  return (
    <div className={"flex gap-[6px] " + className}>
      {options.map((op) => {
        const active = value === op.value;
        return (
          <button
            key={op.value}
            type="button"
            onClick={() => onChange(op.value)}
            className={
              "flex-1 rounded-[3px] border px-0 py-2 text-center font-mono text-[9px] font-medium tracking-[0.12em] uppercase transition-colors " +
              (active
                ? "border-grey-500 bg-grey-600 text-grey-100"
                : "border-grey-800 bg-transparent text-grey-350 hover:border-grey-500")
            }
          >
            {op.label}
          </button>
        );
      })}
    </div>
  );
}

// ── Text input ───────────────────────────────────────────────────────────────
export function TextInput({
  value,
  placeholder,
  artist,
  onChange,
}: {
  value: string;
  placeholder?: string;
  artist?: boolean;
  onChange: (v: string) => void;
}) {
  return (
    <input
      type="text"
      value={value}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      className={
        "h-[38px] w-full rounded-[3px] border border-grey-780 bg-grey-880 px-3 font-mono text-[11px] tracking-[0.1em] text-ink outline-none " +
        (artist
          ? "mb-[14px] font-normal !text-[#b8b8bc]"
          : "mb-[9px] font-semibold")
      }
    />
  );
}

// ── Group label / divider ────────────────────────────────────────────────────
export function GroupLabel({
  children,
  variant,
}: {
  children: ReactNode;
  variant?: "sub" | "beat";
}) {
  if (variant === "sub") {
    return (
      <div className="mb-2 font-mono text-[9px] font-medium tracking-[0.14em] text-grey-350">
        {children}
      </div>
    );
  }
  if (variant === "beat") {
    return (
      <div className="mb-[14px] font-mono text-[9px] font-semibold tracking-[0.18em] text-grey-350">
        {children}
      </div>
    );
  }
  return (
    <div className="my-[18px] mb-3 font-mono text-[9px] font-medium tracking-[0.14em] text-grey-300">
      {children}
    </div>
  );
}

export function Divider() {
  return <div className="my-4 h-px bg-[#161619]" />;
}
