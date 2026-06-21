"use client";

import { useCallback, useEffect, useRef } from "react";
import { renderTo } from "@/engine";
import type { TextBox } from "@/engine";
import { useStudio, renderParams, type StudioState } from "@/lib/store";

const DISPLAY = 880;

// Signature of everything that affects the main image (mirrors the prototype).
function paramSig(s: StudioState): string {
  return [
    s.mood,
    s.engine,
    s.gridCols,
    s.gridDensity,
    s.gridPerspective,
    s.gridMagnet,
    s.waveCount,
    s.waveAmp,
    s.waveDetail,
    s.waveTurbulence,
    s.wavePerspective,
    s.orbSize,
    s.orbSoft,
    s.orbHalftone,
    s.orbMelt,
    s.orbShade,
    s.soften,
    s.density,
    s.smear,
    s.grain,
    s.blobSize,
    s.glow,
    s.contrast,
    s.saturation,
    s.vignette,
    s.bloom,
    s.grainSize,
    s.dust,
    s.accent,
    s.accentCount,
    s.diamonds,
    s.diamondCount,
    s.diamondSize,
    s.diamondShape,
    s.sigilMarks,
    s.sigilMarkCount,
    s.sigilMarkSize,
    s.sigilMarkScatter,
    s.sigilFrame,
    s.sigilFrameDensity,
    s.scratches,
    s.scratchCount,
  ].join("|");
}

function textSig(s: StudioState): string {
  return [
    s.showText,
    s.title,
    s.artist,
    s.textColor,
    s.textCase,
    s.distort,
    s.textX,
    s.textY,
    s.textAlign,
  ].join("|");
}

function sig(s: StudioState): string {
  return s.seed + "|" + paramSig(s) + "|" + textSig(s);
}

export default function CanvasStage({
  canvasRef,
}: {
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
}) {

  // Latest state without forcing re-subscription of the RAF loop.
  const state = useStudio();
  const stateRef = useRef(state);
  stateRef.current = state;

  const textBoxRef = useRef<TextBox | undefined>(undefined);
  const lastSig = useRef<string | null>(null);
  const rafRef = useRef<number | null>(null);
  const t0Ref = useRef(0);
  const dragRef = useRef<{ dx: number; dy: number } | null>(null);

  // ── Still render (signature-diffed) ───────────────────────────────────────
  const draw = useCallback(() => {
    const c = canvasRef.current;
    if (!c) return;
    const s = stateRef.current;
    lastSig.current = sig(s);
    c.width = DISPLAY;
    c.height = DISPLAY;
    const res = renderTo(c, DISPLAY, renderParams(s));
    textBoxRef.current = res.textBox;
  }, [canvasRef]);

  // ── Animation loop (beat-synced; NO flicker — CSS filter only) ─────────────
  const stopAnim = useCallback(() => {
    if (rafRef.current != null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    const c = canvasRef.current;
    if (c) c.style.filter = "none";
    lastSig.current = null;
    draw();
  }, [draw, canvasRef]);

  const startAnim = useCallback(() => {
    if (rafRef.current != null) return;
    const c = canvasRef.current;
    if (!c) return;
    c.width = DISPLAY;
    c.height = DISPLAY;
    t0Ref.current = performance.now();

    // Paint one immediate frame so the canvas is never blank before the first
    // requestAnimationFrame fires (e.g. if the tab is briefly backgrounded).
    {
      const s0 = stateRef.current;
      const p0 = { ...renderParams(s0), _anim: true, _t: 0, _rt: 0, _bake: !!s0.recording };
      const res0 = renderTo(c, DISPLAY, p0);
      textBoxRef.current = res0.textBox;
      if (!s0.recording) {
        const cc = 1 + ((s0.contrast - 50) / 50) * 0.7;
        const sf = s0.saturation / 50;
        c.style.filter = `contrast(${cc.toFixed(3)}) saturate(${sf.toFixed(3)})`;
      }
    }

    const loop = (now: number) => {
      const s = stateRef.current;
      if (s.mode !== "animate") {
        rafRef.current = null;
        return;
      }
      const sp = 0.3 + (s.animSpeed / 100) * 1.7;
      const rt = (now - t0Ref.current) / 1000;
      const t = rt * sp;
      const bake = !!s.recording;
      const p = {
        ...renderParams(s),
        _anim: true,
        _t: t,
        _rt: rt,
        _bake: bake,
      };
      const res = renderTo(c, DISPLAY, p);
      textBoxRef.current = res.textBox;
      // Live contrast/saturate via CSS filter (never per-frame pixel work).
      if (bake) {
        c.style.filter = "none";
      } else {
        const cc = 1 + ((s.contrast - 50) / 50) * 0.7;
        const sf = s.saturation / 50;
        c.style.filter = `contrast(${cc.toFixed(3)}) saturate(${sf.toFixed(3)})`;
      }
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);
  }, [canvasRef]);

  // ── Mount + reactive sync ─────────────────────────────────────────────────
  useEffect(() => {
    draw();
    // Re-render once fonts are ready so type metrics are correct.
    if (typeof document !== "undefined" && document.fonts?.ready) {
      document.fonts.ready.then(() => draw());
    }
    return () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // React to state changes (subscribe to the whole store).
  useEffect(() => {
    if (state.mode === "animate") {
      if (rafRef.current == null) startAnim();
      return;
    }
    if (rafRef.current != null) {
      stopAnim();
      return;
    }
    if (sig(state) !== lastSig.current) draw();
  }, [state, draw, startAnim, stopAnim]);

  // ── Drag-to-move text on canvas ───────────────────────────────────────────
  const norm = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    return {
      x: (e.clientX - r.left) / r.width,
      y: (e.clientY - r.top) / r.height,
    };
  };

  const inBox = (px: number, py: number, b: TextBox) =>
    px >= b.x - 0.04 &&
    px <= b.x + b.w + 0.04 &&
    py >= b.y - 0.04 &&
    py <= b.y + b.h + 0.04;

  const onPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const s = stateRef.current;
    if (!s.showText) return;
    const b = textBoxRef.current;
    if (!b) return;
    const p = norm(e);
    if (inBox(p.x, p.y, b)) {
      dragRef.current = { dx: p.x - s.textX, dy: p.y - s.textY };
      e.currentTarget.setPointerCapture(e.pointerId);
      e.currentTarget.style.cursor = "grabbing";
      e.preventDefault();
    }
  };

  const onPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const p = norm(e);
    const drag = dragRef.current;
    if (drag) {
      const nx = Math.max(0.01, Math.min(0.99, p.x - drag.dx));
      const ny = Math.max(0.01, Math.min(0.99, p.y - drag.dy));
      useStudio.getState().setState({ textX: nx, textY: ny });
    } else if (stateRef.current.showText && textBoxRef.current) {
      e.currentTarget.style.cursor = inBox(p.x, p.y, textBoxRef.current)
        ? "grab"
        : "default";
    }
  };

  const onPointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (dragRef.current) {
      dragRef.current = null;
      e.currentTarget.style.cursor = "grab";
    }
  };

  return (
    <section className="flex min-h-0 min-w-0 flex-1 flex-col items-center justify-center gap-4 overflow-hidden bg-[radial-gradient(circle_at_50%_38%,#121215,#0a0a0b_72%)] px-4 pt-16 pb-44 sm:gap-[18px] sm:px-8 md:py-8">
      <div className="relative aspect-square w-full max-w-[min(82vh,760px)] bg-black shadow-[0_30px_80px_rgba(0,0,0,0.65),0_0_0_1px_#1c1c20]">
        <canvas
          ref={canvasRef}
          className="block h-full w-full touch-none"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        />
      </div>
      <div className="font-mono text-[9px] tracking-[0.16em] text-grey-400">
        3000 × 3000 PX&nbsp;&nbsp;·&nbsp;&nbsp;SEED&nbsp;{state.seed >>> 0}
      </div>
    </section>
  );
}
