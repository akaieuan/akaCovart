"use client";

import { memo } from "react";
import { cn } from "@/lib/utils";
import { useStudio } from "@/lib/store";
import { Divider, GroupLabel, Segmented, ToggleRow, SliderRow } from "../primitives";
import { AudioControls } from "@/components/audio";
import { BEAT_GROUP, DRIFT_GROUP, HIDE_DRIFT_FOR, MOTION_BY_ENGINE } from "../controls-config";
import { renderControl } from "./renderControls";
import { CONTROL, MICRO } from "../primitives/typography";

// Source segmented options — drives the (single) Animate motion from either the
// internal BPM clock or an imported audio track.
const ANIM_SOURCE_OPTIONS = [
  { value: "bpm", label: "BPM" },
  { value: "track", label: "Track" },
];

// MOTION — one animation, two drivers (BPM clock / imported track). Subscribes to
// `engine` (motion set) + `animSource` (which body). Shared by desktop + mobile.
function MotionSectionInner() {
  const engine = useStudio((s) => s.engine);
  const animSource = useStudio((s) => s.animSource);
  const isTrack = animSource === "track";
  return (
    <div>
      <div className={cn(CONTROL, "px-5 pt-4 pb-1 text-grey-300")}>
        {isTrack
          ? "Import a track, trim a clip window, then export a synced video."
          : "Set the BPM, dial pump and kick, then export a looping video."}
      </div>
      <div className="px-5 pt-4 pb-2">
        <GroupLabel>Source</GroupLabel>
        <Segmented
          paramKey="animSource"
          options={ANIM_SOURCE_OPTIONS}
          className="mb-2"
        />

        {isTrack && (
          <>
            <Divider />
            <AudioControls intro={false} />
          </>
        )}

        {!isTrack && (
          <>
            <Divider />
            <GroupLabel>{BEAT_GROUP.heading}</GroupLabel>
            {BEAT_GROUP.controls.map((c) => renderControl(c))}
          </>
        )}

        {/* Drift (Speed / Wander / Swirl) is hidden for engines that never read it
            — an inert slider reads as broken. */}
        {!HIDE_DRIFT_FOR.has(engine) && (
          <>
            <Divider />
            <GroupLabel>{DRIFT_GROUP.heading}</GroupLabel>
            {DRIFT_GROUP.controls.map((c) => renderControl(c))}
          </>
        )}

        <Divider />
        <GroupLabel>Motion</GroupLabel>
        {MOTION_BY_ENGINE[engine] ? (
          MOTION_BY_ENGINE[engine].map((c) => renderControl(c))
        ) : (
          <div className={cn(MICRO, "text-grey-300")}>
            This engine rides the Beat and Drift above.
          </div>
        )}

        <Divider />
        <GroupLabel>Auto</GroupLabel>
        <div className={cn(MICRO, "mb-2 text-grey-300")}>
          Gently auto-evolves a curated set of look params so the frame stays
          alive. Your sliders are the base — Auto only wanders around them.
        </div>
        <ToggleRow label="Auto" paramKey="auto" />
        <SliderRow label="Intensity" paramKey="autoIntensity" min={0} max={100} />
      </div>
    </div>
  );
}

export const MotionSection = memo(MotionSectionInner);
MotionSection.displayName = "MotionSection";
