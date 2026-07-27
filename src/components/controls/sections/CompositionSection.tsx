"use client";

import { memo } from "react";
import { useStudio } from "@/lib/store";
import { COMPOSITION_BY_ENGINE, FINISH_GROUP, SEED_GROUP } from "../controls-config";
import { renderGroups } from "./renderControls";

// COMPOSITION — the shared SEED group, the engine-specific groups, then the
// shared FINISH group. Subscribes to ONLY `engine`, so switching engine swaps
// groups without re-rendering on a slider tick.
function CompositionSectionInner() {
  const engine = useStudio((s) => s.engine);
  return (
    <>
      {renderGroups([SEED_GROUP])}
      {renderGroups(COMPOSITION_BY_ENGINE[engine] ?? [])}
      {renderGroups([FINISH_GROUP])}
    </>
  );
}

export const CompositionSection = memo(CompositionSectionInner);
CompositionSection.displayName = "CompositionSection";
