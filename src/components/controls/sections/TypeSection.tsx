"use client";

import { memo } from "react";
import { useStudio } from "@/lib/store";
import {
  GroupLabel,
  Segmented,
  FontPicker,
  TextRow,
  ToggleRow,
  SliderRow,
} from "../primitives";
import { PositionGrid } from "../PositionGrid";
import {
  TEXT_CASE_OPTIONS,
  TEXT_COLOR_OPTIONS,
  TEXT_FONT_OPTIONS,
  TXT_ALIGN_OPTIONS,
  TXT_VALIGN_OPTIONS,
} from "../controls-config";

// TYPE — focus-aware. TxT: the dedicated Display text (the subject the engines
// stylize) + align/position. Art: the corner-credit overlay. Subscribes to
// `focus` only.
function TypeSectionInner() {
  const focus = useStudio((s) => s.focus);
  if (focus === "txt") {
    return (
      <>
        <TextRow paramKey="txtText" placeholder="Display text" className="mb-2" />
        <TextRow paramKey="txtSub" placeholder="Subline (optional)" muted className="mb-4" />
        <GroupLabel>Font</GroupLabel>
        <FontPicker className="mb-4" paramKey="textFont" options={TEXT_FONT_OPTIONS} />
        <GroupLabel>Case</GroupLabel>
        <Segmented className="mb-4" paramKey="textCase" options={TEXT_CASE_OPTIONS} />
        <SliderRow label="Size" paramKey="txtSize" min={0} max={100} />
        <GroupLabel>Align</GroupLabel>
        <Segmented className="mb-4" paramKey="txtAlign" options={TXT_ALIGN_OPTIONS} />
        <GroupLabel>Position</GroupLabel>
        <Segmented className="mb-4" paramKey="txtVAlign" options={TXT_VALIGN_OPTIONS} />
      </>
    );
  }
  return (
    <>
      <ToggleRow label="Render text" paramKey="showText" />
      <TextRow paramKey="title" placeholder="Title" className="mb-2" />
      <TextRow paramKey="artist" placeholder="Artist" muted className="mb-4" />
      <GroupLabel>Font</GroupLabel>
      <FontPicker className="mb-4" paramKey="textFont" options={TEXT_FONT_OPTIONS} />
      <GroupLabel>Case</GroupLabel>
      <Segmented className="mb-4" paramKey="textCase" options={TEXT_CASE_OPTIONS} />
      <SliderRow label="Distort / glitch" paramKey="distort" min={0} max={100} sub />
      <GroupLabel>Color</GroupLabel>
      <Segmented className="mb-4" paramKey="textColor" options={TEXT_COLOR_OPTIONS} />
      <PositionGrid />
    </>
  );
}

export const TypeSection = memo(TypeSectionInner);
TypeSection.displayName = "TypeSection";
