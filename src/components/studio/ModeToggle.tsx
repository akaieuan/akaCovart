"use client";

import { useStudio } from "@/lib/store";
import { cn } from "@/lib/utils";
import { CONTROL, FOCUS, TRAY, TRAY_ACTIVE, TRAY_IDLE, TRAY_ITEM } from "@/components/controls/primitives/typography";

/** STILL / ANIMATE mode toggle. (Audio is now a driver of Animate, not a mode.) */
export function ModeToggle({ className }: { className?: string }) {
  const mode = useStudio((s) => s.mode);
  const setState = useStudio((s) => s.setState);
  const opts: { value: "still" | "animate"; label: string }[] = [
    { value: "still", label: "Still" },
    { value: "animate", label: "Animate" },
  ];
  return (
    // The shared "tray" recipe (same as Segmented / EngineSelector): 4px inset,
    // 1px edge, 32px items → a 40px control (40px ITEMS on phones — it is a
    // primary control there, so the items themselves clear the touch floor).
    // Fill carries the active state, the weight never changes, so the label
    // doesn't jitter on toggle.
    <div
      className={cn(TRAY, className)}
    >
      {opts.map((o) => {
        const active = mode === o.value;
        return (
          <button
            key={o.value}
            type="button"
            onClick={() => setState({ mode: o.value })}
            aria-pressed={active}
            className={cn(CONTROL, FOCUS, TRAY_ITEM, active ? TRAY_ACTIVE : TRAY_IDLE)}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
