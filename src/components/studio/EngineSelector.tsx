"use client";

import {
  Circle,
  Grid3x3,
  Activity,
  Droplet,
  Spline,
  Wind,
  Grip,
  AlignJustify,
  Sparkles,
} from "lucide-react";
import { listEnginesByFocus } from "@/engine";
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

// Art (abstract field) + TxT (type) engines. The registry decides which are
// actually available + their order; this only supplies labels + icons.
const ENGINE_DEFS: EngineDef[] = [
  { value: "blob", label: "Blob", Icon: Droplet },
  { value: "grid", label: "Grid", Icon: Grid3x3 },
  { value: "contours", label: "Contours", Icon: Spline },
  { value: "flux", label: "Flux", Icon: Wind },
  { value: "signal", label: "Signal", Icon: Activity },
  { value: "dither", label: "Dither", Icon: Grip },
  { value: "lines", label: "Lines", Icon: AlignJustify },
  { value: "blur", label: "Blur", Icon: Sparkles },
];

const DEF_BY_ID = new Map(ENGINE_DEFS.map((d) => [d.value, d]));

// Tailwind needs static column classes; map the visible count (Art=5, TxT=4).
const GRID_COLS: Record<number, string> = {
  1: "grid-cols-1",
  2: "grid-cols-2",
  3: "grid-cols-3",
  4: "grid-cols-4",
  5: "grid-cols-5",
  6: "grid-cols-6",
};

// Engines for the active focus, in registration order, decorated with icon/label.
function engineList(focus: "art" | "txt"): EngineDef[] {
  const reg = listEnginesByFocus(focus);
  if (!reg.length) return ENGINE_DEFS.slice(0, 5);
  return reg.map(
    (e) =>
      DEF_BY_ID.get(e.id) ?? {
        value: e.id,
        label: e.label,
        Icon: Circle,
      },
  );
}

export default function EngineSelector({ className }: { className?: string }) {
  const engine = useStudio((s) => s.engine);
  const focus = useStudio((s) => s.focus);
  const setState = useStudio((s) => s.setState);
  const engines = engineList(focus);

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
        "grid w-full gap-[2px] rounded-[5px] border border-grey-800 bg-grey-880 p-[3px]",
        GRID_COLS[engines.length] ?? "grid-cols-5",
        className,
      )}
    >
      {engines.map(({ value, label, Icon }) => (
        <ToggleGroupItem
          key={value}
          value={value}
          aria-label={label}
          className={cn(
            "flex h-11 flex-col items-center justify-center gap-[3px] rounded-[3px] border-0 bg-transparent px-0.5 text-[10px] leading-tight font-normal text-grey-300 transition-colors",
            // idle hover
            "hover:bg-grey-850 hover:text-grey-150",
            // SELECTED: override the shadcn/base-ui default (data-[state=on]:bg-muted /
            // aria-pressed:bg-muted = grey) so the active engine reads as a white pill.
            "data-[state=on]:bg-grey-100 data-[state=on]:text-bg",
            "data-[state=on]:hover:bg-grey-100 data-[state=on]:hover:text-bg",
            "aria-pressed:bg-grey-100 aria-pressed:text-bg",
            "aria-pressed:hover:bg-grey-100 aria-pressed:hover:text-bg",
          )}
        >
          <Icon className="size-[14px]" />
          {label}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  );
}
