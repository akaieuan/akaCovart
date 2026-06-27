"use client";

import { memo } from "react";
import { useStudio } from "@/lib/store";
import { Divider, GroupLabel, Segmented, ToggleRow, SliderRow } from "../primitives";
import { AudioControls } from "@/components/audio";
import {
  BEAT_GROUP,
  DRIFT_GROUP,
  MOTION_BY_ENGINE,
  STACK_ANIM_OPTIONS,
} from "../controls-config";
import { renderControl } from "./renderControls";

const ANIM_SOURCE_OPTIONS = [
  { value: "bpm", label: "BPM" },
  { value: "track", label: "Track" },
];

// STACK · Motion — pick which layer animates, then dial the shared beat/drift plus
// each layer's own motion (the art bg + the text resolve-loop). Subscribes to
// `engine` (bg motion), `stackTxt` (text motion) + `animSource`.
function StackMotionSectionInner() {
  const engine = useStudio((s) => s.engine);
  const stackTxt = useStudio((s) => s.stackTxt);
  const animSource = useStudio((s) => s.animSource);
  const isTrack = animSource === "track";
  const bgMotion = MOTION_BY_ENGINE[engine] ?? [];
  const txtMotion = MOTION_BY_ENGINE[stackTxt] ?? [];
  return (
    <div>
      <div className="px-5 pt-4 pb-1 font-sans text-[11px] leading-[1.7] text-grey-350">
        Animate the art background, the type, or both — the type always resolves back
        to the readable word each cycle. Beat-synced; export a looping video.
      </div>
      <div className="px-5 pt-[14px] pb-[6px]">
        <GroupLabel variant="beat">Animate</GroupLabel>
        <Segmented paramKey="stackAnim" options={STACK_ANIM_OPTIONS} className="mb-[6px]" />

        <Divider />
        <GroupLabel variant="beat">Source</GroupLabel>
        <Segmented paramKey="animSource" options={ANIM_SOURCE_OPTIONS} className="mb-[6px]" />

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
        <GroupLabel variant="beat">Background motion</GroupLabel>
        {bgMotion.length ? (
          bgMotion.map((c) => renderControl(c))
        ) : (
          <div className="font-sans text-[11px] leading-[1.7] text-grey-400">
            This background rides the Beat and Drift above.
          </div>
        )}

        <Divider />
        <GroupLabel variant="beat">Text motion</GroupLabel>
        {txtMotion.map((c) => renderControl(c))}

        <Divider />
        <GroupLabel variant="beat">Auto</GroupLabel>
        <ToggleRow label="Auto" paramKey="auto" />
        <SliderRow label="Intensity" paramKey="autoIntensity" min={0} max={100} />
      </div>
    </div>
  );
}

export const StackMotionSection = memo(StackMotionSectionInner);
StackMotionSection.displayName = "StackMotionSection";
