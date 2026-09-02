import { listEnginesByFocus } from "@/engine";
import { useStudio, type StudioState } from "@/lib/store";

/**
 * Focus (style lane) switching — the ONE implementation shared by the header
 * Style dropdown and the start screen's Style pills. Keep the lane list, the
 * per-lane engine roster and the switch logic here so the two entry points can
 * never drift apart.
 */

export type Focus = StudioState["focus"];

export const FOCUS_OPTIONS: { value: Focus; label: string; hint: string }[] = [
  { value: "art", label: "Art", hint: "Abstract generative fields" },
  { value: "oil", label: "Oil", hint: "Painted landscapes, bit-crushed" },
  { value: "txt", label: "TxT", hint: "Type as the subject" },
  { value: "stack", label: "Stack", hint: "Art background + type on top" },
];

const FALLBACK_ENGINE: Record<Focus, string> = { art: "blob", oil: "oil", txt: "dither", stack: "blob" };

// The engines a lane's `engine` may be. Stack's `engine` is its BACKGROUND, so
// it accepts any field engine — the Art roster plus Oil's (type over a landscape).
export function enginesFor(focus: Focus) {
  return focus === "stack"
    ? [...listEnginesByFocus("art"), ...listEnginesByFocus("oil")]
    : listEnginesByFocus(focus);
}

// First registered engine for a lane (fallbacks keep this safe pre-registration).
export function defaultEngine(focus: Focus): string {
  return enginesFor(focus)[0]?.id ?? FALLBACK_ENGINE[focus];
}

// Per-lane engine memory (module-scoped so every switcher shares it; seeded with
// the defaults). Remembers the last-used engine in each lane so round-trips feel
// natural.
const lastEngine: Record<Focus, string> = { ...FALLBACK_ENGINE };

/**
 * Flip the studio to another lane. No-op when already there. Stashes the engine
 * we're leaving, then restores the remembered engine for the lane we're entering
 * (validated against what that lane accepts) or falls back to its default.
 */
export function switchFocus(next: Focus): void {
  const cur = useStudio.getState();
  if (next === cur.focus) return;
  lastEngine[cur.focus] = cur.engine;
  const remembered = lastEngine[next];
  const known = enginesFor(next).some((e) => e.id === remembered);
  useStudio.setState({ focus: next, engine: known ? remembered : defaultEngine(next) });
}
