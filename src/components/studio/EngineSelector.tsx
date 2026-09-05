"use client";

import {
  Circle,
  Grid3x3,
  Activity,
  Droplet,
  Spline,
  Grip,
  AlignJustify,
  Sparkles,
  Mountain,
} from "lucide-react";
import { useStudio } from "@/lib/store";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { cn } from "@/lib/utils";
import { FOCUS, MICRO } from "@/components/controls/primitives/typography";
import { enginesFor, type Focus } from "./focus";

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
  { value: "signal", label: "Signal", Icon: Activity },
  { value: "oil", label: "Oil", Icon: Mountain },
  { value: "dither", label: "Dither", Icon: Grip },
  { value: "lines", label: "Lines", Icon: AlignJustify },
  { value: "blur", label: "Blur", Icon: Sparkles },
];

const DEF_BY_ID = new Map(ENGINE_DEFS.map((d) => [d.value, d]));

// Tailwind needs static column classes; map the visible count (Art=4, TxT=3,
// Stack=5 — the art roster plus Oil).
const GRID_COLS: Record<number, string> = {
  1: "grid-cols-1",
  2: "grid-cols-2",
  3: "grid-cols-3",
  4: "grid-cols-4",
  5: "grid-cols-5",
  6: "grid-cols-6",
};

// Engines for the active focus, in registration order, decorated with icon/label.
// The ROSTER comes from focus.ts (the one lane table — Stack resolves to the art
// engines plus Oil there); this only supplies the icons and labels.
function engineList(focus: Focus): EngineDef[] {
  const reg = enginesFor(focus);
  if (!reg.length) return ENGINE_DEFS.slice(0, 4);
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
  // In Stack the top selector picks the background (its `engine`); the overlay
  // type engine is chosen in the Text-layer panel.
  const engines = engineList(focus);
  // A lane with a single engine (Oil) has nothing to switch — no stripe.
  if (engines.length < 2) return null;

  return (
    <ToggleGroup
      value={[engine]}
      onValueChange={(vals) => {
        // single-select: ignore the empty array (deselecting the active item)
        const next = vals.find((v) => v !== engine);
        if (next) setState({ engine: next });
      }}
      spacing={1}
      className={cn(
        // Shared tray recipe (ModeToggle / Segmented): 4px inset, 1px edge,
        // 40px items → a 48px control.
        "grid w-full gap-1 rounded-control border border-edge bg-grey-880 p-1",
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
            MICRO,
            FOCUS,
            // Fill carries the selected state (base-ui emits `data-pressed`);
            // the weight never changes so labels don't jitter on switch.
            "flex h-10 flex-col items-center justify-center gap-0.5 rounded-[2px] border-0 bg-transparent px-0.5 text-grey-250 transition-colors hover:bg-wash-active hover:text-grey-100 active:bg-wash-active data-pressed:bg-grey-100 data-pressed:text-bg data-pressed:hover:bg-grey-100",
          )}
        >
          <Icon className="size-[14px]" />
          {label}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  );
}
