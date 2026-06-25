"use client";

import { type ReactNode } from "react";
import {
  GroupLabel,
  SliderRow,
  ToggleRow,
  Segmented,
  TextRow,
} from "../primitives";
import { type Control, type ControlGroup } from "../controls-config";

// ── DRY control-row renderer (single source of truth) ────────────────────────
// Maps a config Control to the right SELF-SUBSCRIBING primitive. Each primitive
// reads its own store slice (paramKey) and writes via the stable setState action,
// so this passes only static props. Shared by every section (desktop + mobile).
export function renderControl(c: Control): ReactNode {
  switch (c.kind) {
    case "slider":
      return (
        <SliderRow
          key={c.key}
          paramKey={c.key}
          label={c.label}
          min={c.min}
          max={c.max}
          step={c.step}
          sub={c.sub}
        />
      );
    case "toggle":
      return <ToggleRow key={c.key} paramKey={c.key} label={c.label} />;
    case "segmented":
      return <Segmented key={c.key} paramKey={c.key} options={c.options} />;
    case "text":
      return (
        <TextRow
          key={c.key}
          paramKey={c.key}
          placeholder={c.placeholder}
          muted={c.muted}
        />
      );
  }
}

export function renderGroups(groups: ControlGroup[]): ReactNode {
  return groups.map((g, gi) => (
    <div key={g.heading ?? gi}>
      {g.heading && <GroupLabel>{g.heading}</GroupLabel>}
      {g.controls.map((c) => renderControl(c))}
    </div>
  ));
}
