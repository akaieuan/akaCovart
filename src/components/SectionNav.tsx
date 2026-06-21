"use client";

import { useStudio, type OpenSections } from "@/lib/store";

// DOM ids assigned to each <Section> in ControlPanel.
export const SECTION_IDS: Record<keyof OpenSections, string> = {
  library: "sec-library",
  palette: "sec-palette",
  composition: "sec-composition",
  texture: "sec-texture",
  sigil: "sec-sigil",
  type: "sec-type",
};

const CHIPS: { key: keyof OpenSections; label: string }[] = [
  { key: "library", label: "POINTS" },
  { key: "palette", label: "PALETTE" },
  { key: "composition", label: "COMP" },
  { key: "texture", label: "TEXTURE" },
  { key: "sigil", label: "SIGIL" },
  { key: "type", label: "TYPE" },
];

export default function SectionNav() {
  const open = useStudio((s) => s.open);
  const setState = useStudio((s) => s.setState);
  const setAllSections = useStudio((s) => s.setAllSections);
  const resetParams = useStudio((s) => s.resetParams);

  const allOpen = CHIPS.every((c) => open[c.key]);

  const goTo = (key: keyof OpenSections) => {
    // Open the section first, then scroll it into view after the DOM updates.
    setState({ open: { ...open, [key]: true } });
    requestAnimationFrame(() => {
      const el = document.getElementById(SECTION_IDS[key]);
      el?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  };

  return (
    <div className="flex flex-none items-center gap-[6px] border-b border-border px-[18px] py-[10px]">
      <div className="flex min-w-0 flex-1 flex-wrap gap-[5px]">
        {CHIPS.map((chip) => {
          const active = open[chip.key];
          return (
            <button
              key={chip.key}
              type="button"
              onClick={() => goTo(chip.key)}
              className={
                "rounded-[3px] border px-[7px] py-[4px] font-mono text-[8px] font-medium tracking-[0.12em] uppercase transition-colors " +
                (active
                  ? "border-grey-500 bg-grey-600 text-grey-100"
                  : "border-grey-800 bg-transparent text-grey-350 hover:border-grey-500")
              }
            >
              {chip.label}
            </button>
          );
        })}
      </div>
      <button
        type="button"
        onClick={() => setAllSections(!allOpen)}
        title={allOpen ? "Collapse all sections" : "Expand all sections"}
        className="flex-none rounded-[3px] border border-grey-800 bg-transparent px-[7px] py-[4px] font-mono text-[8px] font-medium tracking-[0.12em] text-grey-350 uppercase transition-colors hover:border-grey-500"
      >
        {allOpen ? "COLLAPSE" : "EXPAND"}
      </button>
      <button
        type="button"
        onClick={resetParams}
        title="Reset all params to defaults"
        className="flex-none rounded-[3px] border border-grey-800 bg-transparent px-[7px] py-[4px] font-mono text-[8px] font-medium tracking-[0.12em] text-grey-350 uppercase transition-colors hover:border-grey-500"
      >
        RESET
      </button>
    </div>
  );
}
