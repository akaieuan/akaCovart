"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowLeft, Check, Download, Loader2 } from "lucide-react";

import { renderFormatTo } from "@/engine";
import { renderParams, useStudio } from "@/lib/store";
import { exportFormat } from "@/lib/export";
import { FORMATS, getFormat, type Format, fitDims } from "@/lib/formats";
import { ensureCoverFont } from "@/lib/fonts";
import { cn } from "@/lib/utils";

// Longest edge of each preview canvas (cheap; the square is re-rendered per tile).
const PREVIEW_PX = 640;

// Hand-balanced bento columns (by format id). Tile heights vary wildly by aspect
// (a 9:16 is ~3× a 3:1), so we place them into columns of roughly equal height
// instead of letting auto-masonry leave gaps. On mobile the columns stack in
// order, so Square (the cover) still leads.
const COLUMNS: string[][] = [
  ["square", "landscape"],
  ["story"],
  ["portrait", "wide"],
];

function FormatTile({
  f,
  open,
  active,
  onFocus,
}: {
  f: Format;
  open: boolean;
  active: boolean;
  onFocus: () => void;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  const [busy, setBusy] = useState(false);

  // Paint the preview when the overlay opens (and re-paint each re-open so it
  // always reflects the latest art). Reads fresh state so it never goes stale.
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    const c = ref.current;
    if (!c) return;
    const { w, h } = fitDims(f, PREVIEW_PX);
    c.width = w;
    c.height = h;
    const params = renderParams(useStudio.getState());
    ensureCoverFont(params.textFont as string).then(() => {
      if (cancelled) return;
      requestAnimationFrame(() => {
        if (cancelled) return;
        renderFormatTo(c, params);
      });
    });
    return () => {
      cancelled = true;
    };
  }, [open, f]);

  const handleExport = () => {
    if (busy) return;
    setBusy(true);
    exportFormat(useStudio.getState(), f, () => setBusy(false));
  };

  return (
    <div
      className={cn(
        "group relative overflow-hidden rounded-[9px] border bg-black transition-colors",
        active
          ? "border-grey-200 ring-1 ring-grey-200"
          : "border-border hover:border-grey-500",
      )}
      style={{ aspectRatio: `${f.w} / ${f.h}` }}
    >
      {/* Full-bleed preview — the tile IS the format aspect, so the crop is exact
          and there's no dead space. */}
      <canvas
        ref={ref}
        className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
      />

      {/* Full-tile click = focus this format and return to editing in it. */}
      <button
        type="button"
        onClick={onFocus}
        aria-label={`Edit in ${f.label} (${f.ratio})`}
        className="absolute inset-0 z-10 cursor-pointer"
      />

      {/* Top row: active pill + export. */}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-20 flex items-start justify-between p-2.5">
        {active ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-grey-100 px-2 py-[3px] text-[10px] font-medium text-bg shadow-[0_2px_8px_rgba(0,0,0,0.4)]">
            <Check className="size-[11px]" /> Editing
          </span>
        ) : (
          <span />
        )}
        <button
          type="button"
          onClick={handleExport}
          disabled={busy}
          aria-label={`Export ${f.label}`}
          className="pointer-events-auto inline-flex h-8 items-center gap-1.5 rounded-[5px] border border-white/15 bg-black/55 px-2.5 text-[11px] font-medium text-grey-100 opacity-0 backdrop-blur-sm transition-all hover:bg-black/80 hover:text-white focus-visible:opacity-100 group-hover:opacity-100 disabled:opacity-100"
        >
          {busy ? (
            <Loader2 className="size-[12px] animate-spin" />
          ) : (
            <Download className="size-[12px]" />
          )}
          {busy ? "Saving…" : "Export"}
        </button>
      </div>

      {/* Bottom row: name / hint + ratio over a scrim for legibility on any art. */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 flex items-end justify-between bg-gradient-to-t from-black/80 via-black/35 to-transparent p-2.5 pt-10">
        <div className="leading-tight">
          <div className="text-[12px] font-medium text-white drop-shadow-[0_1px_3px_rgba(0,0,0,0.7)]">
            {f.label}
          </div>
          <div className="text-[10px] text-grey-200 drop-shadow-[0_1px_3px_rgba(0,0,0,0.7)]">
            {f.hint}
          </div>
        </div>
        <div className="text-[11px] tabular-nums text-grey-100 drop-shadow-[0_1px_3px_rgba(0,0,0,0.7)]">
          {f.ratio}
        </div>
      </div>
    </div>
  );
}

/**
 * Multi-format bento overlay. Opens over the studio (sidebar slides away),
 * shows the current art rendered into every delivery format. Each tile exports
 * its size with a button, or click the tile to FOCUS that format and fluidly
 * drop back into the editor working in it.
 */
export default function Formats() {
  const open = useStudio((s) => s.showFormats);
  const activeFormat = useStudio((s) => s.format);
  const setState = useStudio((s) => s.setState);
  const [busyAll, setBusyAll] = useState(false);

  const close = () => setState({ showFormats: false });
  const focus = (id: string) => setState({ format: id, showFormats: false });

  // Close on Escape while open.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setState({ showFormats: false });
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, setState]);

  // Export every format, spacing the downloads so the browser keeps them all.
  const exportAll = () => {
    if (busyAll) return;
    setBusyAll(true);
    const run = (i: number) => {
      if (i >= FORMATS.length) {
        setBusyAll(false);
        return;
      }
      exportFormat(useStudio.getState(), FORMATS[i], () =>
        setTimeout(() => run(i + 1), 280),
      );
    };
    run(0);
  };

  return (
    <div
      aria-hidden={!open}
      className={cn(
        "absolute inset-0 z-50 flex flex-col bg-bg transition-all duration-300 ease-out",
        open
          ? "pointer-events-auto opacity-100 scale-100"
          : "pointer-events-none scale-[0.99] opacity-0",
      )}
    >
      {/* Header */}
      <header className="flex flex-none items-center justify-between gap-3 border-b border-border px-5 py-4 sm:px-7">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={close}
            className="inline-flex h-9 items-center gap-1.5 rounded-[6px] border border-border bg-panel px-3 text-[12px] font-normal text-grey-200 transition-colors hover:bg-grey-900 hover:text-white"
          >
            <ArrowLeft className="size-[15px]" />
            Edit
          </button>
          <div className="leading-tight">
            <div className="text-[14px] font-medium text-grey-100">Formats</div>
            <div className="hidden text-[11px] text-grey-400 sm:block">
              Click a format to keep editing in it, or export any size.
            </div>
          </div>
        </div>
        <button
          type="button"
          onClick={exportAll}
          disabled={busyAll}
          className="inline-flex h-9 items-center gap-2 rounded-[6px] bg-grey-100 px-3.5 text-[12px] font-medium text-bg transition-colors hover:bg-white disabled:opacity-70"
        >
          {busyAll ? (
            <Loader2 className="size-[14px] animate-spin" />
          ) : (
            <Download className="size-[14px]" />
          )}
          {busyAll ? "Exporting…" : "Export all"}
        </button>
      </header>

      {/* Bento — balanced columns; each tile keeps its true aspect, no dead space. */}
      <div className="pnl min-h-0 flex-1 overflow-y-auto p-4 sm:p-6">
        <div className="mx-auto flex max-w-[1040px] flex-col gap-4 md:flex-row md:items-start">
          {COLUMNS.map((col, i) => (
            <div key={i} className="flex flex-1 flex-col gap-4">
              {col.map((id) => {
                const f = getFormat(id);
                return (
                  <FormatTile
                    key={id}
                    f={f}
                    open={open}
                    active={f.id === activeFormat}
                    onFocus={() => focus(f.id)}
                  />
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
