"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { Intro } from "@/components/intro";
import { Stage } from "@/components/canvas";
import { Controls } from "@/components/controls";
import EngineSelector from "./EngineSelector";
import Header from "./Header";
import { SeedRow } from "./SeedRow";
import { ModeToggle } from "./ModeToggle";
import { ResetButton } from "./ResetButton";
import { ExportButton } from "./ExportButton";
import Formats from "./Formats";
import Preview from "./Preview";
import MobileControls from "./MobileControls";
import StartPicker from "./StartPicker";
import { useStudio } from "@/lib/store";
import { exportPng, exportVideo } from "@/lib/export";
import { cn } from "@/lib/utils";

export default function Studio() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Landing gate: show the intro until the user clicks Start, then the studio.
  const [started, setStarted] = useState(false);

  // Nav state — overlays cover the editor; collapse hides the sidebar. `showStart`
  // is the blank-canvas starting-point picker (first entry + header re-open).
  const showFormats = useStudio((s) => s.showFormats);
  const showPreview = useStudio((s) => s.showPreview);
  const collapsed = useStudio((s) => s.sidebarCollapsed);
  const showStart = useStudio((s) => s.showStart);
  const overlayOpen = showFormats || showPreview;

  // Randomize seed after hydration (initial values are deterministic to avoid an
  // SSR/client mismatch) so the blank canvas behind the picker is fresh art.
  useEffect(() => {
    useStudio.getState().newSeed();
  }, []);

  const handleExport = () => {
    const s = useStudio.getState();
    // Animate records the live (BPM- or track-driven) canvas to video; Still
    // exports a PNG in the active delivery format.
    if (s.mode === "animate") {
      if (s.recording) return;
      const c = canvasRef.current;
      if (!c) return;
      s.setState({ recording: true, exportProgress: 0, exportLabel: null, exportResult: null });
      exportVideo(
        c,
        s,
        (o) => {
          useStudio.getState().setState({
            recording: false,
            exportProgress: null,
            exportLabel: null,
            exportResult: o.ok
              ? `Saved ${Math.round(o.seconds)}s ${o.kind.toUpperCase()}${o.hasAudio ? " with audio" : " (no audio)"}`
              : (o.error ?? "Export failed"),
          });
          // auto-clear the result line after a few seconds
          setTimeout(() => {
            const cur = useStudio.getState();
            if (!cur.recording) cur.setState({ exportResult: null });
          }, 6000);
        },
        (frac, label) => useStudio.getState().setState({ exportProgress: frac, exportLabel: label }),
      );
    } else {
      if (s.rendering) return;
      s.setState({ rendering: true });
      exportPng(useStudio.getState(), () =>
        useStudio.getState().setState({ rendering: false }),
      );
    }
  };

  // Landing first: a full-bleed looping generative backdrop + Start button.
  // Entering the studio opens the blank-canvas starting-point picker.
  if (!started) {
    return (
      <Intro
        onStart={() => {
          setStarted(true);
          useStudio.getState().setState({ showStart: true });
        }}
      />
    );
  }

  return (
    <div className="relative flex h-dvh w-full flex-col overflow-hidden bg-bg text-ink md:flex-row">
      {/* Transparent floating header: wordmark + Edit / Formats / Preview nav */}
      <Header onHome={() => setStarted(false)} />

      {/* HERO: canvas centered, fills remaining space. Expands when the sidebar
          collapses. Stage forwards canvasRef to the 2D CanvasStage. The blank-
          canvas starting-point picker overlays it on first entry. */}
      <main className="relative flex min-h-0 min-w-0 flex-1 flex-col">
        <Stage canvasRef={canvasRef} />
        {showStart && (
          <StartPicker
            onPick={(look) =>
              useStudio.getState().setState({ ...look.params, showStart: false })
            }
          />
        )}
      </main>

      {/* ── DESKTOP SIDEBAR (md+) ─────────────────────────────────────────────
          A floating, muted-glass, rounded panel inset from the top/right/bottom.
          Collapses to zero width (canvas reclaims the space) via the edge handle
          below. Inner panel keeps a fixed width so it clips cleanly while
          collapsing instead of squishing. */}
      <aside
        className={cn(
          "z-30 hidden flex-none overflow-hidden transition-[width] duration-300 ease-out md:block",
          collapsed ? "w-0" : "w-[324px] lg:w-[348px]",
        )}
      >
        <div className="flex h-full w-[324px] flex-col p-3 pt-[74px] lg:w-[348px]">
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-white/10 bg-panel/65 shadow-[0_20px_60px_rgba(0,0,0,0.5)] backdrop-blur-2xl">
            {/* Engine selector + seed/generate (sticky header zone) */}
            <div className="flex flex-none flex-col gap-3 border-b border-white/[0.06] px-4 pt-4 pb-3.5">
              <EngineSelector />
              <SeedRow />
            </div>

            {/* Scrolling parameter body */}
            <div className="pnl min-h-0 flex-1 overflow-y-auto">
              <Controls />
            </div>

            {/* Sticky action footer: mode + reset + export */}
            <div className="flex flex-none flex-col gap-2.5 border-t border-white/[0.06] px-4 py-3.5">
              <div className="flex gap-2">
                <ModeToggle className="flex-1" />
                <ResetButton />
              </div>
              <ExportButton onExport={handleExport} />
            </div>
          </div>
        </div>
      </aside>

      {/* Sidebar collapse / expand handle (desktop) — a tab on the panel's edge.
          A dedicated control so the header's Edit/Formats/Preview stay consistent
          view switchers. Slides with the panel; sits at the screen edge when
          collapsed. Hidden while an overlay is open. */}
      <button
        type="button"
        onClick={() =>
          useStudio.getState().setState({ sidebarCollapsed: !collapsed })
        }
        aria-label={collapsed ? "Show controls" : "Hide controls"}
        className={cn(
          "absolute top-1/2 z-30 hidden h-14 w-6 -translate-y-1/2 items-center justify-center rounded-l-[8px] border border-r-0 border-white/10 bg-panel/70 text-grey-300 shadow-[0_8px_30px_rgba(0,0,0,0.45)] backdrop-blur-xl transition-all duration-300 ease-out hover:text-white md:flex",
          overlayOpen && "pointer-events-none opacity-0",
          collapsed ? "right-0" : "right-[312px] lg:right-[336px]",
        )}
      >
        {collapsed ? (
          <ChevronLeft className="size-4" />
        ) : (
          <ChevronRight className="size-4" />
        )}
      </button>

      {/* ── PHONE CONTROLS (below md) — bottom dock with horizontal section tabs */}
      <MobileControls onExport={handleExport} />

      {/* ── OVERLAYS ──────────────────────────────────────────────────── */}
      {/* Always mounted (after Start) so they fade/scale in and out; their heavy
          previews only render while open. */}
      <Formats />
      <Preview />
    </div>
  );
}
