"use client";

import { memo } from "react";
import { Switch as UISwitch } from "@/components/ui/switch";
import { useStudio } from "@/lib/store";
import { Label } from "./Label";
import type { BoolKey } from "./keys";

// ── Toggle row (label + shadcn Switch) ───────────────────────────────────────
// Self-subscribing: reads ONLY its own boolean store slice and writes through
// the stable `setState` action. Memoized so it ignores unrelated store churn.
export interface ToggleRowProps {
  paramKey: BoolKey;
  label: string;
}

function ToggleRowInner({ paramKey, label }: ToggleRowProps) {
  const value = useStudio((s) => s[paramKey]);
  const setState = useStudio((s) => s.setState);

  return (
    <div className="mt-[18px] mb-3 flex items-center justify-between">
      <Label className="!text-grey-300">{label}</Label>
      <UISwitch
        checked={value}
        onCheckedChange={(v) =>
          setState({ [paramKey]: v } as Parameters<typeof setState>[0])
        }
      />
    </div>
  );
}

export const ToggleRow = memo(ToggleRowInner);
ToggleRow.displayName = "ToggleRow";
