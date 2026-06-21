"use client";

import { useEffect, useRef } from "react";
import {
  Download,
  Film,
  Loader2,
  RefreshCw,
  RotateCcw,
  SlidersHorizontal,
} from "lucide-react";

import CanvasStage from "./CanvasStage";
import Controls from "./Controls";
import EngineSelector from "./EngineSelector";
import TopBar from "./TopBar";
import { useStudio } from "@/lib/store";
import { exportPng, exportVideo } from "@/lib/export";
import { cn } from "@/lib/utils";
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

// ── Shared studio chrome bits (used in both desktop sidebar + mobile sheet) ──

/** Seed number field + GENERATE (new random seed). */
function SeedRow() {
  const seed = useStudio((s) => s.seed);
  const setState = useStudio((s) => s.setState);
  const newSeed = useStudio((s) => s.newSeed);

  return (
    <div className="flex gap-2">
      <input
        type="number"
        value={seed}
        onChange={(e) => setState({ seed: Number(e.target.value) })}
        aria-label="Seed"
        className="h-10 min-w-0 flex-1 rounded-[4px] border border-grey-780 bg-grey-880 px-3 font-mono text-[12px] font-medium text-ink outline-none transition-colors focus:border-grey-500"
      />
      <button
        type="button"
        onClick={newSeed}
        className="flex h-10 flex-none items-center gap-[7px] rounded-[4px] bg-grey-100 px-[18px] font-mono text-[10px] font-semibold tracking-[0.14em] whitespace-nowrap text-bg transition-colors hover:bg-white"
      >
        <RefreshCw className="size-[13px]" />
        GENERATE
      </button>
    </div>
  );
}

/** STILL / ANIMATE mode toggle. */
function ModeToggle({ className }: { className?: string }) {
  const mode = useStudio((s) => s.mode);
  const setState = useStudio((s) => s.setState);
  const opts: { value: "still" | "animate"; label: string }[] = [
    { value: "still", label: "STILL" },
    { value: "animate", label: "ANIMATE" },
  ];
  return (
    <div
      className={cn(
        "grid grid-cols-2 gap-[2px] rounded-[5px] border border-grey-800 bg-grey-880 p-[3px]",
        className,
      )}
    >
      {opts.map((o) => {
        const active = mode === o.value;
        return (
          <button
            key={o.value}
            type="button"
            onClick={() => setState({ mode: o.value })}
            className={cn(
              "flex h-9 items-center justify-center rounded-[3px] font-mono text-[9px] font-semibold tracking-[0.18em] transition-colors",
              active
                ? "bg-grey-100 text-bg"
                : "bg-transparent text-grey-300 hover:bg-grey-850 hover:text-grey-150",
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

/** RESET — restore all generation/animation params to their defaults. */
function ResetButton({ className }: { className?: string }) {
  const resetParams = useStudio((s) => s.resetParams);
  return (
    <button
      type="button"
      onClick={resetParams}
      title="Reset all parameters to defaults"
      className={cn(
        "flex h-9 flex-none items-center justify-center gap-[6px] rounded-[5px] border border-grey-800 bg-grey-880 px-4 font-mono text-[9px] font-semibold tracking-[0.16em] text-grey-300 transition-colors hover:border-grey-500 hover:text-grey-100",
        className,
      )}
    >
      <RotateCcw className="size-[12px]" />
      RESET
    </button>
  );
}

/** Primary export button (DOWNLOAD PNG / EXPORT VIDEO LOOP) with busy spinner. */
function ExportButton({
  onExport,
  className,
}: {
  onExport: () => void;
  className?: string;
}) {
  const mode = useStudio((s) => s.mode);
  const rendering = useStudio((s) => s.rendering);
  const recording = useStudio((s) => s.recording);
  const busy = rendering || recording;

  const label =
    mode === "animate"
      ? recording
        ? "RECORDING…"
        : "EXPORT VIDEO LOOP"
      : rendering
        ? "RENDERING…"
        : "DOWNLOAD PNG · 3000²";

  return (
    <button
      type="button"
      onClick={onExport}
      disabled={busy}
      className={cn(
        "flex h-11 w-full items-center justify-center gap-[9px] rounded-[4px] bg-grey-100 font-mono text-[10px] font-semibold tracking-[0.16em] text-bg transition-colors hover:bg-white disabled:opacity-70",
        className,
      )}
    >
      {busy ? (
        <Loader2 className="size-[14px] animate-spin" />
      ) : mode === "animate" ? (
        <Film className="size-[14px]" />
      ) : (
        <Download className="size-[14px]" />
      )}
      {label}
    </button>
  );
}

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

      {/* HERO: canvas centered, fills remaining space */}
      <main className="flex min-h-0 min-w-0 flex-1 flex-col">
        <CanvasStage canvasRef={canvasRef} />
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
                  className="flex h-12 flex-none items-center gap-2 rounded-[6px] border border-border bg-panel/95 px-4 font-mono text-[10px] font-semibold tracking-[0.16em] text-ink shadow-[0_10px_40px_rgba(0,0,0,0.6)] backdrop-blur-sm transition-colors hover:bg-grey-900"
                />
              }
            >
              <SlidersHorizontal className="size-[15px]" />
              CONTROLS
            </SheetTrigger>
            <SheetContent
              side="right"
              className="flex w-[90vw] max-w-[400px] flex-col gap-0 border-l border-border bg-panel p-0"
            >
              {/* Sheet header: engine + seed + mode (always visible at top) */}
              <div className="flex flex-none flex-col gap-3 border-b border-border px-5 pt-5 pb-4">
                <SheetTitle className="font-mono text-[10px] font-semibold tracking-[0.22em] text-grey-300">
                  ENGINE
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
