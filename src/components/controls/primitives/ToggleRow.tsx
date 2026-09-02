"use client";

import { memo } from "react";
import { Switch as UISwitch } from "@/components/ui/switch";
import { useStudio } from "@/lib/store";
import { Label } from "./Label";
import type { BoolKey } from "./keys";

// ── Toggle row (label + shadcn Switch) ───────────────────────────────────────
// Self-subscribing: reads ONLY its own boolean store slice and writes through
// the stable `setState` action. Memoized so it ignores unrelated store churn.
// A real <label> so clicking the text toggles the switch; with the switch's
// `after:` hit area the whole row is a 42px-tall target.
export interface ToggleRowProps {
  paramKey: BoolKey;
  label: string;
}

function ToggleRowInner({ paramKey, label }: ToggleRowProps) {
  const value = useStudio((s) => s[paramKey]);
  const setState = useStudio((s) => s.setState);

  return (
    <label className="mt-6 mb-3 flex h-8 cursor-pointer items-center justify-between">
      <Label>{label}</Label>
      <UISwitch
        checked={value}
        onCheckedChange={(v) =>
          setState({ [paramKey]: v } as Parameters<typeof setState>[0])
        }
      />
    </label>
  );
}

export const ToggleRow = memo(ToggleRowInner);
ToggleRow.displayName = "ToggleRow";
