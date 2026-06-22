"use client";

import { useEffect, useRef } from "react";
import { renderTo } from "@/engine";
import { useStudio, renderParams, type StudioState } from "@/lib/store";

const THUMB = 156;

// Only image-affecting params (no text/seed) plus the seed list. This derived
// signature is what the gallery SUBSCRIBES to — so the component re-renders only
// when something that changes the thumbnails changes, not on a text/seed tick.
function gallerySig(s: StudioState): string {
  return [
    s.mood,
    s.colorTone,
    s.colorPick,
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
    s.contourLines,
    s.contourWeight,
    s.contourScale,
    s.contourDetail,
    s.contourWarp,
    s.contourRelief,
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
    s.scratches,
    s.scratchCount,
    s.textFont,
    s.mode,
  ].join("|") +
    "||" +
    s.gallerySeeds.join(",");
}

export default function Gallery() {
  const refs = useRef<(HTMLCanvasElement | null)[]>([]);
  const lastSig = useRef<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Subscribe narrowly to the derived signature + seed list. The component now
  // re-renders ONLY when a thumbnail-affecting param actually changes — a slider
  // tick that doesn't touch these (or a text edit) does nothing here.
  const sig = useStudio(gallerySig);
  const gallerySeeds = useStudio((s) => s.gallerySeeds);
  const setState = useStudio((s) => s.setState);
  const rerollGallery = useStudio((s) => s.rerollGallery);

  useEffect(() => {
    // Read the full param bag lazily — we don't subscribe to it, so this effect
    // re-runs only when `sig` changes (its dependency below).
    const state = useStudio.getState();
    // Only render thumbnails in still mode.
    if (state.mode !== "still") return;
    if (sig === lastSig.current) return;
    // Debounce: rendering 9 thumbnails (blur + getImageData each) is expensive,
    // so only do it once params settle — NOT on every slider tick. This is the
    // big drag-fluidity win.
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      const cur = useStudio.getState();
      lastSig.current = sig;
      cur.gallerySeeds.forEach((seed, i) => {
        const el = refs.current[i];
        if (!el) return;
        el.width = THUMB;
        el.height = THUMB;
        renderTo(el, THUMB, { ...renderParams(cur), seed, showText: false });
      });
    }, 200);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [sig]);

  return (
    <div>
      <div className="mb-[9px] flex items-center justify-between">
        <span className="font-sans text-[11px] font-medium text-grey-350">
          Variations
        </span>
        <button
          type="button"
          onClick={rerollGallery}
          className="rounded-[3px] border border-grey-800 px-[10px] py-[5px] font-sans text-[11px] font-medium text-grey-250 hover:border-grey-500 hover:text-grey-100"
        >
          ↻ More
        </button>
      </div>
      <div className="grid grid-cols-3 gap-[6px]">
        {gallerySeeds.map((seed, i) => (
          <button
            key={i}
            type="button"
            onClick={() => setState({ seed: Number(seed) })}
            className="relative aspect-square overflow-hidden rounded-[3px] border border-[#1e1e22] bg-black p-0 leading-none hover:border-grey-450"
          >
            <canvas
              ref={(el) => {
                refs.current[i] = el;
              }}
              className="block h-full w-full"
            />
          </button>
        ))}
      </div>
    </div>
  );
}
