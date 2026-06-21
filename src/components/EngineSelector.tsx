"use client";

import { Circle, Grid3x3, Waves, Droplet } from "lucide-react";
import { listEngines } from "@/engine";
import { useStudio } from "@/lib/store";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { cn } from "@/lib/utils";

// Engine display config. Labels + icons are driven from this single map so the
// selector stays DRY; ordering/availability still defers to the registry.
type EngineDef = {
  value: string;
  label: string;
  Icon: React.ComponentType<{ className?: string }>;
};

const ENGINE_DEFS: EngineDef[] = [
  { value: "blob", label: "BLOB", Icon: Droplet },
  { value: "grid", label: "GRID", Icon: Grid3x3 },
  { value: "waves", label: "WAVE", Icon: Waves },
  { value: "orb", label: "ORB", Icon: Circle },
];

const DEF_BY_ID = new Map(ENGINE_DEFS.map((d) => [d.value, d]));

// Prefer the live registry (matches whatever engines are registered) but fall
// back to the known four so the selector renders even if registration is empty.
function engineList(): EngineDef[] {
  const reg = listEngines();
  if (!reg.length) return ENGINE_DEFS;
  return reg.map(
    (e) =>
      DEF_BY_ID.get(e.id) ?? {
        value: e.id,
        label: e.label.toUpperCase(),
        Icon: Circle,
      },
  );
}

export default function EngineSelector({ className }: { className?: string }) {
  const engine = useStudio((s) => s.engine);
  const setState = useStudio((s) => s.setState);
  const engines = engineList();

  return (
    <ToggleGroup
      value={[engine]}
      onValueChange={(vals) => {
        // single-select: ignore the empty array (deselecting the active item)
        const next = vals.find((v) => v !== engine);
        if (next) setState({ engine: next });
      }}
      spacing={0}
      className={cn(
        "grid w-full grid-cols-4 gap-[2px] rounded-[5px] border border-grey-800 bg-grey-880 p-[3px]",
        className,
      )}
    >
      {engines.map(({ value, label, Icon }) => {
        const active = value === engine;
        return (
          <ToggleGroupItem
            key={value}
            value={value}
            aria-label={label}
            className={cn(
              "flex h-11 flex-col items-center justify-center gap-[3px] rounded-[3px] border-0 font-mono text-[9px] font-semibold tracking-[0.18em] transition-colors",
              "hover:bg-grey-850 hover:text-grey-150",
              active
                ? "bg-grey-100 text-bg hover:bg-grey-100 hover:text-bg"
                : "bg-transparent text-grey-300",
            )}
          >
            <Icon className="size-[15px]" />
            {label}
          </ToggleGroupItem>
        );
      })}
    </ToggleGroup>
  );
}
