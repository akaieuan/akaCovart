"use client";

import { type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { GROUP } from "./typography";

// ── Group heading (the only in-panel heading) ────────────────────────────────
// One render path: the air ABOVE a group comes from its wrapper (renderGroups'
// `not-first:mt-6`, a Divider, or the section body padding), never from the
// heading — so the same heading sits right under a Divider or a section top.
export function GroupLabel({ children }: { children: ReactNode }) {
  return <div className={cn(GROUP, "mb-3 text-grey-200")}>{children}</div>;
}
