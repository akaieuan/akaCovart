"use client";

import { useRef, useState } from "react";
import { Check, ChevronDown, Download, Eye, Proportions, SlidersHorizontal } from "lucide-react";

import { listEnginesByFocus } from "@/engine";
import { useStudio } from "@/lib/store";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import StartGrid from "./StartGrid";

type Focus = "art" | "txt";

const FOCUS_OPTIONS: { value: Focus; label: string; hint: string }[] = [
  { value: "art", label: "Art", hint: "Abstract generative fields" },
  { value: "txt", label: "TxT", hint: "Type as the subject" },
];

// First registered engine for a focus (fallbacks keep this safe pre-registration).
function defaultEngine(focus: Focus): string {
  return listEnginesByFocus(focus)[0]?.id ?? (focus === "txt" ? "dither" : "blob");
}

/**
 * Focus switcher — flips the studio between the Art (abstract field) engines and
 * the TxT (type-driven) engines. A small dropdown next to the wordmark, so it
 * sits "above the sidebar" on desktop and at the top of the page on mobile (the
 * header is the same element in both layouts). Remembers the last-used engine in
 * each focus so round-trips feel natural.
 */
function FocusMenu() {
  const focus = useStudio((s) => s.focus);
  const setState = useStudio((s) => s.setState);
  const [open, setOpen] = useState(false);
  // Per-focus engine memory (component-scoped; seeded with the defaults).
  const lastEngine = useRef<Record<Focus, string>>({ art: "blob", txt: "dither" });

  const pick = (next: Focus) => {
    setOpen(false);
    if (next === focus) return;
    const cur = useStudio.getState();
    // Stash the engine we're leaving, restore (or default) the one we're entering.
    lastEngine.current[cur.focus as Focus] = cur.engine;
    const remembered = lastEngine.current[next];
    const known = listEnginesByFocus(next).some((e) => e.id === remembered);
    setState({ focus: next, engine: known ? remembered : defaultEngine(next) });
  };

  const active = FOCUS_OPTIONS.find((o) => o.value === focus) ?? FOCUS_OPTIONS[0];

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        className="inline-flex cursor-pointer items-center gap-0.5 rounded-md px-1.5 py-1 text-[12px] font-medium text-grey-300 transition-colors hover:text-grey-100"
        aria-label={`Focus: ${active.label}`}
      >
        <span>{active.label}</span>
        <ChevronDown className="size-3 text-grey-500" />
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
                "flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left transition-colors",
                on ? "bg-white/[0.07]" : "hover:bg-white/5",
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
                <span className="text-[13px] font-medium text-grey-100">{o.label}</span>
                <span className="text-[11px] text-grey-400">{o.hint}</span>
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
      <PopoverTrigger
        className="inline-flex cursor-pointer items-center gap-0.5 rounded-md px-1.5 py-1 text-[12px] font-medium text-grey-300 transition-colors hover:text-grey-100"
        aria-label="Starting points"
      >
        <span>Starts</span>
        <ChevronDown className="size-3 text-grey-500" />
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
    <header className="pointer-events-none absolute inset-x-0 top-0 z-40 flex items-center justify-between gap-2 px-3 py-2.5 sm:px-5">
      <div className="pointer-events-auto flex min-w-0 items-center gap-1.5 sm:gap-3">
        <button
          type="button"
          onClick={onHome}
          aria-label="Back to start"
          className="inline-flex cursor-pointer items-baseline select-none transition-opacity hover:opacity-70"
        >
          <span className="text-[15px] font-light text-grey-350">aka</span>
          <span className="text-[15px] font-semibold text-grey-100">COVART</span>
        </button>

        <FocusMenu />
        <StartMenu />
      </div>

      <div className="pointer-events-auto flex shrink-0 items-center gap-1.5 sm:gap-2">
        <nav className="flex items-center gap-0.5 rounded-full border border-white/10 bg-panel/70 p-0.5 shadow-[0_8px_30px_rgba(0,0,0,0.45)] backdrop-blur-xl">
          {items.map(({ key, label, Icon, onClick, active }) => (
            <button
              key={key}
              type="button"
              onClick={onClick}
              aria-label={label}
              aria-pressed={active}
              className={cn(
                "inline-flex h-[26px] items-center gap-1 rounded-full px-2.5 text-[11px] font-medium transition-colors",
                active
                  ? "bg-grey-100 text-bg"
                  : "text-grey-300 hover:bg-white/5 hover:text-white",
              )}
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
          className="inline-flex size-8 shrink-0 items-center justify-center rounded-full bg-grey-100 text-bg shadow-[0_8px_30px_rgba(0,0,0,0.45)] transition-colors hover:bg-white active:scale-95 md:hidden"
        >
          <Download className="size-[15px]" />
        </button>
      </div>
    </header>
  );
}
