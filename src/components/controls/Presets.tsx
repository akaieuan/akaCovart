"use client";

import { memo } from "react";
import { useStudio, makeSeeds, randSeed } from "@/lib/store";
import { GroupLabel } from "./primitives";
import { getPresets } from "@/presets";

// ── Presets grid ─────────────────────────────────────────────────────────────
// Stateless aside from the stable `setState` action — never reads a param slice,
// so it never re-renders on a slider tick. Memoized for completeness.
function PresetsInner() {
  const setState = useStudio((s) => s.setState);
  const presets = getPresets();

  return (
    <>
      <GroupLabel variant="sub">Presets</GroupLabel>
      <div className="mb-4 grid grid-cols-4 gap-[6px]">
        {presets.length === 0 ? (
          <span className="col-span-4 font-sans text-[11px] text-grey-400">
            No presets
          </span>
        ) : (
          presets.map((p, i) => (
            <button
              key={i}
              type="button"
              onClick={() =>
                setState({
                  ...(p.engine ? { engine: p.engine } : {}),
                  ...p.params,
                  seed: p.seed ?? randSeed(),
                  gallerySeeds: makeSeeds(9),
                })
              }
              className="rounded-[4px] border border-grey-800 bg-grey-880 px-1 py-[10px] text-center font-sans text-[11px] font-medium text-grey-200 transition-colors hover:border-grey-500 hover:bg-grey-850 hover:text-grey-100"
            >
              {p.name}
            </button>
          ))
        )}
      </div>
    </>
  );
}

export const Presets = memo(PresetsInner);
Presets.displayName = "Presets";
