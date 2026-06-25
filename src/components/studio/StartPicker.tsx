"use client";

import { useEffect, useRef } from "react";
import { renderTo, listEnginesByFocus } from "@/engine";
import { useStudio, randSeed } from "@/lib/store";
import {
  ART_START_LOOKS,
  TXT_START_LOOKS,
  type Preset,
} from "@/components/intro/scenes";

const TILE = 200;

// Desktop only: hover plays the live animation. Touch / coarse pointers skip it
// (tap-to-start) to avoid hover-trap issues.
function canHover(): boolean {
  return (
    typeof window !== "undefined" &&
    !!window.matchMedia &&
    window.matchMedia("(hover: hover) and (pointer: fine)").matches
  );
}

// One starting-point tile. Renders a still of the look; on desktop hover it plays
// the generative animation (only the hovered tile, so it stays cheap).
function Tile({ look, onClick }: { look: Preset; onClick: () => void }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef(0);
  const t0Ref = useRef(0);

  const paintStill = () => {
    const el = ref.current;
    if (!el) return;
    try {
      renderTo(el, TILE, { ...look.params, showText: false });
    } catch {
      /* a transient render error must never break the picker */
    }
  };

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.width = el.height = TILE;
    paintStill();
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = 0;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [look]);

  const startAnim = () => {
    if (!canHover() || rafRef.current) return;
    t0Ref.current = performance.now();
    const loop = (now: number) => {
      const el = ref.current;
      if (!el) return;
      const rt = (now - t0Ref.current) / 1000;
      try {
        renderTo(el, TILE, { ...look.params, showText: false, _anim: true, _t: rt * 1.2, _rt: rt });
      } catch {
        /* keep going */
      }
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);
  };

  const stopAnim = () => {
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = 0;
    }
    paintStill();
  };

  return (
    <button
      type="button"
      onClick={onClick}
      onPointerEnter={startAnim}
      onPointerLeave={stopAnim}
      aria-label={`Start with the ${look.label} look`}
      className="group relative aspect-square overflow-hidden rounded-[9px] border border-white/12 bg-black shadow-[0_8px_24px_rgba(0,0,0,0.45)] transition-transform duration-200 hover:scale-[1.04] hover:border-white/40"
    >
      <canvas ref={ref} className="block h-full w-full" />
    </button>
  );
}

/**
 * StartPicker — the studio's blank-canvas first-run state, shown over the canvas
 * when the visitor enters (and re-openable from the header). Focus-aware: shows
 * Art looks in Art focus and type looks in TxT focus. Pick a tile to load it, or
 * "Random" for a fresh random look. Fully opaque so the canvas never shows
 * through (no "two pages" bleed).
 */
export default function StartPicker({ onPick }: { onPick: (look: Preset) => void }) {
  const focus = useStudio((s) => s.focus);
  const looks = focus === "txt" ? TXT_START_LOOKS : ART_START_LOOKS;

  const onRandom = () => {
    const engines = listEnginesByFocus(focus);
    const eng = engines.length
      ? engines[Math.floor(Math.random() * engines.length)].id
      : focus === "txt"
        ? "dither"
        : "blob";
    onPick({ label: "Random", params: { engine: eng, seed: randSeed() } });
  };

  return (
    <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-5 bg-[radial-gradient(circle_at_50%_40%,#121215,#0a0a0b_72%)] px-6">
      <div className="text-center">
        <div className="font-sans text-[15px] font-medium text-grey-100">
          Choose a starting point
        </div>
        <div className="mt-1 font-sans text-[12px] text-grey-400">
          {focus === "txt"
            ? "Pick a type treatment — or go random."
            : "Pick a look to shape — or go random."}
        </div>
      </div>
      <div className="grid w-[min(86vw,420px)] grid-cols-3 gap-2.5">
        {looks.map((look, i) => (
          <Tile key={`${focus}-${i}`} look={look} onClick={() => onPick(look)} />
        ))}
        <button
          type="button"
          onClick={onRandom}
          aria-label="Start with a random look"
          className="flex aspect-square flex-col items-center justify-center gap-0.5 rounded-[9px] border border-dashed border-white/25 bg-white/[0.03] text-center transition-transform duration-200 hover:scale-[1.04] hover:border-white/55 hover:bg-white/[0.08]"
        >
          <span className="text-[13px] font-semibold text-white/90">Random</span>
          <span className="text-[10px] tracking-[0.12em] text-white/55 uppercase">
            Surprise
          </span>
        </button>
      </div>
    </div>
  );
}
