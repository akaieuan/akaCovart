"use client";

import { useStudio } from "@/lib/store";
import { cn } from "@/lib/utils";
import { CONTROL, MICRO, TITLE } from "@/components/controls/primitives/typography";
import StartGrid from "./StartGrid";
import { NAV_ACTIVE, NAV_IDLE, NAV_ITEM } from "./Header";
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
  // header (pt-16 — the header pills are 40px on phones) and the square grid is
  // capped by the container's own CONTENT-box height (cqh = inner height,
  // padding excluded) minus the Style row + title + gaps (~8.5rem), so on a phone — where the edit dock leaves the
  // stage short — the Style row, title and grid all stay visible and tappable
  // instead of centring up under the header or spilling under the dock.
  return (
    <div className="absolute inset-0 z-20 flex flex-col items-center justify-start gap-4 bg-[radial-gradient(circle_at_50%_40%,#121215,#0a0a0b_72%)] px-6 pt-16 pb-3 [container-type:size] sm:gap-6 md:justify-center md:pb-8">
      {/* Style switcher, integrated into the picker so the lanes are discoverable
          right where the tiles are (the header dropdown alone went unnoticed).
          Same pill language as the header's view nav; the grid below re-renders
          per lane on its own. */}
      <div className="flex items-center gap-2">
        <span className={cn(MICRO, "text-grey-300")}>Style</span>
        <nav
          aria-label="Style"
          className="flex items-center gap-0.5 rounded-full border border-edge bg-panel/85 p-0.5 backdrop-blur-xl max-sm:p-0"
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
                className={cn(NAV_ITEM, active ? NAV_ACTIVE : NAV_IDLE)}
              >
                {o.label}
              </button>
            );
          })}
        </nav>
      </div>
      <div className="text-center">
        <div className={cn(TITLE, "text-grey-100")}>
          Choose a starting point
        </div>
        <div className={cn(CONTROL, "mt-1 text-grey-300")}>
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
        className="w-[min(86vw,420px,calc(100cqh_-_8.5rem))] gap-2.5"
      />
    </div>
  );
}
