"use client";

import { memo } from "react";
import { useStudio } from "@/lib/store";
import { Divider, GroupLabel, Segmented, ColorPicker } from "../primitives";
import { Presets } from "../Presets";
import {
  MOOD_OPTIONS,
  COLOR_GROUP,
  ATMOSPHERE_GROUP,
  OIL_PALETTE_OPTIONS,
  OIL_LOOK_GROUP,
} from "../controls-config";
import { renderGroups } from "./renderControls";

// LOOK — the first step. TxT focus = direct two-tone Background/Text (the
// starting-point suggestions live on the landing now). Art focus = palette
// controls + Presets. Oil = its own palettes + grade (it never reads the mood /
// Color pipeline). Atomic + memoised; subscribes only to `focus`.
function LookSectionInner() {
  const focus = useStudio((s) => s.focus);
  if (focus === "oil") {
    return (
      <>
        <Segmented paramKey="oilPalette" options={OIL_PALETTE_OPTIONS} className="mb-[14px]" />
        {renderGroups([OIL_LOOK_GROUP])}
        <Divider />
        <GroupLabel variant="sub">Atmosphere</GroupLabel>
        {renderGroups([ATMOSPHERE_GROUP])}
      </>
    );
  }
  if (focus === "txt") {
    return (
      <>
        <Segmented paramKey="mood" options={MOOD_OPTIONS} className="mb-[14px]" />
        <ColorPicker paramKey="txtBg" label="Background" emptyLabel="From mood" />
        <ColorPicker paramKey="txtInk" label="Text" emptyLabel="From mood" />
        <Divider />
        <GroupLabel variant="sub">Atmosphere</GroupLabel>
        {renderGroups([ATMOSPHERE_GROUP])}
      </>
    );
  }
  if (focus === "stack") {
    // Stack = art-palette colours for the background + a two-tone ink (and a
    // behind-type fill used by the scrim / art-filled mode) for the type layer.
    return (
      <>
        <Segmented paramKey="mood" options={MOOD_OPTIONS} className="mb-[14px]" />
        <ColorPicker paramKey="colorPick" label="Color" />
        {renderGroups([COLOR_GROUP])}
        <Divider />
        <GroupLabel variant="sub">Type colour</GroupLabel>
        <ColorPicker paramKey="txtInk" label="Text" emptyLabel="From mood" />
        <ColorPicker paramKey="txtBg" label="Behind type" emptyLabel="From mood" />
        <Divider />
        <GroupLabel variant="sub">Atmosphere</GroupLabel>
        {renderGroups([ATMOSPHERE_GROUP])}
      </>
    );
  }
  return (
    <>
      <Segmented paramKey="mood" options={MOOD_OPTIONS} className="mb-[14px]" />
      <ColorPicker paramKey="colorPick" label="Color" />
      {renderGroups([COLOR_GROUP])}
      <Divider />
      <GroupLabel variant="sub">Atmosphere</GroupLabel>
      {renderGroups([ATMOSPHERE_GROUP])}
      {/* The curated presets are Art-engine looks; Oil shares this palette panel
          but its starting points are the lane's own grid. */}
      {focus === "art" && (
        <>
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
