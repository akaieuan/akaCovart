"use client";

import { memo } from "react";
import { useStudio } from "@/lib/store";
import { TEXTURE_GROUPS, OIL_TEXTURE_GROUP } from "../controls-config";
import { renderGroups } from "./renderControls";

// TEXTURE — film grain / scratches for the Art engines (TxT renders smooth).
// Oil's texture is its own canvas tooth + colour drift: the film passes are
// skipped for it in render.ts, so showing them here would be inert.
function TextureSectionInner() {
  const focus = useStudio((s) => s.focus);
  return <>{renderGroups(focus === "oil" ? [OIL_TEXTURE_GROUP] : TEXTURE_GROUPS)}</>;
}

export const TextureSection = memo(TextureSectionInner);
TextureSection.displayName = "TextureSection";
