"use client";

import { memo } from "react";
import { cn } from "@/lib/utils";
import { Input as UIInput } from "@/components/ui/input";
import { useStudio } from "@/lib/store";
import type { StrKey } from "./keys";

// ── Text input (shadcn Input, mono micro-type) ───────────────────────────────
// Self-subscribing: reads ONLY its own string store slice and writes through
// the stable `setState` action. Memoized so it ignores unrelated store churn.
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
      className={cn(
        "h-[38px] rounded-[5px] border-grey-800/80 bg-grey-880/40 px-3 font-sans text-[12px] text-ink transition-colors hover:border-grey-700 focus-visible:border-grey-600",
        muted ? "font-normal text-grey-200" : "font-medium",
        className,
      )}
    />
  );
}

export const TextRow = memo(TextRowInner);
TextRow.displayName = "TextRow";
