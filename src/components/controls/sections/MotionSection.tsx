"use client";

import { memo } from "react";
import { useStudio } from "@/lib/store";
import { Divider, GroupLabel, Segmented, ToggleRow, SliderRow } from "../primitives";
import { AudioControls } from "@/components/audio";
import { BEAT_GROUP, DRIFT_GROUP, MOTION_BY_ENGINE } from "../controls-config";
import { renderControl } from "./renderControls";

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
      <div className="px-5 pt-4 pb-1 font-sans text-[11px] leading-[1.7] text-grey-350">
        {isTrack
          ? "Drive the motion from an imported track — import an MP3/WAV, trim a clip window, then export a synced video loop."
          : "Beat-synced motion for techno. Set the BPM, dial the pump & kick, then export a looping video (MP4 where supported, else WEBM)."}
      </div>
      <div className="px-5 pt-[14px] pb-[6px]">
        <GroupLabel variant="beat">Source</GroupLabel>
        <Segmented
          paramKey="animSource"
          options={ANIM_SOURCE_OPTIONS}
          className="mb-[6px]"
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

export const MotionSection = memo(MotionSectionInner);
MotionSection.displayName = "MotionSection";
