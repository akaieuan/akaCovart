"use client";

import { memo } from "react";
import { useStudio } from "@/lib/store";
import { Divider, GroupLabel, Segmented, ColorPicker } from "../primitives";
import { Presets } from "../Presets";
import { MOOD_OPTIONS, COLOR_GROUP, ATMOSPHERE_GROUP } from "../controls-config";
import { renderGroups } from "./renderControls";

// LOOK — the first step. TxT focus = direct two-tone Background/Text (the
// starting-point suggestions live on the landing now). Art focus = palette
// controls + Presets. Atomic + memoised; subscribes only to `focus`.
function LookSectionInner() {
  const focus = useStudio((s) => s.focus);
  return (
    <>
      <Segmented paramKey="mood" options={MOOD_OPTIONS} className="mb-[14px]" />
      {focus === "txt" ? (
        <>
          <ColorPicker paramKey="txtBg" label="Background" emptyLabel="From mood" />
          <ColorPicker paramKey="txtInk" label="Text" emptyLabel="From mood" />
          <Divider />
          <GroupLabel variant="sub">Atmosphere</GroupLabel>
          {renderGroups([ATMOSPHERE_GROUP])}
        </>
      ) : (
        <>
          <ColorPicker paramKey="colorPick" label="Color" />
          {renderGroups([COLOR_GROUP])}
          <Divider />
          <GroupLabel variant="sub">Atmosphere</GroupLabel>
          {renderGroups([ATMOSPHERE_GROUP])}
          <Divider />
          <GroupLabel variant="sub">Starting points</GroupLabel>
          <Presets />
        </>
      )}
    </>
  );
}

export const LookSection = memo(LookSectionInner);
LookSection.displayName = "LookSection";
