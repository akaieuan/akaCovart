"use client";

import { type ReactNode } from "react";
import {
  useStudio,
  makeSeeds,
  randSeed,
  type StudioState,
} from "@/lib/store";
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from "@/components/ui/accordion";
import {
  Label,
  GroupLabel,
  Divider,
  SliderRow,
  ToggleRow,
  Segmented,
  TextRow,
} from "./primitives";
import Gallery from "./Gallery";
import AudioPanel from "./AudioPanel";
import {
  type Control,
  type ControlGroup,
  MOOD_OPTIONS,
  COMPOSITION_BY_ENGINE,
  FINISH_GROUP,
  TEXTURE_GROUPS,
  SIGIL_GROUPS,
  TEXT_CASE_OPTIONS,
  TEXT_COLOR_OPTIONS,
  POS_COLS,
  POS_ROWS,
  BEAT_GROUP,
  DRIFT_GROUP,
  MOTION_BY_ENGINE,
} from "./controls-config";
import { getPresets } from "@/presets";

// ── Generic control-row renderer (the DRY core) ──────────────────────────────
// Maps a config Control to the right primitive, wired straight to the store.
function renderControl(
  c: Control,
  s: StudioState,
  set: (patch: Partial<StudioState>) => void,
): ReactNode {
  switch (c.kind) {
    case "slider":
      return (
        <SliderRow
          key={c.key}
          label={c.label}
          min={c.min}
          max={c.max}
          step={c.step}
          sub={c.sub}
          value={s[c.key]}
          onChange={(v) => set({ [c.key]: v } as Partial<StudioState>)}
        />
      );
    case "toggle":
      return (
        <ToggleRow
          key={c.key}
          label={c.label}
          value={s[c.key]}
          onChange={(v) => set({ [c.key]: v } as Partial<StudioState>)}
        />
      );
    case "segmented":
      return (
        <Segmented
          key={c.key}
          value={s[c.key]}
          options={c.options}
          onChange={(v) => set({ [c.key]: v } as Partial<StudioState>)}
        />
      );
    case "text":
      return (
        <TextRow
          key={c.key}
          value={s[c.key]}
          placeholder={c.placeholder}
          muted={c.muted}
          onChange={(v) => set({ [c.key]: v } as Partial<StudioState>)}
        />
      );
  }
}

function renderGroups(
  groups: ControlGroup[],
  s: StudioState,
  set: (patch: Partial<StudioState>) => void,
): ReactNode {
  return groups.map((g, gi) => (
    <div key={g.heading ?? gi}>
      {g.heading && <GroupLabel>{g.heading}</GroupLabel>}
      {g.controls.map((c) => renderControl(c, s, set))}
    </div>
  ));
}

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
    <AccordionItem value={value} className="border-b border-border-soft">
      <AccordionTrigger className="rounded-none px-5 py-[15px] font-sans text-[13px] font-medium text-grey-250 no-underline hover:no-underline hover:text-grey-150">
        {title}
      </AccordionTrigger>
      <AccordionContent className="px-5 pt-0 pb-[18px]">
        {children}
      </AccordionContent>
    </AccordionItem>
  );
}

const DEFAULT_OPEN = [
  "library",
  "palette",
  "composition",
  "texture",
  "sigil",
  "type",
];

/**
 * Controls — the scrolling parameter body for the studio.
 *
 * This component renders ONLY the parameter sections (accordion in STILL mode,
 * the motion panel in ANIMATE mode). All chrome — engine selector, seed/generate,
 * STILL/ANIMATE toggle, RESET and the export action — is owned by the Studio
 * shell (desktop sidebar + mobile Sheet) so there is exactly one of each.
 */
export default function Controls() {
  const s = useStudio();
  const set = useStudio((st) => st.setState);
  const presets = getPresets();

  if (s.mode === "audio") {
    return <AudioPanel />;
  }

  if (s.mode === "animate") {
    return (
      <div>
        <div className="px-5 pt-4 pb-1 font-sans text-[11px] leading-[1.7] text-grey-350">
          Beat-synced motion for techno. Set the BPM, dial the pump &amp; kick,
          then export a looping video (MP4 where supported, else WEBM).
        </div>
        <div className="px-5 pt-[14px] pb-[6px]">
          <GroupLabel variant="beat">{BEAT_GROUP.heading}</GroupLabel>
          {BEAT_GROUP.controls.map((c) => renderControl(c, s, set))}
          <Divider />
          <GroupLabel variant="beat">{DRIFT_GROUP.heading}</GroupLabel>
          {DRIFT_GROUP.controls.map((c) => renderControl(c, s, set))}

          <Divider />
          <GroupLabel variant="beat">Motion</GroupLabel>
          {MOTION_BY_ENGINE[s.engine] ? (
            MOTION_BY_ENGINE[s.engine].map((c) => renderControl(c, s, set))
          ) : (
            <div className="font-sans text-[11px] leading-[1.7] text-grey-400">
              The Blob engine has no per-shape motion — it rides the Beat and
              Drift above.
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <Accordion
      multiple
      defaultValue={DEFAULT_OPEN}
      className="flex w-full flex-col"
    >
      {/* STARTING POINTS */}
      <PanelSection value="library" title="Starting points">
        <GroupLabel variant="sub">Presets</GroupLabel>
        <div className="mb-4 grid grid-cols-4 gap-[6px]">
          {presets.length === 0 ? (
            <span className="col-span-4 font-sans text-[11px] text-grey-400">
              No presets
            </span>
          ) : (
            presets.map((p, i) => (
              <button
                key={i}
                type="button"
                onClick={() =>
                  set({
                    ...(p.engine ? { engine: p.engine } : {}),
                    ...p.params,
                    seed: p.seed ?? randSeed(),
                    gallerySeeds: makeSeeds(9),
                  })
                }
                className="rounded-[4px] border border-grey-800 bg-grey-880 px-1 py-[10px] text-center font-sans text-[11px] font-medium text-grey-200 transition-colors hover:border-grey-500 hover:bg-grey-850 hover:text-grey-100"
              >
                {p.name}
              </button>
            ))
          )}
        </div>
        <Gallery />
      </PanelSection>

      {/* PALETTE / MOOD */}
      <PanelSection value="palette" title="Palette · mood">
        <Segmented
          value={s.mood}
          options={MOOD_OPTIONS}
          onChange={(v) => set({ mood: v as StudioState["mood"] })}
        />
      </PanelSection>

      {/* COMPOSITION (engine-specific + shared FINISH) */}
      <PanelSection value="composition" title="Composition">
        {renderGroups(COMPOSITION_BY_ENGINE[s.engine] ?? [], s, set)}
        {renderGroups([FINISH_GROUP], s, set)}
      </PanelSection>

      {/* TEXTURE */}
      <PanelSection value="texture" title="Texture">
        {renderGroups(TEXTURE_GROUPS, s, set)}
      </PanelSection>

      {/* SIGIL */}
      <PanelSection value="sigil" title="Sigil">
        {renderGroups([SIGIL_GROUPS[0]], s, set)}
        <Divider />
        {renderGroups([SIGIL_GROUPS[1]], s, set)}
      </PanelSection>

      {/* TYPE OVERLAY */}
      <PanelSection value="type" title="Type overlay">
        <ToggleRow
          label="Render text"
          value={s.showText}
          onChange={(v) => set({ showText: v })}
        />
        <TextRow
          value={s.title}
          placeholder="Title"
          onChange={(v) => set({ title: v })}
          className="mb-[9px]"
        />
        <TextRow
          value={s.artist}
          placeholder="Artist"
          muted
          onChange={(v) => set({ artist: v })}
          className="mb-[14px]"
        />
        <GroupLabel variant="sub">Case</GroupLabel>
        <Segmented
          className="mb-[14px]"
          value={s.textCase}
          options={TEXT_CASE_OPTIONS}
          onChange={(v) => set({ textCase: v })}
        />
        <SliderRow
          label="Distort / glitch"
          min={0}
          max={100}
          sub
          value={s.distort}
          onChange={(v) => set({ distort: v })}
        />
        <GroupLabel variant="sub">Color</GroupLabel>
        <Segmented
          className="mb-[14px]"
          value={s.textColor}
          options={TEXT_COLOR_OPTIONS}
          onChange={(v) => set({ textColor: v })}
        />
        <div className="mb-2 flex items-baseline justify-between">
          <Label sub>Position</Label>
          <span className="font-sans text-[11px] text-grey-400">
            or drag on canvas ⤢
          </span>
        </div>
        <div className="grid w-[120px] grid-cols-3 gap-[5px]">
          {POS_ROWS.map((ry, ri) =>
            POS_COLS.map((col, ci) => {
              const active =
                Math.abs(s.textX - col.x) < 0.02 &&
                Math.abs(s.textY - ry) < 0.02 &&
                s.textAlign === col.align;
              return (
                <button
                  key={`${ri}-${ci}`}
                  type="button"
                  aria-label={`Position ${col.align} ${
                    ri === 0 ? "top" : ri === 2 ? "bottom" : "middle"
                  }`}
                  onClick={() =>
                    set({
                      textX: col.x,
                      textY: ry,
                      textAlign: col.align,
                    })
                  }
                  className={
                    "flex aspect-[1.4] rounded-[3px] border p-[5px] transition-colors " +
                    (active
                      ? "border-grey-500 bg-grey-600"
                      : "border-grey-800 bg-grey-880 hover:border-grey-500")
                  }
                  style={{
                    alignItems:
                      col.align === "left"
                        ? "flex-start"
                        : col.align === "right"
                          ? "flex-end"
                          : "center",
                    justifyContent:
                      ri === 0
                        ? "flex-start"
                        : ri === 2
                          ? "flex-end"
                          : "center",
                  }}
                >
                  <span
                    className={
                      "h-1 w-1 rounded-full " +
                      (active ? "bg-grey-100" : "bg-grey-400")
                    }
                  />
                </button>
              );
            }),
          )}
        </div>
      </PanelSection>
    </Accordion>
  );
}
