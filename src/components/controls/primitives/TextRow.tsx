"use client";

import { memo } from "react";
import { cn } from "@/lib/utils";
import { Input as UIInput } from "@/components/ui/input";
import { useStudio } from "@/lib/store";
import type { StrKey } from "./keys";
import { CONTROL } from "./typography";

// ── Text input (shadcn Input) ────────────────────────────────────────────────
// Self-subscribing: reads ONLY its own string store slice and writes through
// the stable `setState` action. Memoized so it ignores unrelated store churn.
// Border / fill / focus come from the Input atom; this only sets height, type
// role and ink. `muted` (the subline / artist field) is quieter by colour, not
// weight — both fields are 400.
export interface TextRowProps {
  paramKey: StrKey;
  placeholder?: string;
  muted?: boolean;
  className?: string;
}

function TextRowInner({ paramKey, placeholder, muted, className }: TextRowProps) {
  const value = useStudio((s) => s[paramKey]);
  const setState = useStudio((s) => s.setState);

  return (
    <UIInput
      type="text"
      value={value}
      placeholder={placeholder}
      onChange={(e) =>
        setState({ [paramKey]: e.target.value } as Parameters<typeof setState>[0])
      }
      className={cn(CONTROL, "h-10 px-3", muted ? "text-grey-250" : "text-grey-100", className)}
    />
  );
}

export const TextRow = memo(TextRowInner);
TextRow.displayName = "TextRow";
