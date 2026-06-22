"use client";

import { useStudio } from "@/lib/store";
import { cn } from "@/lib/utils";

/** STILL / ANIMATE mode toggle. (Audio is now a driver of Animate, not a mode.) */
export function ModeToggle({ className }: { className?: string }) {
  const mode = useStudio((s) => s.mode);
  const setState = useStudio((s) => s.setState);
  const opts: { value: "still" | "animate"; label: string }[] = [
    { value: "still", label: "Still" },
    { value: "animate", label: "Animate" },
  ];
  return (
    <div
      className={cn(
        "grid grid-cols-2 gap-[2px] rounded-[5px] border border-grey-800 bg-grey-880 p-[3px]",
        className,
      )}
    >
      {opts.map((o) => {
        const active = mode === o.value;
        return (
          <button
            key={o.value}
            type="button"
            onClick={() => setState({ mode: o.value })}
            className={cn(
              "flex h-9 items-center justify-center rounded-[3px] px-1 text-[12px] font-normal transition-colors",
              active
                ? "bg-grey-100 text-bg"
                : "bg-transparent text-grey-300 hover:bg-grey-850 hover:text-grey-150",
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
