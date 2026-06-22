"use client";

import { useEffect, useRef } from "react";
import { SlidersHorizontal } from "lucide-react";

import { Stage } from "@/components/canvas";
import { Controls } from "@/components/controls";
import EngineSelector from "./EngineSelector";
import TopBar from "./TopBar";
import { SeedRow } from "./SeedRow";
import { ModeToggle } from "./ModeToggle";
import { ResetButton } from "./ResetButton";
import { ExportButton } from "./ExportButton";
import { useStudio } from "@/lib/store";
import { exportPng, exportVideo } from "@/lib/export";
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

export default function Studio() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Randomize seed + gallery after hydration (initial values are deterministic
  // to avoid an SSR/client mismatch). Gives fresh art on every load.
  useEffect(() => {
    const s = useStudio.getState();
    s.newSeed();
    s.rerollGallery();
  }, []);

  const handleExport = () => {
    const s = useStudio.getState();
    // Animate records the live (BPM- or track-driven) canvas to video; Still
    // exports a 3000² PNG.
    if (s.mode === "animate") {
      if (s.recording) return;
      const c = canvasRef.current;
      if (!c) return;
      s.setState({ recording: true });
      exportVideo(c, s, () =>
        useStudio.getState().setState({ recording: false }),
      );
    } else {
      if (s.rendering) return;
      s.setState({ rendering: true });
      exportPng(useStudio.getState(), () =>
        useStudio.getState().setState({ rendering: false }),
      );
    }
  };

  return (
    <div className="relative flex h-screen w-full overflow-hidden bg-bg text-ink">
      {/* Floating wordmark over the canvas backdrop */}
      <TopBar />

      {/* HERO: canvas centered, fills remaining space. Stage forwards canvasRef
          to the 2D CanvasStage. */}
      <main className="flex min-h-0 min-w-0 flex-1 flex-col">
        <Stage canvasRef={canvasRef} />
      </main>

      {/* ── DESKTOP SIDEBAR (md+) ─────────────────────────────────────── */}
      <aside className="hidden w-[320px] flex-none flex-col border-l border-border bg-panel md:flex lg:w-[380px] xl:w-[400px]">
        {/* Engine selector + seed/generate (sticky header zone) */}
        <div className="flex flex-none flex-col gap-3 border-b border-border px-5 pt-5 pb-4">
          <EngineSelector />
          <SeedRow />
        </div>

        {/* Scrolling parameter body */}
        <div className="pnl min-h-0 flex-1 overflow-y-auto">
          <Controls />
        </div>

        {/* Sticky action footer: mode + reset + export */}
        <div className="flex flex-none flex-col gap-[9px] border-t border-border px-5 py-4">
          <div className="flex gap-2">
            <ModeToggle className="flex-1" />
            <ResetButton />
          </div>
          <ExportButton onExport={handleExport} />
        </div>
      </aside>

      {/* ── PHONE FLOATING CONTROLS (below md) ────────────────────────── */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-30 flex flex-col gap-3 p-4 md:hidden">
        {/* Engine selector stays reachable without opening the sheet */}
        <div className="pointer-events-auto rounded-[6px] border border-border bg-panel/95 p-2 shadow-[0_10px_40px_rgba(0,0,0,0.6)] backdrop-blur-sm">
          <EngineSelector />
        </div>
        <div className="pointer-events-auto flex items-stretch gap-2">
          <Sheet>
            <SheetTrigger
              render={
                <button
                  type="button"
                  aria-label="Open controls"
                  className="flex h-12 flex-none items-center gap-2 rounded-[6px] border border-border bg-panel/95 px-4 text-[12px] font-normal text-ink shadow-[0_10px_40px_rgba(0,0,0,0.6)] backdrop-blur-sm transition-colors hover:bg-grey-900"
                />
              }
            >
              <SlidersHorizontal className="size-[15px]" />
              Controls
            </SheetTrigger>
            <SheetContent
              side="right"
              className="flex w-[90vw] max-w-[400px] flex-col gap-0 border-l border-border bg-panel p-0"
            >
              {/* Sheet header: engine + seed + mode (always visible at top) */}
              <div className="flex flex-none flex-col gap-3 border-b border-border px-5 pt-5 pb-4">
                <SheetTitle className="text-[13px] font-medium text-grey-300">
                  Engine
                </SheetTitle>
                <EngineSelector />
                <SeedRow />
                <div className="flex gap-2">
                  <ModeToggle className="flex-1" />
                  <ResetButton />
                </div>
              </div>
              {/* Scrolling params */}
              <div className="pnl min-h-0 flex-1 overflow-y-auto">
                <Controls />
              </div>
              {/* Sheet footer: export */}
              <div className="flex flex-none flex-col border-t border-border px-5 py-4">
                <ExportButton onExport={handleExport} />
              </div>
            </SheetContent>
          </Sheet>

          {/* Primary export reachable without opening the sheet */}
          <div className="pointer-events-auto flex-1 rounded-[6px] border border-border bg-panel/95 p-1.5 shadow-[0_10px_40px_rgba(0,0,0,0.6)] backdrop-blur-sm">
            <ExportButton onExport={handleExport} />
          </div>
        </div>
      </div>
    </div>
  );
}
