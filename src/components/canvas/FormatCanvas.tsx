"use client";

import { useEffect, useRef } from "react";

import { renderFormatTo } from "@/engine";
import { useStudio, renderParams } from "@/lib/store";
import { fitDims, type Format } from "@/lib/formats";
import { ensureCoverFont } from "@/lib/fonts";

// ── FormatCanvas ─────────────────────────────────────────────────────────────
// A self-contained canvas that renders the CURRENT artwork in a given delivery
// `format` (true aspect, cover-cropped, frame-space type via renderFormatTo).
// `animated` runs the BPM-driven motion loop; otherwise it paints a crisp still
// that refreshes when the look changes. Used by the Preview page (still vs motion
// + the multi-format bento). Backing store fills the parent box, so wrap it in an
// element that sets the aspect (e.g. style={{ aspectRatio }}).
export function FormatCanvas({
  format,
  animated = false,
  maxPx = 720,
  className,
}: {
  format: Format;
  animated?: boolean;
  maxPx?: number;
  className?: string;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  const state = useStudio();
  const stateRef = useRef(state);
  stateRef.current = state;
  // Reused offscreen square canvas for the cover-crop, so the animate loop never
  // allocates per frame (the cause of jank / "not fluid" on non-square formats).
  const scratchRef = useRef<HTMLCanvasElement | null>(null);
  const scratch = () =>
    scratchRef.current ?? (scratchRef.current = document.createElement("canvas"));

  // Size the backing store to the format aspect (longest edge = maxPx).
  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const { w, h } = fitDims(format, maxPx);
    c.width = w;
    c.height = h;
  }, [format, maxPx]);

  // STILL — repaint a crisp frame whenever the look changes.
  useEffect(() => {
    if (animated) return;
    const c = ref.current;
    if (!c) return;
    let cancelled = false;
    const { w, h } = fitDims(format, maxPx);
    c.width = w;
    c.height = h;
    const params = renderParams(stateRef.current);
    ensureCoverFont(params.textFont as string).then(() => {
      if (cancelled) return;
      requestAnimationFrame(() => {
        if (cancelled) return;
        try {
          c.style.filter = "none";
          renderFormatTo(c, params, scratch());
        } catch {
          /* ignore a transient render error */
        }
      });
    });
    return () => {
      cancelled = true;
    };
  }, [animated, format, maxPx, state]);

  // ANIMATED — BPM-driven motion loop (space-only; contrast/saturation via CSS
  // filter, exactly like the live editor's animate path).
  useEffect(() => {
    if (!animated) return;
    const c = ref.current;
    if (!c) return;
    const { w, h } = fitDims(format, maxPx);
    c.width = w;
    c.height = h;
    let raf = 0;
    let t0 = 0;
    ensureCoverFont(stateRef.current.textFont);
    const loop = (now: number) => {
      if (!t0) t0 = now;
      try {
        const s = stateRef.current;
        const sp = 0.3 + (s.animSpeed / 100) * 1.7;
        const rt = (now - t0) / 1000;
        const t = rt * sp;
        renderFormatTo(c, { ...renderParams(s), _anim: true, _t: t, _rt: rt }, scratch());
        const cc = 1 + ((s.contrast - 50) / 50) * 0.7;
        const sf = s.saturation / 50;
        c.style.filter = `contrast(${cc.toFixed(3)}) saturate(${sf.toFixed(3)})`;
      } catch {
        /* never let a bad frame kill the loop */
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [animated, format, maxPx]);

  return <canvas ref={ref} className={className} />;
}
