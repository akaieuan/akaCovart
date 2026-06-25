"use client";

import { memo } from "react";
import { useStudio } from "@/lib/store";
import { COMPOSITION_BY_ENGINE, FINISH_GROUP } from "../controls-config";
import { renderGroups } from "./renderControls";

// COMPOSITION — engine-specific groups + the shared FINISH group. Subscribes to
// ONLY `engine`, so switching engine swaps groups without re-rendering on a
// slider tick.
function CompositionSectionInner() {
  const engine = useStudio((s) => s.engine);
  return (
    <>
      {renderGroups(COMPOSITION_BY_ENGINE[engine] ?? [])}
      {renderGroups([FINISH_GROUP])}
    </>
  );
}

export const CompositionSection = memo(CompositionSectionInner);
CompositionSection.displayName = "CompositionSection";
