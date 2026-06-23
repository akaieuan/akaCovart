"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { renderTo } from "@/engine";
import { cn } from "@/lib/utils";

// ── Landing backdrop presets ─────────────────────────────────────────────────
// One curated look per engine, so the landing genuinely previews what the studio
// makes. All share a dark / soft / glowing / grainy base (similar) but each engine
// + seed reads distinctly (different). Rendered live by the real engine; the
// backdrop auto-cycles and the visitor can scroll / arrow / tap through them.
type Preset = { label: string; params: Record<string, unknown> };

const BASE: Record<string, unknown> = {
  mood: "dark",
  colorPick: null,
  colorTone: 50,
  contrast: 50,
  saturation: 50,
  vignette: 30,
  bloom: 24,
  grain: 60,
  grainSize: 14,
  dust: 0,
  scratches: false,
  scratchCount: 0,
  showText: false,
  animBPM: 124,
  animPump: 55,
  animKick: 48,
  animSpeed: 52,
  animDrift: 60,
  animSwirl: 24,
};

const PRESETS: Preset[] = [
  {
    label: "Grid",
    params: {
      ...BASE,
      engine: "grid",
      seed: 730104923,
      gridCols: 14,
      gridDensity: 56,
      gridPerspective: 0,
      gridMagnet: 36,
      soften: 55,
      grainSize: 13,
      gridRipple: 78,
      gridBob: 100,
      gridPop: 55,
      gridOrbit: 77,
      gridFlow: 100,
    },
  },
  {
    label: "Blob",
    params: {
      ...BASE,
      engine: "blob",
      seed: 412556,
      density: 62,
      smear: 58,
      blobSize: 64,
      glow: 72,
      diamonds: true,
      diamondCount: 2,
      diamondSize: 54,
      diamondShape: 48,
      accent: 58,
      accentCount: 2,
      soften: 42,
      blobFlow: 62,
      blobSwirl: 42,
      blobPulse: 58,
      blobWander: 56,
      blobMorph: 52,
    },
  },
  {
    label: "Wave",
    params: {
      ...BASE,
      engine: "waves",
      seed: 50231,
      waveCount: 64,
      waveAmp: 56,
      waveDetail: 48,
      waveTurbulence: 32,
      wavePerspective: 0,
      soften: 40,
      glow: 62,
      smear: 46,
      density: 60,
      waveFlow: 58,
      waveSwell: 46,
      waveSurge: 56,
      waveChurn: 44,
      waveUndulate: 52,
    },
  },
  {
    label: "Contours",
    params: {
      ...BASE,
      engine: "contours",
      seed: 305522,
      contourLines: 60,
      contourWeight: 36,
      contourScale: 46,
      contourDetail: 54,
      contourWarp: 56,
      contourRelief: 34,
      contourMorph: 60,
      contourFlow: 48,
      soften: 30,
      glow: 55,
    },
  },
];

// ── Tuning ───────────────────────────────────────────────────────────────────
// Square backing buffer, CSS-upscaled to fill the viewport. Higher = crisper
// hero (reads as high-res); the blur/grain passes scale with it, so this is the
// main perf lever if motion ever hitches.
const HERO_SIZE = 1080;
const CROSSFADE_MS = 1100; // look-to-look dissolve
const DWELL_MS = 4200; // hold after a settle before auto-advancing

type Layer = { el: HTMLCanvasElement; preset: number };

export default function Intro({ onStart }: { onStart: () => void }) {
  const aRef = useRef<HTMLCanvasElement>(null);
  const bRef = useRef<HTMLCanvasElement>(null);

  // Roles swap on each settle; never copy pixels.
  const frontRef = useRef<Layer | null>(null);
  const backRef = useRef<Layer | null>(null);
  const transitioningRef = useRef(false);
  const settleTimerRef = useRef<number | null>(null);
  const rafRef = useRef<number | null>(null);

  const rtRef = useRef(0); // engine clock (s)
  const lastRef = useRef(0);
  const rasterAccRef = useRef(0);
  const autoAtRef = useRef(0); // timestamp of next auto-advance

  const [active, setActive] = useState(0);
  const [ready, setReady] = useState(false);
  const [leaving, setLeaving] = useState(false);

  // Render a preset onto a layer. Wrapped so a single bad frame can NEVER kill
  // the loop (the previous version froze when a render threw).
  const paint = useCallback((layer: Layer, rt: number) => {
    try {
      const p = PRESETS[layer.preset].params;
      const sp = 0.3 + ((p.animSpeed as number) / 100) * 1.7;
      renderTo(layer.el, HERO_SIZE, { ...p, _anim: true, _t: rt * sp, _rt: rt });
    } catch {
      /* ignore a transient render error; keep animating */
    }
  }, []);

  // Subtle perpetual Ken-Burns so even a settled look stays alive (transform
  // only — opacity is owned by the CSS transition, so the two never fight).
  const kenBurns = useCallback((layer: Layer, rt: number) => {
    const ph = layer.preset * 1.7;
    // object-fit:cover scales the square art to the viewport's LARGER side, so a
    // tall/narrow phone renders it zoomed-OUT vs a wide desktop. Boost small
    // viewports up to a desktop-ish reference so the start page reads the SAME on
    // every screen. Desktop (cover >= REF) is unchanged (zoom = 1).
    const REF = 1280;
    const cover = Math.max(window.innerWidth, window.innerHeight) || REF;
    const zoom = Math.max(1, REF / cover);
    const s = (1.025 + Math.sin(rt * 0.26 + ph) * 0.012) * zoom;
    const tx = Math.sin(rt * 0.21 + ph) * 6;
    const ty = Math.cos(rt * 0.17 + ph * 1.3) * 6;
    layer.el.style.transform = `translate3d(${tx.toFixed(2)}px, ${ty.toFixed(2)}px, 0) scale(${s.toFixed(4)})`;
  }, []);

  // Begin a cross-dissolve to look `i`. The fade itself is a CSS opacity
  // transition (GPU, can't stall); a setTimeout GUARANTEES the settle even if a
  // frame is dropped — so it can't get stuck like the manual-mix version did.
  const go = useCallback(
    (i: number) => {
      const front = frontRef.current;
      const back = backRef.current;
      if (!front || !back || transitioningRef.current || i === front.preset) return;

      back.preset = i;
      paint(back, rtRef.current); // prime so the fade never reveals a blank frame
      kenBurns(back, rtRef.current);
      // Trigger the CSS opacity transition (front 1→0, back 0→1).
      back.el.style.opacity = "1";
      front.el.style.opacity = "0";
      transitioningRef.current = true;
      setActive(i);
      autoAtRef.current = performance.now() + CROSSFADE_MS + DWELL_MS;

      if (settleTimerRef.current != null) clearTimeout(settleTimerRef.current);
      settleTimerRef.current = window.setTimeout(() => {
        // Swap roles: the incoming layer is now the settled front.
        frontRef.current = back;
        backRef.current = front;
        // Park the old front instantly (disable transition for the snap).
        front.el.style.transition = "none";
        front.el.style.opacity = "0";
        // Restore the transition on the next tick for the following dissolve.
        window.setTimeout(() => {
          front.el.style.transition = `opacity ${CROSSFADE_MS}ms ease`;
        }, 20);
        transitioningRef.current = false;
      }, CROSSFADE_MS + 30);
    },
    [paint, kenBurns],
  );
  const goRel = useCallback(
    (d: number) =>
      go(((frontRef.current?.preset ?? 0) + d + PRESETS.length) % PRESETS.length),
    [go],
  );

  // ── Render loop ────────────────────────────────────────────────────────────
  useEffect(() => {
    const a = aRef.current;
    const b = bRef.current;
    if (!a || !b) return;
    a.width = a.height = HERO_SIZE;
    b.width = b.height = HERO_SIZE;
    a.style.transition = `opacity ${CROSSFADE_MS}ms ease`;
    b.style.transition = `opacity ${CROSSFADE_MS}ms ease`;
    a.style.opacity = "1";
    b.style.opacity = "0";

    const front: Layer = { el: a, preset: 0 };
    const back: Layer = { el: b, preset: 1 };
    frontRef.current = front;
    backRef.current = back;
    transitioningRef.current = false;

    const now0 = performance.now();
    lastRef.current = now0;
    rtRef.current = 0;
    rasterAccRef.current = 0;
    autoAtRef.current = now0 + DWELL_MS;

    paint(front, 0);
    kenBurns(front, 0);

    let alive = true;
    const loop = (now: number) => {
      if (!alive) return;
      try {
        let dt = (now - lastRef.current) / 1000;
        lastRef.current = now;
        if (!(dt > 0)) dt = 0;
        if (dt > 0.05) dt = 0.05; // clamp tab-away jumps
        rtRef.current += dt;
        const rt = rtRef.current;

        const f = frontRef.current!;
        const bk = backRef.current!;
        const transitioning = transitioningRef.current;

        // Auto-advance once settled + dwelled.
        if (!transitioning && now >= autoAtRef.current) {
          go((f.preset + 1) % PRESETS.length);
        }

        // Repaint engine raster ~30fps (invisible on a soft backdrop, far cheaper).
        rasterAccRef.current += dt;
        if (rasterAccRef.current >= 1 / 30) {
          rasterAccRef.current = 0;
          paint(f, rt);
          if (transitioning) paint(bk, rt);
        }
        // Ken-Burns every frame (cheap, GPU-composited).
        kenBurns(f, rt);
        if (transitioning) kenBurns(bk, rt);
      } catch {
        /* never let a frame kill the loop */
      }
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);
    const readyId = window.setTimeout(() => setReady(true), 80);

    return () => {
      alive = false;
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
      if (settleTimerRef.current != null) clearTimeout(settleTimerRef.current);
      window.clearTimeout(readyId);
    };
  }, [go, paint, kenBurns]);

  // Scroll / arrow keys advance through the looks.
  useEffect(() => {
    let wheelLock = 0;
    const onWheel = (e: WheelEvent) => {
      const now = performance.now();
      if (now < wheelLock) return;
      const d = Math.abs(e.deltaY) >= Math.abs(e.deltaX) ? e.deltaY : e.deltaX;
      if (Math.abs(d) < 8) return;
      wheelLock = now + 260;
      goRel(d > 0 ? 1 : -1);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight" || e.key === "ArrowDown") goRel(1);
      else if (e.key === "ArrowLeft" || e.key === "ArrowUp") goRel(-1);
    };
    window.addEventListener("wheel", onWheel, { passive: true });
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("wheel", onWheel);
      window.removeEventListener("keydown", onKey);
    };
  }, [goRel]);

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
      {/* Two cross-dissolving render layers (opacity owned by the CSS transition;
          the slight over-scale baseline + will-change keep each on its own GPU
          layer so the dissolve never repaints the page). */}
      <canvas
        ref={aRef}
        aria-hidden
        className="absolute inset-0 block h-full w-full origin-center"
        style={{
          objectFit: "cover",
          willChange: "opacity, transform",
          transform: "scale(1.025)",
          backfaceVisibility: "hidden",
        }}
      />
      <canvas
        ref={bRef}
        aria-hidden
        className="absolute inset-0 block h-full w-full origin-center"
        style={{
          objectFit: "cover",
          willChange: "opacity, transform",
          opacity: 0,
          transform: "scale(1.025)",
          backfaceVisibility: "hidden",
        }}
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

      {/* Look switcher — current engine name + dots. Auto-cycles; click / scroll /
          arrow keys move through the four engines. */}
      <div
        className={cn(
          "absolute inset-x-0 bottom-16 z-10 flex flex-col items-center gap-3 transition-opacity duration-700",
          ready && !leaving ? "opacity-100" : "opacity-0",
        )}
      >
        <div className="font-sans text-[11px] tracking-[0.18em] text-white/55 uppercase [text-shadow:0_1px_10px_rgba(0,0,0,0.8)]">
          {PRESETS[active].label}
        </div>
        <div className="flex items-center gap-2.5">
          {PRESETS.map((p, i) => (
            <button
              key={p.label}
              type="button"
              onClick={() => go(i)}
              aria-label={`Show ${p.label}`}
              className={cn(
                "h-1.5 rounded-full transition-all duration-300",
                i === active ? "w-6 bg-white/85" : "w-1.5 bg-white/30 hover:bg-white/55",
              )}
            />
          ))}
        </div>
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
