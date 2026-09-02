"use client";

import { memo } from "react";
import { useStudio } from "@/lib/store";
import {
  Divider,
  GroupLabel,
  Segmented,
  FontPicker,
  TextRow,
  SliderRow,
} from "../primitives";
import {
  COMPOSITION_BY_ENGINE,
  STACK_TXT_OPTIONS,
  STACK_MODE_OPTIONS,
  TEXT_CASE_OPTIONS,
  TEXT_FONT_OPTIONS,
  TXT_ALIGN_OPTIONS,
  TXT_VALIGN_OPTIONS,
} from "../controls-config";
import { renderGroups } from "./renderControls";

// STACK · Text layer — the TxT engine composited over the art bg: which engine,
// how it sits over the art (on top / art-filled), its own composition params, and
// the display text. Subscribes to `stackTxt` (+ `stackMode` for the scrim row).
function StackTextSectionInner() {
  const stackTxt = useStudio((s) => s.stackTxt);
  const stackMode = useStudio((s) => s.stackMode);
  return (
    <>
      <GroupLabel>Type engine</GroupLabel>
      <Segmented className="mb-4" paramKey="stackTxt" options={STACK_TXT_OPTIONS} />
      <GroupLabel>Composite</GroupLabel>
      <Segmented className="mb-4" paramKey="stackMode" options={STACK_MODE_OPTIONS} />
      {stackMode !== "knockout" && (
        <SliderRow label="Scrim behind type" paramKey="stackScrim" min={0} max={100} sub />
      )}
      <Divider />
      <GroupLabel>Treatment</GroupLabel>
      {renderGroups(COMPOSITION_BY_ENGINE[stackTxt] ?? [])}
      <Divider />
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

export const StackTextSection = memo(StackTextSectionInner);
StackTextSection.displayName = "StackTextSection";
