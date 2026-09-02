"use client";

import { memo } from "react";
import { cn } from "@/lib/utils";
import { useStudio, makeSeeds, randSeed } from "@/lib/store";
import { GroupLabel } from "./primitives";
import { CONTROL, FOCUS, MICRO } from "./primitives/typography";
import { getPresets } from "@/presets";

// ── Presets grid ─────────────────────────────────────────────────────────────
// Stateless aside from the stable `setState` action — never reads a param slice,
// so it never re-renders on a slider tick. Memoized for completeness.
function PresetsInner() {
  const setState = useStudio((s) => s.setState);
  const presets = getPresets();

  return (
    <>
      <GroupLabel>Presets</GroupLabel>
      <div className="mb-2 grid grid-cols-4 gap-2">
        {presets.length === 0 ? (
          <span className={cn(MICRO, "col-span-4 text-grey-300")}>No presets</span>
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
              className={cn(
                CONTROL,
                FOCUS,
                "h-10 rounded-control border border-edge bg-grey-880 px-1 text-center text-grey-200 transition-colors hover:border-edge-hover hover:text-grey-100 active:bg-grey-850",
              )}
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
