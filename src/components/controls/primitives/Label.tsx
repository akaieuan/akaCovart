"use client";

import { type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { CONTROL } from "./typography";

// ── Control label ────────────────────────────────────────────────────────────
// grey-250 (≈7:1 on the panel, still AA on a glass pill over mid-grey art);
// `sub` steps down to grey-300, the floor for any text. Indent for sub rows
// lives on the row, not here.
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
    <span className={cn(CONTROL, sub ? "text-grey-300" : "text-grey-250", className)}>
      {children}
    </span>
  );
}
