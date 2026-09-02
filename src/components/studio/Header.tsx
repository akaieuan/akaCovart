"use client";

import { useState } from "react";
import { Check, ChevronDown, Download, Eye, Proportions, SlidersHorizontal } from "lucide-react";

import { useStudio } from "@/lib/store";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { CONTROL, FOCUS, FOCUS_FIELD, MICRO, SECTION, TITLE } from "@/components/controls/primitives/typography";
import StartGrid from "./StartGrid";
import { FOCUS_OPTIONS, switchFocus, type Focus } from "./focus";

// One glass-pill recipe for both dropdown triggers. 26px on desktop; 40px on
// phones so the primary header controls clear the touch-target floor (the
// stage/picker reserve 64px of top padding to match).
const PILL = cn(
  CONTROL,
  FOCUS,
  // Hover/open TINT the glass (panel/85) rather than swapping the fill for a
  // white wash — a wash over bright artwork drops the label below AA.
  "group inline-flex h-[26px] max-sm:h-10 max-sm:px-3 cursor-pointer items-center gap-1 rounded-full border border-edge bg-panel/70 px-2.5 shadow-float backdrop-blur-xl transition-colors hover:border-edge-hover hover:bg-panel/85 active:bg-panel/85 aria-expanded:border-edge-hover aria-expanded:bg-panel/85",
);

// One view-nav item recipe (also the StartPicker Style pills). 36px items inside
// the 40px tray on phones. Fill carries the active state, not weight.
export const NAV_ITEM = cn(
  CONTROL,
  FOCUS,
  "inline-flex h-[26px] max-sm:h-10 max-sm:min-w-10 max-sm:px-3 items-center justify-center gap-1 rounded-full px-2.5 transition-colors",
);
export const NAV_IDLE = "text-grey-250 hover:bg-wash hover:text-grey-100 active:bg-wash-active";
export const NAV_ACTIVE = "bg-grey-100 text-bg";

/**
 * Style switcher — flips the studio between its lanes: Art (abstract fields),
 * Oil (painted landscapes), TxT (type-driven) and Stack (art + type). A small
 * dropdown next to the wordmark, so it
 * sits "above the sidebar" on desktop and at the top of the page on mobile (the
 * header is the same element in both layouts). The switch logic (and the
 * per-lane engine memory) lives in ./focus.ts, shared with the start screen.
 */
function FocusMenu() {
  const focus = useStudio((s) => s.focus);
  const [open, setOpen] = useState(false);

  const pick = (next: Focus) => {
    setOpen(false);
    switchFocus(next);
  };

  const active = FOCUS_OPTIONS.find((o) => o.value === focus) ?? FOCUS_OPTIONS[0];

  return (
    <Popover open={open} onOpenChange={setOpen}>
      {/* Glassy pill (same language as the view nav) so the style switcher reads
          as a CONTROL — as plain text nobody discovered TxT/Stack. The muted
          "Style" prefix names what the dropdown changes; hidden on phones where
          the header runs tight. */}
      <PopoverTrigger
        className={cn(PILL, "text-grey-100")}
        aria-label={`Style: ${active.label}`}
      >
        <span className="hidden text-grey-250 sm:inline">Style</span>
        <span>{active.label}</span>
        <ChevronDown className="size-3 text-grey-350 transition-transform group-aria-expanded:rotate-180 motion-reduce:transition-none" />
      </PopoverTrigger>
      <PopoverContent
        align="start"
        sideOffset={8}
        className="w-52 gap-1 p-1.5"
      >
        {FOCUS_OPTIONS.map((o) => {
          const on = o.value === focus;
          return (
            <button
              key={o.value}
              type="button"
              onClick={() => pick(o.value)}
              className={cn(
                FOCUS_FIELD,
                "flex w-full items-center gap-2.5 rounded-control px-2.5 py-2 text-left transition-colors hover:bg-wash active:bg-wash-active",
                on && "bg-wash-active",
              )}
            >
              <span
                className={cn(
                  "flex size-4 flex-none items-center justify-center",
                  on ? "text-grey-100" : "text-transparent",
                )}
              >
                <Check className="size-3.5" />
              </span>
              <span className="flex flex-col">
                <span className={cn(SECTION, "text-grey-100")}>{o.label}</span>
                <span className={cn(MICRO, "text-grey-300")}>{o.hint}</span>
              </span>
            </button>
          );
        })}
      </PopoverContent>
    </Popover>
  );
}

// "Starts" dropdown — re-open the focus-aware starting-point grid as a compact
// popover (mirrors the Focus dropdown beside it). Picking a tile loads it.
function StartMenu() {
  const setState = useStudio((s) => s.setState);
  const showStart = useStudio((s) => s.showStart);
  const [open, setOpen] = useState(false);
  // While the full-canvas starting-point picker is up (first run), the header
  // dropdown is redundant — only show it once a starting point is selected.
  if (showStart) return null;
  return (
    <Popover open={open} onOpenChange={setOpen}>
      {/* Same pill treatment as the Style switcher (muted text = secondary). */}
      <PopoverTrigger
        className={cn(PILL, "text-grey-250 hover:text-grey-100")}
        aria-label="Starting points"
      >
        <span>Starts</span>
        <ChevronDown className="size-3 text-grey-350 transition-transform group-aria-expanded:rotate-180 motion-reduce:transition-none" />
      </PopoverTrigger>
      <PopoverContent align="start" sideOffset={8} className="w-[300px] gap-0 p-2.5">
        <StartGrid
          className="gap-1.5"
          onPick={(look) => {
            setState({ ...look.params, showStart: false });
            setOpen(false);
          }}
        />
      </PopoverContent>
    </Popover>
  );
}

/**
 * Transparent floating header. Wordmark (click → home) + Focus switcher on the
 * left, a glassy nav pill on the right with three EQUAL view tabs:
 *  - Edit    → the editor (closes any overlay).
 *  - Formats → the multi-format bento.
 *  - Preview → the still + motion preview page.
 * Exactly one is active. (Collapsing the sidebar is a separate handle on the
 * panel itself, so these three stay consistent view switchers.)
 */
export default function Header({ onHome }: { onHome?: () => void }) {
  const showFormats = useStudio((s) => s.showFormats);
  const showPreview = useStudio((s) => s.showPreview);
  const setState = useStudio((s) => s.setState);

  const view = showFormats ? "formats" : showPreview ? "preview" : "edit";

  const goEdit = () => setState({ showFormats: false, showPreview: false });
  const goFormats = () => setState({ showFormats: true, showPreview: false });
  const goPreview = () => setState({ showPreview: true, showFormats: false });

  const items = [
    { key: "edit", label: "Edit", Icon: SlidersHorizontal, onClick: goEdit, active: view === "edit" },
    { key: "formats", label: "Formats", Icon: Proportions, onClick: goFormats, active: view === "formats" },
    { key: "preview", label: "Preview", Icon: Eye, onClick: goPreview, active: view === "preview" },
  ];

  return (
    <header className="pointer-events-none absolute inset-x-0 top-0 z-40 flex items-center justify-between gap-2 px-3 py-2.5 max-sm:py-2 sm:px-5">
      <div className="pointer-events-auto flex min-w-0 items-center gap-1.5 sm:gap-3">
        <button
          type="button"
          onClick={onHome}
          aria-label="Back to start"
          className={cn(FOCUS, "inline-flex cursor-pointer items-baseline rounded-[2px] select-none transition-opacity hover:opacity-70")}
        >
          <span className={cn(TITLE, "font-light text-grey-250")}>aka</span>
          <span className={cn(TITLE, "font-semibold text-grey-100")}>COVART</span>
        </button>

        <FocusMenu />
        <StartMenu />
      </div>

      <div className="pointer-events-auto flex shrink-0 items-center gap-1.5 sm:gap-2">
        {/* panel/85 (not /70): idle grey-250 items must stay AA over bright art.
            Phones: no tray padding so the 40px items ARE the 40px header line. */}
        <nav className="flex items-center gap-0.5 rounded-full border border-edge bg-panel/85 p-0.5 shadow-float backdrop-blur-xl max-sm:p-0">
          {items.map(({ key, label, Icon, onClick, active }) => (
            <button
              key={key}
              type="button"
              onClick={onClick}
              aria-label={label}
              aria-pressed={active}
              className={cn(NAV_ITEM, active ? NAV_ACTIVE : NAV_IDLE)}
            >
              <Icon className="size-[12px]" />
              <span className="hidden sm:inline">{label}</span>
            </button>
          ))}
        </nav>

        {/* Phone-only Export entry point. On small screens the artwork download
            lives up here (not in the edit dock) — tapping it opens the Formats
            screen to pick a size and download, which frees the dock for controls.
            On md+ the sidebar owns export, so this is hidden. */}
        <button
          type="button"
          onClick={goFormats}
          aria-label="Export"
          title="Export"
          className={cn(FOCUS, "inline-flex size-10 shrink-0 items-center justify-center rounded-full bg-grey-100 text-bg shadow-float transition-colors hover:bg-white active:bg-grey-200 md:hidden")}
        >
          <Download className="size-[15px]" />
        </button>
      </div>
    </header>
  );
}
