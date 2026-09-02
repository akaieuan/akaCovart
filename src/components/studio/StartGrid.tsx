"use client";

import { useEffect, useRef } from "react";
import { renderTo, listEnginesByFocus } from "@/engine";
import { useStudio, randSeed } from "@/lib/store";
import { cn } from "@/lib/utils";
import { CONTROL, FOCUS } from "@/components/controls/primitives/typography";
import {
  ART_START_LOOKS,
  OIL_START_LOOKS,
  TXT_START_LOOKS,
  STACK_START_LOOKS,
  type Preset,
} from "@/components/intro/scenes";

// Fixed backing-store so tiles stay crisp at any displayed size (CSS-scaled).
const BACKING = 180;

// Desktop only: hover plays the live animation. Touch / coarse pointers skip it.
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
      renderTo(el, BACKING, { ...look.params, showText: false });
    } catch {
      /* a transient render error must never break the picker */
    }
  };

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.width = el.height = BACKING;
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
        renderTo(el, BACKING, { ...look.params, showText: false, _anim: true, _t: rt * 1.2, _rt: rt });
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
      // Hover plays the live animation (above); the edge is the only other hover
      // cue — a scale re-rasterised the canvas every frame for nothing.
      className={cn(
        FOCUS,
        "group relative aspect-square overflow-hidden rounded-card border border-edge bg-black transition-colors hover:border-white/40 active:border-white/60",
      )}
    >
      <canvas ref={ref} className="block h-full w-full" />
    </button>
  );
}

/**
 * StartGrid — the focus-aware 3×3 grid of starting points (8 looks + a Random
 * tile). Shared by the full-canvas first-run picker and the header "Starts"
 * dropdown. Reads `focus` to show Art looks or type looks.
 */
export default function StartGrid({
  onPick,
  className,
}: {
  onPick: (look: Preset) => void;
  className?: string;
}) {
  const focus = useStudio((s) => s.focus);
  const looks =
    focus === "stack"
      ? STACK_START_LOOKS
      : focus === "txt"
        ? TXT_START_LOOKS
        : focus === "oil"
          ? OIL_START_LOOKS
          : ART_START_LOOKS;

  const onRandom = () => {
    const pickId = (f: "art" | "txt" | "oil", fallback: string) => {
      const es = listEnginesByFocus(f);
      return es.length ? es[Math.floor(Math.random() * es.length)].id : fallback;
    };
    if (focus === "oil") {
      // One engine in this lane, so "random" rolls the SCENE + brush, not the engine.
      const roll = <T,>(xs: T[]) => xs[Math.floor(Math.random() * xs.length)];
      onPick({
        label: "Random",
        params: {
          engine: "oil",
          oilScene: roll(["ridgeline", "dunes", "coast", "basin", "mesa", "storm"]),
          oilBrush: roll(["impasto", "knife", "scumble", "stipple", "dry"]),
          seed: randSeed(),
        },
      });
      return;
    }
    if (focus === "stack") {
      // A random art background + a random type engine over it.
      onPick({
        label: "Random",
        params: { focus: "stack", engine: pickId("art", "blob"), stackTxt: pickId("txt", "blur"), seed: randSeed() },
      });
      return;
    }
    onPick({
      label: "Random",
      params: { engine: pickId(focus, focus === "txt" ? "dither" : "blob"), seed: randSeed() },
    });
  };

  return (
    <div className={cn("grid grid-cols-3 gap-2", className)}>
      {looks.map((look, i) => (
        <Tile key={`${focus}-${i}`} look={look} onClick={() => onPick(look)} />
      ))}
      <button
        type="button"
        onClick={onRandom}
        aria-label="Start with a random look"
        className={cn(
          FOCUS,
          "flex aspect-square flex-col items-center justify-center gap-0.5 rounded-card border border-dashed border-white/25 bg-white/[0.03] text-center transition-colors hover:border-white/55 hover:bg-white/[0.08] active:bg-white/[0.12]",
        )}
      >
        <span className={cn(CONTROL, "font-medium text-grey-100")}>Random</span>
      </button>
    </div>
  );
}
