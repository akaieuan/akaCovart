"use client";

import { cn } from "@/lib/utils";

/**
 * Transparent floating header. No border, no background — the akaCOVART
 * wordmark sits over the canvas backdrop at the top-left. Optional right-side
 * slot for minimal actions (e.g. a mobile controls trigger), kept quiet.
 */
export default function TopBar({
  className,
  actions,
}: {
  className?: string;
  actions?: React.ReactNode;
}) {
  return (
    <header
      className={cn(
        "pointer-events-none absolute inset-x-0 top-0 z-30 flex items-center justify-between px-5 py-4 sm:px-7 sm:py-5",
        className,
      )}
    >
      <span className="pointer-events-auto inline-flex items-baseline select-none">
        <span className="font-mono text-[15px] font-light tracking-[0.3em] text-grey-350">
          aka
        </span>
        <span className="font-mono text-[15px] font-semibold tracking-[0.3em] text-grey-100">
          COVART
        </span>
      </span>
      {actions ? (
        <div className="pointer-events-auto flex items-center gap-2">
          {actions}
        </div>
      ) : null}
    </header>
  );
}
