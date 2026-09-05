export type Mood = "dark" | "cream" | "grey";

// ── Creative focus (the "style lanes") ───────────────────────────────────────
// The SINGLE source of truth for the lane union. Lives here (not in the store)
// because both the framework-agnostic engine module and the React studio need
// it; `src/lib/store.ts` and `src/components/studio/focus.ts` import it from
// here rather than re-spelling the union.
//
//   art   — abstract field engines (the default)
//   oil   — painted landform, bit-crushed; owns its own colour + texture chain
//   txt   — type-driven engines, where the letterforms are the subject
//   stack — a TxT type layer composited OVER an art/oil field background
export type Focus = "art" | "txt" | "oil" | "stack";

// The lanes an ENGINE may declare. "stack" is deliberately excluded: it is a
// COMPOSITE of two engines (an `engine` background + a `stackTxt` overlay), so
// no engine is ever tagged with it and `listEnginesByFocus("stack")` would
// always return []. Use `enginesFor()` in components/studio/focus.ts for the
// lane-facing roster, which resolves Stack to art + oil.
export type EngineFocus = Exclude<Focus, "stack">;

export type RNG = () => number;

export interface ParamDef {
  key: string;
  label: string;
  type: "range" | "int" | "toggle" | "select" | "text";
  group?: "composition" | "finish" | "texture" | "type" | "palette" | "motion";
  min?: number;
  max?: number;
  step?: number;
  default: number | boolean | string;
  options?: { value: string; label: string }[];
}

export interface Palette {
  base: number[];
  colors: number[][];
  diamondColors: number[][];
  fleck: number[];
  smoke: number[];
  accentColors: number[][];
  scratch: string;
  markerColors: number[][];
  markerBg: number[];
  markerDot: number[];
  blobCount: number;
  rMin: number;
  rMax: number;
  aMin: number;
  aMax: number;
  diamondAlpha: number;
  topSmudge: boolean;
  clearCenter: boolean;
}

// Eased animation values ONLY. Deliberately NO strobe, NO flicker,
// NO per-frame hue cycle, NO brightness flash. All motion is space-only
// (scale / position / displacement / radius).
export interface AnimState {
  anim: boolean;
  t: number;
  rt: number;
  bake: boolean;
  beat: number; // continuous beat phase in [0,1), wraps each beat
  // Beat-synced RESOLVE-loop phase in [0,1), wraps every `txtLoopBeats` beats and
  // hits 0 on each resolve. The TxT engines gate ALL motion by an envelope of this
  // so the type returns to its readable still on the beat (and the loop is seamless).
  loopPhase: number;
  // Phase of one EXPORT CLIP in [0,1): `clipCycles` resolve cycles (≈ 6 s, see
  // loop.ts), 0 at frame 0, wrapping exactly where the exported loop wraps. Set
  // by the BPM and Track drivers (render.ts / trackMotion.ts); an engine that
  // rides the clip (Oil's tide) falls back to loop.ts's formula on `rt` when a
  // driver leaves it undefined.
  clipPhase?: number;
  // TRUE when the Track driver produced this state. There `beat` is a smoothed
  // onset FEATURE (0..1 strength), not a phase, and `drift` / `swirl` / `speed`
  // are live audio features (mid / high / energy) rather than slider constants —
  // an engine that shapes its beat terms by phase must not do so in track mode.
  track?: boolean;
  kickEnv: number; // smooth attack-decay impulse (kick * (1-beat)^3.4) — calm pulse
  kickSpring: number; // damped bounce, SIGNED (overshoots then settles)
  pumpEnv: number; // breathing (pump * (1-beat)^2.0)
  drift: number;
  swirl: number;
  speed: number; // global 0..1 (animSpeed/100)
}

export interface FieldArgs {
  ctx: CanvasRenderingContext2D;
  size: number;
  params: Record<string, any>;
  mood: Mood;
  cfg: Palette;
  seed: number;
  anim: AnimState;
}

export interface FieldEngine {
  id: string;
  label: string;
  kind: "2d";
  // Which creative lane this engine belongs to. The header Focus switch +
  // EngineSelector filter on this. Optional so untagged engines default to
  // "art". See EngineFocus above for why "stack" is not a valid value.
  focus?: EngineFocus;
  params: ParamDef[];
  field(args: FieldArgs): void;
}

export interface TextBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface RenderResult {
  textBox?: TextBox;
}
