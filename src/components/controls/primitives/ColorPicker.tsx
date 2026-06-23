"use client";

import { memo, useEffect, useState } from "react";
import { HexColorPicker } from "react-colorful";
import { cn } from "@/lib/utils";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useStudio } from "@/lib/store";
import { parseHex } from "@/engine";
import { Label } from "./Label";

// ── Color picker (swatch button -> shadcn Popover w/ react-colorful) ──────────
// Replaces the abstract hue/saturation sliders. The user picks a real colour and
// the whole palette is shifted toward it (see engine `recolorPalette`), so every
// engine recolours live. `null` = the mood palette's original colours.
//
// Self-subscribing: reads ONLY its own `colorPick` slice (via paramKey) and
// writes through the stable `setState` action. Memoised so it ignores unrelated
// store churn — same pattern as the other primitives.

// A tasteful spread of quick picks. Each chip sets colorPick directly.
const PRESETS: string[] = [
  "#2bb6a3", // teal
  "#e0a83a", // amber
  "#c84b9e", // magenta
  "#3b5bd6", // deep blue
  "#b5552f", // rust
  "#8bc34a", // lime
  "#8a5bd6", // violet
  "#6a6a78", // slate
];

// Normalise to a "#rrggbb" for the picker; fall back to a neutral so the
// react-colorful canvas always has a valid colour to seat its cursor on.
const DEFAULT_PICK = "#888888";

export interface ColorPickerProps {
  /** Store key holding the picked hex (or null). */
  paramKey: "colorPick";
  label?: string;
  className?: string;
}

function ColorPickerInner({
  paramKey,
  label = "Color",
  className,
}: ColorPickerProps) {
  const value = useStudio((s) => s[paramKey]); // string | null
  const setState = useStudio((s) => s.setState);
  const set = (hex: string | null) => setState({ [paramKey]: hex });

  // Local draft for the hex text field so typing partial values doesn't thrash
  // the store; commit only when it parses to a valid colour.
  const [draft, setDraft] = useState(value ?? "");
  useEffect(() => {
    setDraft(value ?? "");
  }, [value]);

  const active = typeof value === "string" && !!value;
  const pickerColor = active ? value : DEFAULT_PICK;

  const commitHex = (raw: string) => {
    const rgb = parseHex(raw);
    if (rgb) {
      const hex =
        "#" +
        rgb
          .map((n) => n.toString(16).padStart(2, "0"))
          .join("");
      set(hex);
    }
  };

  return (
    <div className={cn("mb-4", className)}>
      <div className="mb-2 flex items-center justify-between">
        <Label className="!text-grey-300">{label}</Label>
        {active && (
          <button
            type="button"
            onClick={() => set(null)}
            className="bg-transparent font-sans text-[11px] font-normal text-grey-350 hover:text-grey-150"
          >
            Reset
          </button>
        )}
      </div>

      <Popover>
        <PopoverTrigger
          render={
            <button
              type="button"
              className={cn(
                "flex w-full items-center gap-2.5 rounded-[5px] border border-grey-800/80 bg-grey-880/40 px-2.5 py-2 transition-colors",
                "hover:border-grey-700 hover:bg-grey-850/60",
              )}
            >
              <span
                className="size-5 shrink-0 rounded-[4px] border border-grey-600 shadow-sm"
                style={
                  active
                    ? { background: value }
                    : {
                        // subtle "none" state: a faint checker so it reads as empty
                        backgroundImage:
                          "linear-gradient(45deg,#26262a 25%,transparent 25%),linear-gradient(-45deg,#26262a 25%,transparent 25%),linear-gradient(45deg,transparent 75%,#26262a 75%),linear-gradient(-45deg,transparent 75%,#26262a 75%)",
                        backgroundSize: "8px 8px",
                        backgroundPosition: "0 0,0 4px,4px -4px,-4px 0",
                      }
                }
              />
              <span className="font-sans text-[12px] font-normal text-grey-200">
                {active ? value : "Original palette"}
              </span>
            </button>
          }
        />
        <PopoverContent
          align="start"
          sideOffset={6}
          className="covart-colorpicker w-[232px] gap-3 border border-grey-700 bg-grey-900 p-3 ring-0"
        >
          <HexColorPicker color={pickerColor} onChange={set} />

          <div className="flex items-center gap-2">
            <span className="font-sans text-[11px] text-grey-400">#</span>
            <input
              type="text"
              value={draft.replace(/^#/, "")}
              spellCheck={false}
              placeholder="rrggbb"
              onChange={(e) => {
                const v = e.target.value;
                setDraft(v);
                commitHex(v);
              }}
              onBlur={() => setDraft(value ?? "")}
              className="h-[30px] w-full rounded-[3px] border border-grey-700 bg-grey-880 px-2 font-sans text-[12px] tracking-wide text-grey-100 outline-none focus:border-grey-500"
            />
            <button
              type="button"
              onClick={() => set(null)}
              className="shrink-0 rounded-[3px] border border-grey-700 px-2 py-[6px] font-sans text-[11px] text-grey-300 hover:border-grey-500 hover:text-grey-100"
            >
              None
            </button>
          </div>

          <div className="grid grid-cols-8 gap-[5px]">
            {PRESETS.map((hex) => (
              <button
                key={hex}
                type="button"
                title={hex}
                onClick={() => set(hex)}
                className={cn(
                  "aspect-square rounded-[3px] border",
                  value === hex
                    ? "border-grey-100"
                    : "border-black/30 hover:border-grey-300",
                )}
                style={{ background: hex }}
              />
            ))}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}

export const ColorPicker = memo(ColorPickerInner);
ColorPicker.displayName = "ColorPicker";
