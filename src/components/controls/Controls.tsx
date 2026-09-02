"use client";

import { type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { useStudio } from "@/lib/store";
import { SECTION } from "./primitives/typography";
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from "@/components/ui/accordion";
import {
  LookSection,
  CompositionSection,
  TextureSection,
  TypeSection,
  MotionSection,
  StackTextSection,
  StackMotionSection,
} from "./sections";

// ── Section shell (one accordion item) ───────────────────────────────────────
function PanelSection({
  value,
  title,
  children,
}: {
  value: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <AccordionItem value={value} className="border-b border-hairline">
      {/* 48px row; SECTION strong grey-150, primary grey-100 on hover / open. */}
      <AccordionTrigger
        className={cn(
          SECTION,
          "h-12 items-center px-5 py-0 text-grey-150 hover:text-grey-100 aria-expanded:text-grey-100",
        )}
      >
        {title}
      </AccordionTrigger>
      {/* Last row's mb-3 + 8 = 20px to the hairline. */}
      <AccordionContent className="px-5 pt-0 pb-2">
        {children}
      </AccordionContent>
    </AccordionItem>
  );
}

// All sections start COLLAPSED by default; the accordion stays `multiple`.
const DEFAULT_OPEN: string[] = [];

/**
 * Controls — the scrolling parameter body for the studio.
 *
 * Renders ONLY the parameter sections (accordion in STILL mode, the motion panel
 * in ANIMATE mode). Subscribes to `mode` + `focus` (which sections to show);
 * every row inside self-subscribes to its own store slice, so moving one slider
 * re-renders only that row.
 *
 * The section BODIES are shared atomic, memoised components in ./sections — the
 * single source of truth consumed by both this desktop sidebar and the mobile
 * dock (MobileControls). All chrome (engine selector, seed, mode toggle, reset,
 * export) is owned by the Studio shell.
 */
export default function Controls() {
  const mode = useStudio((s) => s.mode);
  const focus = useStudio((s) => s.focus);

  if (mode === "animate") {
    return focus === "stack" ? <StackMotionSection /> : <MotionSection />;
  }

  const stack = focus === "stack";

  return (
    <Accordion multiple defaultValue={DEFAULT_OPEN} className="flex w-full flex-col">
      {/* LOOK — colour + atmosphere (TxT/Stack = two-tone ink; Art = palette + presets) */}
      <PanelSection value="look" title="Look">
        <LookSection />
      </PanelSection>

      {/* COMPOSITION (engine-specific + shared FINISH) — the Art bg in Stack */}
      <PanelSection value="composition" title={stack ? "Background" : "Composition"}>
        <CompositionSection />
      </PanelSection>

      {/* TEXTURE — Art + Stack get grain; TxT renders smooth/high-res (no grain) */}
      {focus !== "txt" && (
        <PanelSection value="texture" title="Texture">
          <TextureSection />
        </PanelSection>
      )}

      {/* TYPE — Display text (TxT), Text layer (Stack), corner-credit overlay (Art) */}
      <PanelSection
        value="type"
        title={focus === "txt" ? "Display text" : stack ? "Text layer" : "Type overlay"}
      >
        {stack ? <StackTextSection /> : <TypeSection />}
      </PanelSection>
    </Accordion>
  );
}
