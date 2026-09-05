import { type ComponentType } from "react";

import type { Focus } from "@/engine/types";
import type { Mode } from "@/lib/store";

import { LookSection } from "./LookSection";
import { CompositionSection } from "./CompositionSection";
import { TextureSection } from "./TextureSection";
import { TypeSection } from "./TypeSection";
import { MotionSection } from "./MotionSection";
import { StackTextSection } from "./StackTextSection";
import { StackMotionSection } from "./StackMotionSection";

// ── Which param panels a lane shows ──────────────────────────────────────────
// The SINGLE source of truth for both the desktop sidebar (controls/Controls)
// and the mobile dock (studio/MobileControls). Before this table each surface
// worked the lane rules out independently and they drifted; adding a lane or a
// panel now means editing `panelsFor` and nothing else.
//
// Renders nothing itself — it only names sections, so it stays a plain .ts
// module and neither surface pays for the other's chrome.

export interface PanelDef {
  /** Stable id — the accordion item value on desktop, the tab id on mobile. */
  id: string;
  /** Sidebar accordion heading. */
  title: string;
  /** Short label for the mobile tab strip, where horizontal room is tight. */
  short: string;
  /** The shared, memoised section body. */
  Section: ComponentType;
}

/**
 * The panels for a lane + mode, in display order.
 *
 * NOT included: the mobile-only "Engine"/"Seed" tab, which is dock chrome
 * (selector + seed row) rather than a param panel — MobileControls prepends it.
 */
export function panelsFor(focus: Focus, mode: Mode): PanelDef[] {
  const stack = focus === "stack";

  // ANIMATE collapses to a single motion panel. Stack animates two layers, so it
  // gets the layer-aware panel instead.
  if (mode === "animate") {
    return [
      {
        id: "motion",
        title: "Motion",
        short: "Motion",
        Section: stack ? StackMotionSection : MotionSection,
      },
    ];
  }

  return [
    { id: "look", title: "Look", short: "Look", Section: LookSection },
    {
      // In Stack the engine params describe the ART BACKGROUND under the type.
      id: "composition",
      title: stack ? "Background" : "Composition",
      short: stack ? "Background" : "Compose",
      Section: CompositionSection,
    },
    // TxT renders smooth / high-res and skips the film grain in render.ts, so
    // the panel would be inert — omit it rather than show dead sliders.
    ...(focus !== "txt"
      ? [
          {
            id: "texture",
            title: "Texture",
            short: "Texture",
            Section: TextureSection,
          } satisfies PanelDef,
        ]
      : []),
    {
      // The type panel means something different per lane: the subject itself
      // (TxT), the overlay layer (Stack), or the corner credit (Art / Oil).
      id: "type",
      title: focus === "txt" ? "Display text" : stack ? "Text layer" : "Type overlay",
      short: stack ? "Text" : "Type",
      Section: stack ? StackTextSection : TypeSection,
    },
  ];
}
