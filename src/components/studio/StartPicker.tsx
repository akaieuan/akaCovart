"use client";

import { useStudio } from "@/lib/store";
import StartGrid from "./StartGrid";
import { type Preset } from "@/components/intro/scenes";

/**
 * StartPicker — the studio's blank-canvas first-run state, shown over the canvas
 * when the visitor enters. Focus-aware (Art looks / type looks). Fully opaque so
 * the canvas never shows through. Re-openable from the header "Starts" dropdown,
 * which shares the same StartGrid.
 */
export default function StartPicker({ onPick }: { onPick: (look: Preset) => void }) {
  const focus = useStudio((s) => s.focus);
  return (
    <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-5 bg-[radial-gradient(circle_at_50%_40%,#121215,#0a0a0b_72%)] px-6">
      <div className="text-center">
        <div className="font-sans text-[15px] font-medium text-grey-100">
          Choose a starting point
        </div>
        <div className="mt-1 font-sans text-[12px] text-grey-400">
          {focus === "txt"
            ? "Pick a type treatment — or go random."
            : "Pick a look to shape — or go random."}
        </div>
      </div>
      <StartGrid onPick={onPick} className="w-[min(86vw,420px)] gap-2.5" />
    </div>
  );
}
