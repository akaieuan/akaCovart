"use client";

import { useEffect } from "react";
import { ArrowLeft, Film, ImageIcon } from "lucide-react";

import { useStudio } from "@/lib/store";
import { FORMATS, getFormat, type Format } from "@/lib/formats";
import { cn } from "@/lib/utils";

import { FormatCanvas } from "@/components/canvas";

// ── Preview overlay ──────────────────────────────────────────────────────────
// Full-screen sibling of the Formats overlay. Shows the CURRENT artwork as a
// still AND a live animation side-by-side for the active format, then the same
// art across every other delivery format as crisp stills in a reflowing bento.
//
// PERFORMANCE: exactly ONE `animated` FormatCanvas is mounted (the Motion hero).
// Everything else is a still — animation drives a per-frame render loop and does
// not scale to a whole grid.

// A hero tile: the format aspect with a labelled corner tag over a scrim.
function Hero({
  f,
  label,
  icon,
  animated,
}: {
  f: Format;
  label: string;
  icon: React.ReactNode;
  animated?: boolean;
}) {
  return (
    <figure className="group relative min-w-0 flex-1 overflow-hidden rounded-[9px] border border-border bg-black">
      <div
        className="relative w-full"
        style={{ aspectRatio: `${f.w} / ${f.h}` }}
      >
        <FormatCanvas
          format={f}
          animated={animated}
          maxPx={720}
          className="block h-full w-full"
        />
      </div>

      {/* Corner tag: which view this is (Still / Motion). */}
      <figcaption className="pointer-events-none absolute left-2.5 top-2.5 z-10 inline-flex items-center gap-1.5 rounded-full bg-black/55 px-2.5 py-[5px] text-[11px] font-medium text-grey-100 backdrop-blur-sm">
        {icon}
        {label}
      </figcaption>
    </figure>
  );
}

// A still bento tile for a non-active format — full-bleed art in its true aspect
// with the Formats-style bottom scrim (label / hint + ratio).
function StillTile({ f }: { f: Format }) {
  return (
    <div
      className="group relative overflow-hidden rounded-[9px] border border-border bg-black transition-colors hover:border-grey-500"
      style={{ aspectRatio: `${f.w} / ${f.h}` }}
    >
      <div className="absolute inset-0">
        <FormatCanvas
          format={f}
          maxPx={520}
          className="block h-full w-full"
        />
      </div>

      {/* Bottom scrim: name / hint + ratio, legible over any art. */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 flex items-end justify-between bg-gradient-to-t from-black/80 via-black/35 to-transparent p-2.5 pt-10">
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
 * Preview overlay. Opens over the studio when `showPreview` is true; shows the
 * current art as a still + live motion for the active format, plus every other
 * format as a still. Closes back to the editor (Escape or the "← Edit" button).
 */
export default function Preview() {
  const open = useStudio((s) => s.showPreview);
  const activeId = useStudio((s) => s.format);
  const setState = useStudio((s) => s.setState);

  const active = getFormat(activeId);
  const others = FORMATS.filter((f) => f.id !== active.id);

  const close = () => setState({ showPreview: false });

  // Close on Escape while open.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setState({ showPreview: false });
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, setState]);

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
      {/* Header — sibling of the Formats header. */}
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
            <div className="text-[14px] font-medium text-grey-100">Preview</div>
            <div className="hidden text-[11px] text-grey-400 sm:block">
              Still + motion, every format at a glance.
            </div>
          </div>
        </div>
      </header>

      {/* Body — centered, reflowing, styled scrollbar. Heavy canvases (incl. the
          live Motion loop) only mount while OPEN, so a closed Preview never
          renders in the background while the user edits. */}
      <div className="pnl min-h-0 flex-1 overflow-y-auto p-4 sm:p-6">
        {open && (
        <div className="mx-auto flex max-w-[1100px] flex-col gap-8">
          {/* Still vs Motion comparison of the ACTIVE format. */}
          <section>
            <div className="mb-3 flex items-baseline justify-between gap-3">
              <h2 className="text-[12px] font-medium text-grey-200">
                Still vs Motion
              </h2>
              <span className="text-[11px] text-grey-400">
                {active.label} · {active.ratio}
              </span>
            </div>
            {/* Stack on narrow screens; side-by-side from sm up. */}
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
              <Hero
                f={active}
                label="Still"
                icon={<ImageIcon className="size-[12px]" />}
              />
              <Hero
                f={active}
                label="Motion"
                icon={<Film className="size-[12px]" />}
                animated
              />
            </div>
          </section>

          {/* Bento of the OTHER formats as stills. */}
          {others.length > 0 && (
            <section>
              <div className="mb-3 flex items-baseline justify-between gap-3">
                <h2 className="text-[12px] font-medium text-grey-200">
                  Other formats
                </h2>
                <span className="text-[11px] text-grey-400">
                  {others.length} sizes
                </span>
              </div>
              <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
                {others.map((f) => (
                  <StillTile key={f.id} f={f} />
                ))}
              </div>
            </section>
          )}
        </div>
        )}
      </div>
    </div>
  );
}
