"use client";

import { RefreshCw } from "lucide-react";

import { useStudio } from "@/lib/store";
import { cn } from "@/lib/utils";
import { CONTROL, DATA, FOCUS, FOCUS_FIELD } from "@/components/controls/primitives/typography";

/** Seed number field + GENERATE (new random seed). */
export function SeedRow() {
  const seed = useStudio((s) => s.seed);
  const setState = useStudio((s) => s.setState);
  const newSeed = useStudio((s) => s.newSeed);

  return (
    <div className="flex gap-2">
      {/* The seed is DATA (numerals only), so it takes the mono role; the number
          spinner is hidden globally so the field reads as a plain readout. */}
      <input
        type="number"
        value={seed}
        onChange={(e) => setState({ seed: Number(e.target.value) })}
        aria-label="Seed"
        className={cn(
          DATA,
          FOCUS_FIELD,
          "h-10 min-w-0 flex-1 rounded-control border border-edge bg-grey-880 px-3 text-grey-100 transition-colors hover:border-edge-hover",
        )}
      />
      <button
        type="button"
        onClick={newSeed}
        className={cn(
          CONTROL,
          FOCUS,
          "flex h-10 flex-none items-center gap-2 rounded-control bg-grey-100 px-4 font-medium whitespace-nowrap text-bg transition-colors hover:bg-white active:bg-grey-200",
        )}
      >
        <RefreshCw className="size-[13px]" />
        Generate
      </button>
    </div>
  );
}
