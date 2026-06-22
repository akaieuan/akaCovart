"use client";

import { type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { MICRO } from "./typography";

// ── Micro-label ──────────────────────────────────────────────────────────────
export function Label({
  children,
  sub,
  className,
}: {
  children: ReactNode;
  sub?: boolean;
  className?: string;
}) {
  return (
    <span className={cn(MICRO, sub ? "text-grey-350" : "text-grey-300", className)}>
      {children}
    </span>
  );
}
