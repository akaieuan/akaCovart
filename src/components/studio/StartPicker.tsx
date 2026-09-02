"use client";

import { useStudio } from "@/lib/store";
import { cn } from "@/lib/utils";
import StartGrid from "./StartGrid";
import { FOCUS_OPTIONS, switchFocus } from "./focus";
import { type Preset } from "@/components/intro/scenes";

/**
 * StartPicker — the studio's blank-canvas first-run state, shown over the canvas
 * when the visitor enters. Focus-aware (Art looks / type looks). Fully opaque so
 * the canvas never shows through. Re-openable from the header "Starts" dropdown,
 * which shares the same StartGrid.
 */
export default function StartPicker({ onPick }: { onPick: (look: Preset) => void }) {
  const focus = useStudio((s) => s.focus);
  // Mirrors CanvasStage: the root is a SIZE CONTAINER that clears the floating
  // header (pt-14 / md:pt-16) and the square grid is capped by the container's
  // own CONTENT-box height (cqh = inner height, padding excluded) minus the Style
  // row + title + gaps (~7.5rem), so on a phone — where the edit dock leaves the
  // stage short — the Style row, title and grid all stay visible and tappable
  // instead of centring up under the header or spilling under the dock.
  return (
    <div className="absolute inset-0 z-20 flex flex-col items-center justify-start gap-3 bg-[radial-gradient(circle_at_50%_40%,#121215,#0a0a0b_72%)] px-6 pt-14 pb-3 [container-type:size] sm:gap-5 md:justify-center md:pt-16 md:pb-8">
      {/* Style switcher, integrated into the picker so the lanes are discoverable
          right where the tiles are (the header dropdown alone went unnoticed).
          Same pill language as the header's view nav; the grid below re-renders
          per lane on its own. */}
      <div className="flex items-center gap-2">
        <span className="font-sans text-[11px] text-grey-400">Style</span>
        <nav
          aria-label="Style"
          className="flex items-center gap-0.5 rounded-full border border-white/10 bg-panel/70 p-0.5 backdrop-blur-xl"
        >
          {FOCUS_OPTIONS.map((o) => {
            const active = o.value === focus;
            return (
              <button
                key={o.value}
                type="button"
                onClick={() => switchFocus(o.value)}
                title={o.hint}
                aria-pressed={active}
                className={cn(
                  "inline-flex h-[26px] items-center rounded-full px-2.5 text-[11px] font-medium transition-colors",
                  active ? "bg-grey-100 text-bg" : "text-grey-300 hover:bg-white/5 hover:text-white",
                )}
              >
                {o.label}
              </button>
            );
          })}
        </nav>
      </div>
      <div className="text-center">
        <div className="font-sans text-[15px] font-medium text-grey-100">
          Choose a starting point
        </div>
        <div className="mt-1 font-sans text-[12px] text-grey-400">
          {focus === "stack"
            ? "Pick an art + type combo — or go random."
            : focus === "txt"
              ? "Pick a type treatment — or go random."
              : focus === "oil"
                ? "Pick a scene to paint — or go random."
                : "Pick a look to shape — or go random."}
        </div>
      </div>
      <StartGrid
        onPick={onPick}
        className="w-[min(86vw,420px,calc(100cqh_-_7.5rem))] gap-2.5"
      />
    </div>
  );
}
