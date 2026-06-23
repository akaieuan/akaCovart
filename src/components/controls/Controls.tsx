"use client";

import { type ReactNode } from "react";
import { useStudio } from "@/lib/store";
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from "@/components/ui/accordion";
import {
  GroupLabel,
  Divider,
  SliderRow,
  ToggleRow,
  Segmented,
  ColorPicker,
  FontPicker,
  TextRow,
} from "./primitives";
import Gallery from "./Gallery";
import { Presets } from "./Presets";
import { PositionGrid } from "./PositionGrid";
import { AudioControls } from "@/components/audio";
import {
  type Control,
  type ControlGroup,
  MOOD_OPTIONS,
  COLOR_TONE_GROUP,
  COMPOSITION_BY_ENGINE,
  FINISH_GROUP,
  TEXTURE_GROUPS,
  TEXT_CASE_OPTIONS,
  TEXT_COLOR_OPTIONS,
  TEXT_FONT_OPTIONS,
  BEAT_GROUP,
  DRIFT_GROUP,
  MOTION_BY_ENGINE,
} from "./controls-config";

// ── Generic control-row renderer (the DRY core) ──────────────────────────────
// Maps a config Control to the right SELF-SUBSCRIBING primitive. Each primitive
// reads its own store slice (paramKey) and writes via the stable setState
// action, so this renderer passes only static props — no value/onChange.
function renderControl(c: Control): ReactNode {
  switch (c.kind) {
    case "slider":
      return (
        <SliderRow
          key={c.key}
          paramKey={c.key}
          label={c.label}
          min={c.min}
          max={c.max}
          step={c.step}
          sub={c.sub}
        />
      );
    case "toggle":
      return <ToggleRow key={c.key} paramKey={c.key} label={c.label} />;
    case "segmented":
      return <Segmented key={c.key} paramKey={c.key} options={c.options} />;
    case "text":
      return (
        <TextRow
          key={c.key}
          paramKey={c.key}
          placeholder={c.placeholder}
          muted={c.muted}
        />
      );
  }
}

function renderGroups(groups: ControlGroup[]): ReactNode {
  return groups.map((g, gi) => (
    <div key={g.heading ?? gi}>
      {g.heading && <GroupLabel>{g.heading}</GroupLabel>}
      {g.controls.map((c) => renderControl(c))}
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
    <AccordionItem value={value} className="border-b border-grey-800/50">
      <AccordionTrigger className="rounded-none px-5 py-4 font-sans text-[13px] font-medium tracking-[0.01em] text-grey-250 no-underline transition-colors hover:no-underline hover:text-grey-100">
        {title}
      </AccordionTrigger>
      <AccordionContent className="px-5 pt-0 pb-[18px]">
        {children}
      </AccordionContent>
    </AccordionItem>
  );
}

// All sections start COLLAPSED by default. The accordion stays `multiple` so the
// user can open several at once.
const DEFAULT_OPEN: string[] = [];

// Source segmented options — drives the (single) Animate motion from either the
// internal BPM clock or an imported audio track.
const ANIM_SOURCE_OPTIONS = [
  { value: "bpm", label: "BPM" },
  { value: "track", label: "Track" },
];

// ── ANIMATE-mode motion body ─────────────────────────────────────────────────
// One animation, two drivers. A "Source" segmented control picks BPM (internal
// clock) or Track (imported audio). When Track is selected, the audio import /
// waveform / clip / reactivity UI is embedded here, and the BPM-only Beat group
// is hidden (Drift + per-engine Motion still apply). Subscribes to `engine` (to
// pick the motion set) and `animSource` (which body to show).
function MotionPanel() {
  const engine = useStudio((s) => s.engine);
  const animSource = useStudio((s) => s.animSource);
  const isTrack = animSource === "track";
  return (
    <div>
      <div className="px-5 pt-4 pb-1 font-sans text-[11px] leading-[1.7] text-grey-350">
        {isTrack
          ? "Drive the motion from an imported track — import an MP3/WAV, trim a clip window, then export a synced video loop."
          : "Beat-synced motion for techno. Set the BPM, dial the pump & kick, then export a looping video (MP4 where supported, else WEBM)."}
      </div>
      <div className="px-5 pt-[14px] pb-[6px]">
        {/* Source: what drives this animation. */}
        <GroupLabel variant="beat">Source</GroupLabel>
        <Segmented
          paramKey="animSource"
          options={ANIM_SOURCE_OPTIONS}
          className="mb-[6px]"
        />

        {/* TRACK driver: the embedded audio import / waveform / reactivity UI. */}
        {isTrack && (
          <>
            <Divider />
            <AudioControls intro={false} />
          </>
        )}

        {/* BEAT (BPM) controls — only meaningful for the internal-clock driver. */}
        {!isTrack && (
          <>
            <Divider />
            <GroupLabel variant="beat">{BEAT_GROUP.heading}</GroupLabel>
            {BEAT_GROUP.controls.map((c) => renderControl(c))}
          </>
        )}

        <Divider />
        <GroupLabel variant="beat">{DRIFT_GROUP.heading}</GroupLabel>
        {DRIFT_GROUP.controls.map((c) => renderControl(c))}

        <Divider />
        <GroupLabel variant="beat">Motion</GroupLabel>
        {MOTION_BY_ENGINE[engine] ? (
          MOTION_BY_ENGINE[engine].map((c) => renderControl(c))
        ) : (
          <div className="font-sans text-[11px] leading-[1.7] text-grey-400">
            This engine rides the Beat and Drift above.
          </div>
        )}

        <Divider />
        <GroupLabel variant="beat">Auto</GroupLabel>
        <div className="mb-1 font-sans text-[11px] leading-[1.7] text-grey-400">
          Gently auto-evolves a curated set of look params so the frame stays
          alive. Your sliders are the base — Auto only wanders around them.
        </div>
        <ToggleRow label="Auto" paramKey="auto" />
        <SliderRow label="Intensity" paramKey="autoIntensity" min={0} max={100} />
      </div>
    </div>
  );
}

// ── Composition body ─────────────────────────────────────────────────────────
// Subscribes to ONLY `engine` so switching engine swaps the right groups,
// without re-rendering on a slider tick.
function CompositionBody() {
  const engine = useStudio((s) => s.engine);
  return (
    <>
      {renderGroups(COMPOSITION_BY_ENGINE[engine] ?? [])}
      {renderGroups([FINISH_GROUP])}
    </>
  );
}

/**
 * Controls — the scrolling parameter body for the studio.
 *
 * This component renders ONLY the parameter sections (accordion in STILL mode,
 * the motion panel in ANIMATE mode). It subscribes to ONLY `mode` (which body
 * to show); every row inside self-subscribes to its own store slice, so moving
 * one slider re-renders only that row — never the whole panel.
 *
 * All chrome — engine selector, seed/generate, STILL/ANIMATE toggle, RESET and
 * the export action — is owned by the Studio shell (desktop sidebar + mobile
 * Sheet) so there is exactly one of each.
 */
export default function Controls() {
  const mode = useStudio((s) => s.mode);

  if (mode === "animate") {
    return <MotionPanel />;
  }

  return (
    <Accordion
      multiple
      defaultValue={DEFAULT_OPEN}
      className="flex w-full flex-col"
    >
      {/* STARTING POINTS */}
      <PanelSection value="library" title="Starting points">
        <Presets />
        <Gallery />
      </PanelSection>

      {/* PALETTE / MOOD */}
      <PanelSection value="palette" title="Palette · mood">
        <Segmented paramKey="mood" options={MOOD_OPTIONS} className="mb-[14px]" />
        <ColorPicker paramKey="colorPick" label="Color" />
        {renderGroups([COLOR_TONE_GROUP])}
      </PanelSection>

      {/* COMPOSITION (engine-specific + shared FINISH) */}
      <PanelSection value="composition" title="Composition">
        <CompositionBody />
      </PanelSection>

      {/* TEXTURE */}
      <PanelSection value="texture" title="Texture">
        {renderGroups(TEXTURE_GROUPS)}
      </PanelSection>

      {/* TYPE OVERLAY */}
      <PanelSection value="type" title="Type overlay">
        <ToggleRow label="Render text" paramKey="showText" />
        <TextRow paramKey="title" placeholder="Title" className="mb-[9px]" />
        <TextRow
          paramKey="artist"
          placeholder="Artist"
          muted
          className="mb-[14px]"
        />
        <GroupLabel variant="sub">Font</GroupLabel>
        <FontPicker
          className="mb-[14px]"
          paramKey="textFont"
          options={TEXT_FONT_OPTIONS}
        />
        <GroupLabel variant="sub">Case</GroupLabel>
        <Segmented
          className="mb-[14px]"
          paramKey="textCase"
          options={TEXT_CASE_OPTIONS}
        />
        <SliderRow
          label="Distort / glitch"
          paramKey="distort"
          min={0}
          max={100}
          sub
        />
        <GroupLabel variant="sub">Color</GroupLabel>
        <Segmented
          className="mb-[14px]"
          paramKey="textColor"
          options={TEXT_COLOR_OPTIONS}
        />
        <PositionGrid />
      </PanelSection>
    </Accordion>
  );
}
