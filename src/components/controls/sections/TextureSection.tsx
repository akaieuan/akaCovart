"use client";

import { memo } from "react";
import { TEXTURE_GROUPS } from "../controls-config";
import { renderGroups } from "./renderControls";

// TEXTURE — film grain / scratches. Art focus only (TxT renders smooth).
function TextureSectionInner() {
  return <>{renderGroups(TEXTURE_GROUPS)}</>;
}

export const TextureSection = memo(TextureSectionInner);
TextureSection.displayName = "TextureSection";
