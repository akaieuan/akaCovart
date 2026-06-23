"use client";

import { type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { MICRO } from "./typography";

// ── Group sub-heading ────────────────────────────────────────────────────────
export function GroupLabel({
  children,
  variant = "default",
}: {
  children: ReactNode;
  variant?: "default" | "sub" | "beat";
}) {
  if (variant === "sub") {
    return (
      <div className={cn(MICRO, "mb-2 tracking-[0.01em] text-grey-350")}>
        {children}
      </div>
    );
  }
  if (variant === "beat") {
    return (
      <div className="mb-[14px] font-sans text-[12px] font-medium tracking-[0.01em] text-grey-300">
        {children}
      </div>
    );
  }
  return (
    <div
      className={cn(
        MICRO,
        "mt-[18px] mb-3 font-medium tracking-[0.01em] text-grey-300",
      )}
    >
      {children}
    </div>
  );
}
