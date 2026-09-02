"use client";

import { memo } from "react";
import { cn } from "@/lib/utils";
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
import { CONTROL, MICRO } from "../primitives/typography";

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
      <div className={cn(CONTROL, "px-5 pt-4 pb-1 text-grey-300")}>
        Animate the background, the type, or both, then export a looping video.
      </div>
      <div className="px-5 pt-4 pb-2">
        <GroupLabel>Animate</GroupLabel>
        <Segmented paramKey="stackAnim" options={STACK_ANIM_OPTIONS} className="mb-2" />

        <Divider />
        <GroupLabel>Source</GroupLabel>
        <Segmented paramKey="animSource" options={ANIM_SOURCE_OPTIONS} className="mb-2" />

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

        <Divider />
        <GroupLabel>{DRIFT_GROUP.heading}</GroupLabel>
        {DRIFT_GROUP.controls.map((c) => renderControl(c))}

        <Divider />
        <GroupLabel>Background motion</GroupLabel>
        {bgMotion.length ? (
          bgMotion.map((c) => renderControl(c))
        ) : (
          <div className={cn(MICRO, "text-grey-300")}>
            This background rides the Beat and Drift above.
          </div>
        )}

        <Divider />
        <GroupLabel>Text motion</GroupLabel>
        {txtMotion.map((c) => renderControl(c))}

        <Divider />
        <GroupLabel>Auto</GroupLabel>
        <ToggleRow label="Auto" paramKey="auto" />
        <SliderRow label="Intensity" paramKey="autoIntensity" min={0} max={100} />
      </div>
    </div>
  );
}

export const StackMotionSection = memo(StackMotionSectionInner);
StackMotionSection.displayName = "StackMotionSection";
