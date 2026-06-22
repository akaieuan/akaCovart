"use client";

import { useEffect, useRef } from "react";
import { renderTo } from "@/engine";
import { useStudio, renderParams, type StudioState } from "@/lib/store";

const THUMB = 156;

// Only image-affecting params (no text/seed) plus the seed list.
function gallerySig(s: StudioState): string {
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
    s.mode,
  ].join("|") +
    "||" +
    s.gallerySeeds.join(",");
}

export default function Gallery() {
  const refs = useRef<(HTMLCanvasElement | null)[]>([]);
  const lastSig = useRef<string | null>(null);
  const state = useStudio();
  const setState = useStudio((s) => s.setState);
  const rerollGallery = useStudio((s) => s.rerollGallery);

  useEffect(() => {
    // Pause thumbnail work while the main stage animates.
    if (state.mode === "animate") return;
    const s = gallerySig(state);
    if (s === lastSig.current) return;
    lastSig.current = s;
    state.gallerySeeds.forEach((seed, i) => {
      const el = refs.current[i];
      if (!el) return;
      el.width = THUMB;
      el.height = THUMB;
      renderTo(el, THUMB, { ...renderParams(state), seed, showText: false });
    });
  }, [state]);

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
        {state.gallerySeeds.map((seed, i) => (
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
