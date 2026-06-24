"use client";

// ─────────────────────────────────────────────────────────────────────────────
// MobileControls — small-screen control dock (below md).
//
// Replaces the right-side drawer with a fixed bottom dock so params are reachable
// without leaving the canvas. A HORIZONTAL section-tab strip swaps which section
// is shown; the params live in a FIXED-HEIGHT panel so switching tabs causes zero
// page movement (the canvas above never reflows). Animate mode shows the shared
// <Controls/> motion panel directly.
//
// Self-contained on purpose: it reuses the data config + primitives + leaf
// components (all stable exports) and mirrors the section composition locally, so
// the frequently-rewritten Controls.tsx can't clobber it. The single source of
// truth for the PARAMS themselves stays controls-config.ts.
// ─────────────────────────────────────────────────────────────────────────────

import { useState, type ReactNode } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";

import { useStudio } from "@/lib/store";
import { cn } from "@/lib/utils";
import {
  GroupLabel,
  SliderRow,
  ToggleRow,
  Segmented,
  ColorPicker,
  FontPicker,
  TextRow,
} from "@/components/controls/primitives";
import Gallery from "@/components/controls/Gallery";
import { Presets } from "@/components/controls/Presets";
import { PositionGrid } from "@/components/controls/PositionGrid";
import { Controls } from "@/components/controls";
import {
  type Control,
  type ControlGroup,
  MOOD_OPTIONS,
  COLOR_TONE_GROUP,
  COMPOSITION_BY_ENGINE,
  FINISH_GROUP,
  TEXTURE_GROUPS,
  TEXT_CASE_OPTIONS,
  TEXT_COLOR_OPTIONS,
  TEXT_FONT_OPTIONS,
} from "@/components/controls/controls-config";

import EngineSelector from "./EngineSelector";
import { SeedRow } from "./SeedRow";
import { ModeToggle } from "./ModeToggle";
import { ResetButton } from "./ResetButton";
import { ExportButton } from "./ExportButton";

// ── DRY render core (mirrors Controls.tsx) ───────────────────────────────────
function renderControl(c: Control): ReactNode {
  switch (c.kind) {
    case "slider":
      return (
        <SliderRow
          key={c.key}
          paramKey={c.key}
          label={c.label}
          min={c.min}
          max={c.max}
          step={c.step}
          sub={c.sub}
        />
      );
    case "toggle":
      return <ToggleRow key={c.key} paramKey={c.key} label={c.label} />;
    case "segmented":
      return <Segmented key={c.key} paramKey={c.key} options={c.options} />;
    case "text":
      return (
        <TextRow
          key={c.key}
          paramKey={c.key}
          placeholder={c.placeholder}
          muted={c.muted}
        />
      );
  }
}

function renderGroups(groups: ControlGroup[]): ReactNode {
  return groups.map((g, gi) => (
    <div key={g.heading ?? gi}>
      {g.heading && <GroupLabel>{g.heading}</GroupLabel>}
      {g.controls.map((c) => renderControl(c))}
    </div>
  ));
}

// ── Section bodies (composition mirrors Controls.tsx; params come from config) ─
function StartBody() {
  return (
    <>
      <Presets />
      <Gallery />
    </>
  );
}

function PaletteBody() {
  return (
    <>
      <Segmented paramKey="mood" options={MOOD_OPTIONS} className="mb-[14px]" />
      <ColorPicker paramKey="colorPick" label="Color" />
      {renderGroups([COLOR_TONE_GROUP])}
    </>
  );
}

function ComposeBody() {
  const engine = useStudio((s) => s.engine);
  return (
    <>
      {renderGroups(COMPOSITION_BY_ENGINE[engine] ?? [])}
      {renderGroups([FINISH_GROUP])}
    </>
  );
}

function TextureBody() {
  return <>{renderGroups(TEXTURE_GROUPS)}</>;
}

function TypeBody() {
  return (
    <>
      <ToggleRow label="Render text" paramKey="showText" />
      <TextRow paramKey="title" placeholder="Title" className="mb-[9px]" />
      <TextRow paramKey="artist" placeholder="Artist" muted className="mb-[14px]" />
      <GroupLabel variant="sub">Font</GroupLabel>
      <FontPicker className="mb-[14px]" paramKey="textFont" options={TEXT_FONT_OPTIONS} />
      <GroupLabel variant="sub">Case</GroupLabel>
      <Segmented className="mb-[14px]" paramKey="textCase" options={TEXT_CASE_OPTIONS} />
      <SliderRow label="Distort / glitch" paramKey="distort" min={0} max={100} sub />
      <GroupLabel variant="sub">Color</GroupLabel>
      <Segmented className="mb-[14px]" paramKey="textColor" options={TEXT_COLOR_OPTIONS} />
      <PositionGrid />
    </>
  );
}

function EngineBody() {
  return (
    <div className="flex flex-col gap-3">
      <EngineSelector />
      <SeedRow />
    </div>
  );
}

// Animate mode reuses the shared Controls motion panel (Beat / Drift / Motion /
// Auto / audio) so there is exactly one source of truth for motion params.
function MotionBody() {
  return <Controls />;
}

type Tab = { id: string; label: string; Body: () => ReactNode };

const STILL_TABS: Tab[] = [
  { id: "engine", label: "Engine", Body: EngineBody },
  { id: "library", label: "Looks", Body: StartBody },
  { id: "palette", label: "Palette", Body: PaletteBody },
  { id: "composition", label: "Compose", Body: ComposeBody },
  { id: "texture", label: "Texture", Body: TextureBody },
  { id: "type", label: "Type", Body: TypeBody },
];

const ANIM_TABS: Tab[] = [
  { id: "engine", label: "Engine", Body: EngineBody },
  { id: "motion", label: "Motion", Body: MotionBody },
];

export default function MobileControls({ onExport }: { onExport: () => void }) {
  const mode = useStudio((s) => s.mode);
  const showFormats = useStudio((s) => s.showFormats);
  const showPreview = useStudio((s) => s.showPreview);
  const overlayOpen = showFormats || showPreview;

  const tabs = mode === "animate" ? ANIM_TABS : STILL_TABS;
  const [tab, setTab] = useState<string>("composition");
  const [collapsed, setCollapsed] = useState(false);
  // Tab state persists across STILL/ANIMATE swaps; clamp to a valid one.
  const activeId = tabs.some((t) => t.id === tab)
    ? tab
    : mode === "animate"
      ? "motion"
      : "composition";
  const ActiveBody = tabs.find((t) => t.id === activeId)!.Body;

  // Tapping a section always reveals it (auto-expand if collapsed).
  const pick = (id: string) => {
    setTab(id);
    setCollapsed(false);
  };

  return (
    <div
      className={cn(
        // In-flow bottom dock (a flex sibling of the canvas, not an overlay) so it
        // RESERVES its height — the artwork always sits fully visible above it and
        // never hides behind the controls. Lifted off the very bottom edge with
        // safe-area padding so the toggle clears the iOS home indicator / browser
        // chrome and stays in thumb reach. When COLLAPSED the dock is just the slim
        // tab bar, so we lift it further up the screen — easier to tap and clear of
        // the floating iOS Safari toolbar — without disturbing the expanded layout.
        "z-30 flex-none px-3 pt-2 transition-[padding,opacity] duration-300 md:hidden",
        collapsed
          ? "pb-[calc(env(safe-area-inset-bottom)+34px)]"
          : "pb-[calc(env(safe-area-inset-bottom)+10px)]",
        overlayOpen && "pointer-events-none opacity-0",
      )}
    >
      <div className="flex flex-col overflow-hidden rounded-2xl border border-white/10 bg-panel/95 shadow-[0_-8px_40px_rgba(0,0,0,0.5)] backdrop-blur-2xl">
        {/* Nav row: scrollable tabs (incl. Engine) + collapse toggle. Always shown,
            so when collapsed this slim bar is all that remains. */}
        <div className="flex flex-none items-center gap-1.5 px-2 py-2">
          <div className="flex flex-1 gap-1 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {tabs.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => pick(t.id)}
                aria-pressed={!collapsed && activeId === t.id}
                className={cn(
                  "flex-none rounded-full px-3.5 py-2 text-[12px] font-medium whitespace-nowrap transition-colors",
                  !collapsed && activeId === t.id
                    ? "bg-grey-100 text-bg"
                    : "text-grey-300 hover:bg-white/5 hover:text-white",
                )}
              >
                {t.label}
              </button>
            ))}
          </div>
          {/* Bigger, clearly-tappable expand/collapse target (was a tiny edge
              icon). Solid chip + larger icon so it reads as a button on touch. */}
          <button
            type="button"
            onClick={() => setCollapsed((c) => !c)}
            aria-label={collapsed ? "Expand controls" : "Collapse controls"}
            aria-expanded={!collapsed}
            className="flex-none rounded-full bg-white/8 px-3 py-2 text-grey-200 transition-colors hover:bg-white/15 hover:text-white active:scale-95"
          >
            {collapsed ? (
              <ChevronUp className="size-5" />
            ) : (
              <ChevronDown className="size-5" />
            )}
          </button>
        </div>

        {/* Params + footer collapse away to free the canvas. Params keep a FIXED
            height so switching tabs never moves the page; they scroll internally. */}
        {!collapsed && (
          <>
            <div className="pnl h-[30vh] max-h-[300px] min-h-[148px] overflow-y-auto overscroll-contain border-t border-white/[0.06] px-3 py-2.5">
              <ActiveBody />
            </div>
            <div className="flex flex-none flex-col gap-2 border-t border-white/[0.06] px-3 py-2.5">
              <div className="flex gap-2">
                <ModeToggle className="flex-1" />
                <ResetButton />
              </div>
              {/* Still-image download now lives in the top bar (Export → Formats),
                  so the dock only carries the export button for VIDEO, which the
                  Formats screen can't produce. Keeps the dock lean in Still mode. */}
              {mode === "animate" && <ExportButton onExport={onExport} />}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
