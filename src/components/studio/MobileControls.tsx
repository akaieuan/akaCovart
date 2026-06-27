"use client";

// ─────────────────────────────────────────────────────────────────────────────
// MobileControls — small-screen control dock (below md).
//
// A fixed bottom dock with a horizontal section-tab strip; the params live in a
// FIXED-HEIGHT panel so switching tabs causes zero page movement. The section
// BODIES are the SAME shared atomic components the desktop sidebar uses
// (components/controls/sections), so there is one source of truth — this file
// only owns the mobile dock chrome (tabs + collapse + footer).
// ─────────────────────────────────────────────────────────────────────────────

import { useState, type ComponentType } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";

import { useStudio } from "@/lib/store";
import { cn } from "@/lib/utils";
import {
  LookSection,
  CompositionSection,
  TextureSection,
  TypeSection,
  MotionSection,
  StackTextSection,
  StackMotionSection,
} from "@/components/controls/sections";

import EngineSelector from "./EngineSelector";
import { SeedRow } from "./SeedRow";
import { ModeToggle } from "./ModeToggle";
import { ResetButton } from "./ResetButton";
import { ExportButton } from "./ExportButton";

// Engine selector + seed live together in the mobile "Engine" tab.
function EngineBody() {
  return (
    <div className="flex flex-col gap-3">
      <EngineSelector />
      <SeedRow />
    </div>
  );
}

type Tab = { id: string; label: string; Body: ComponentType };

export default function MobileControls({ onExport }: { onExport: () => void }) {
  const mode = useStudio((s) => s.mode);
  const focus = useStudio((s) => s.focus);
  const showFormats = useStudio((s) => s.showFormats);
  const showPreview = useStudio((s) => s.showPreview);
  const overlayOpen = showFormats || showPreview;

  // Focus-aware tabs (same shared section bodies as desktop). TxT renders smooth
  // (no Texture tab); Stack composites a type layer over the art bg, so its type
  // tab is the Stack Text layer and its motion tab is the Stack motion panel.
  const stack = focus === "stack";
  const stillTabs: Tab[] = [
    { id: "engine", label: "Engine", Body: EngineBody },
    { id: "look", label: "Look", Body: LookSection },
    { id: "composition", label: stack ? "Background" : "Compose", Body: CompositionSection },
    ...(focus !== "txt"
      ? [{ id: "texture", label: "Texture", Body: TextureSection } as Tab]
      : []),
    { id: "type", label: stack ? "Text" : "Type", Body: stack ? StackTextSection : TypeSection },
  ];
  const animTabs: Tab[] = [
    { id: "engine", label: "Engine", Body: EngineBody },
    { id: "motion", label: "Motion", Body: stack ? StackMotionSection : MotionSection },
  ];
  const tabs = mode === "animate" ? animTabs : stillTabs;
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
        // RESERVES its height — the artwork always sits fully visible above it.
        // Lifted off the bottom with safe-area padding; lifted further when
        // collapsed so the toggle clears browser chrome and stays in thumb reach.
        "z-30 flex-none px-3 pt-2 transition-[padding,opacity] duration-300 md:hidden",
        collapsed
          ? "pb-[calc(env(safe-area-inset-bottom)+34px)]"
          : "pb-[calc(env(safe-area-inset-bottom)+10px)]",
        overlayOpen && "pointer-events-none opacity-0",
      )}
    >
      <div className="flex flex-col overflow-hidden rounded-2xl border border-white/10 bg-panel/95 shadow-[0_-8px_40px_rgba(0,0,0,0.5)] backdrop-blur-2xl">
        {/* Nav row: scrollable tabs (incl. Engine) + collapse toggle. */}
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
          <button
            type="button"
            onClick={() => setCollapsed((c) => !c)}
            aria-label={collapsed ? "Expand controls" : "Collapse controls"}
            aria-expanded={!collapsed}
            className="flex-none rounded-full bg-white/8 px-3 py-2 text-grey-200 transition-colors hover:bg-white/15 hover:text-white active:scale-95"
          >
            {collapsed ? <ChevronUp className="size-5" /> : <ChevronDown className="size-5" />}
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
              {/* Still download lives in the top bar (Export → Formats); the dock
                  only carries the VIDEO export button (Formats can't produce it). */}
              {mode === "animate" && <ExportButton onExport={onExport} />}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
