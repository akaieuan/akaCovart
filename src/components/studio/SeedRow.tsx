"use client";

import { RefreshCw } from "lucide-react";

import { useStudio } from "@/lib/store";

/** Seed number field + GENERATE (new random seed). */
export function SeedRow() {
  const seed = useStudio((s) => s.seed);
  const setState = useStudio((s) => s.setState);
  const newSeed = useStudio((s) => s.newSeed);

  return (
    <div className="flex gap-2">
      <input
        type="number"
        value={seed}
        onChange={(e) => setState({ seed: Number(e.target.value) })}
        aria-label="Seed"
        className="h-10 min-w-0 flex-1 rounded-[4px] border border-grey-780 bg-grey-880 px-3 text-[12px] font-normal text-ink outline-none transition-colors focus:border-grey-500"
      />
      <button
        type="button"
        onClick={newSeed}
        className="flex h-10 flex-none items-center gap-[7px] rounded-[4px] bg-grey-100 px-[18px] text-[12px] font-medium whitespace-nowrap text-bg transition-colors hover:bg-white"
      >
        <RefreshCw className="size-[13px]" />
        Generate
      </button>
    </div>
  );
}
