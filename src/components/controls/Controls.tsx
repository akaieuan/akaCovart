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
import { panelsFor } from "./sections";

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
 * in ANIMATE mode). Subscribes to `mode` + `focus`; every row inside
 * self-subscribes to its own store slice, so moving one slider re-renders only
 * that row.
 *
 * WHICH panels a lane shows is not decided here — `panelsFor` in
 * ./sections/panels.ts owns that, shared with the mobile dock (MobileControls)
 * so the two can't drift. The section BODIES are the shared memoised components
 * in ./sections. All chrome (engine selector, seed, mode toggle, reset, export)
 * is owned by the Studio shell.
 */
export default function Controls() {
  const mode = useStudio((s) => s.mode);
  const focus = useStudio((s) => s.focus);
  const panels = panelsFor(focus, mode);

  // ANIMATE is a single panel and wants no accordion chrome around it.
  if (mode === "animate") {
    const { Section } = panels[0];
    return <Section />;
  }

  return (
    <Accordion multiple defaultValue={DEFAULT_OPEN} className="flex w-full flex-col">
      {panels.map(({ id, title, Section }) => (
        <PanelSection key={id} value={id} title={title}>
          <Section />
        </PanelSection>
      ))}
    </Accordion>
  );
}
