"use client";

import { useEffect, useRef, useState } from "react";
import { renderTo } from "@/engine";
import { cn } from "@/lib/utils";

// Hero look = the GRID engine, heavily softened into glowing colour dots on
// black with fine grain, animated by the grid's own motion (ripple / bob / pop /
// orbit / flow) plus a steady beat pulse. These params mirror the studio preset
// the owner picked as the landing default, rendered by the real engine so the
// landing genuinely previews the tool. Cover text is off (the wordmark sits on
// top instead).
const HERO: Record<string, unknown> = {
  seed: 730104923,
  engine: "grid",
  mood: "dark",
  colorPick: null,
  colorTone: 50,
  // composition (grid)
  gridCols: 14,
  gridDensity: 56,
  gridPerspective: 0,
  gridMagnet: 36,
  // finish
  contrast: 50,
  saturation: 50,
  vignette: 28,
  bloom: 22,
  soften: 55,
  // texture
  grain: 60,
  grainSize: 13,
  dust: 0,
  scratches: false,
  scratchCount: 0,
  showText: false,
  // beat + drift
  animBPM: 128,
  animPump: 55,
  animKick: 50,
  animSpeed: 55,
  animDrift: 62,
  animSwirl: 24,
  // grid motion
  gridRipple: 78,
  gridBob: 100,
  gridPop: 55,
  gridOrbit: 77,
  gridFlow: 100,
};

// Square backing-store size, CSS object-fit:cover'd to fill the viewport. Bumped
// up for a higher-res landing; the soft blur keeps it cheap enough to animate.
const HERO_SIZE = 720;

export default function Intro({ onStart }: { onStart: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number | null>(null);
  const [ready, setReady] = useState(false);
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    const c = canvasRef.current;
    if (!c) return;
    c.width = HERO_SIZE;
    c.height = HERO_SIZE;
    const t0 = performance.now();
    const sp = 0.3 + ((HERO.animSpeed as number) / 100) * 1.7;
    const loop = (now: number) => {
      const rt = (now - t0) / 1000;
      renderTo(c, HERO_SIZE, { ...HERO, _anim: true, _t: rt * sp, _rt: rt });
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);
    const id = window.setTimeout(() => setReady(true), 80);
    return () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
      window.clearTimeout(id);
    };
  }, []);

  const start = () => {
    if (leaving) return;
    setLeaving(true);
    window.setTimeout(onStart, 520);
  };

  return (
    <div
      className={cn(
        "fixed inset-0 z-50 overflow-hidden bg-bg transition-opacity duration-500",
        leaving ? "opacity-0" : "opacity-100",
      )}
    >
      <canvas
        ref={canvasRef}
        aria-hidden
        className="absolute inset-0 block h-full w-full"
        style={{ objectFit: "cover" }}
      />

      {/* Scrim — DARKER in the centre so the wordmark + button read cleanly,
          lighter at the edges so the art stays visible framing them. */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(5,6,8,0.72)_0%,rgba(5,6,8,0.48)_42%,rgba(5,6,8,0.28)_100%)]" />

      <div
        className={cn(
          "relative z-10 flex h-full w-full flex-col items-center justify-center px-6 text-center transition-all duration-700 ease-out",
          ready && !leaving ? "translate-y-0 opacity-100" : "translate-y-2 opacity-0",
        )}
      >
        <span className="inline-flex select-none items-baseline [text-shadow:0_2px_22px_rgba(0,0,0,0.65)]">
          <span className="text-[34px] font-light tracking-tight text-white/65 sm:text-[46px]">
            aka
          </span>
          <span className="text-[34px] font-semibold tracking-tight text-white sm:text-[46px]">
            COVART
          </span>
        </span>
        <p className="mt-4 max-w-[36ch] font-sans text-[13px] leading-relaxed text-white/75 [text-shadow:0_1px_14px_rgba(0,0,0,0.75)] sm:text-[14px]">
          A generative album-art engine. Shape it, sync the motion to your
          track, and export the cover.
        </p>
        <button
          type="button"
          onClick={start}
          className="mt-10 inline-flex h-11 items-center justify-center rounded-[7px] bg-white px-9 text-[13px] font-medium text-black shadow-[0_8px_30px_rgba(0,0,0,0.5)] transition-transform hover:scale-[1.03] active:scale-[0.98]"
        >
          Start
        </button>
      </div>

      {/* Minimal, muted credit. */}
      <div
        className={cn(
          "pointer-events-none absolute inset-x-0 bottom-6 z-10 flex justify-center transition-opacity duration-700",
          ready && !leaving ? "opacity-100" : "opacity-0",
        )}
      >
        <p className="pointer-events-auto font-sans text-[11px] tracking-wide text-white/35">
          Built by akaIeuan @{" "}
          <a
            href="https://akabuild.dev/"
            target="_blank"
            rel="noopener noreferrer"
            className="text-[#5b9dff] underline-offset-2 transition-colors hover:text-[#7db4ff] hover:underline"
          >
            akaBuild
          </a>
        </p>
      </div>
    </div>
  );
}
