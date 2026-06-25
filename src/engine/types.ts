export type Mood = "dark" | "cream" | "grey";

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
  // Which creative mode this engine belongs to. "art" = the abstract field
  // engines (the default); "txt" = the type-driven engines where the letterforms
  // are the subject. The header Focus switch + EngineSelector filter on this.
  // Optional so existing engines (untagged) default to "art".
  focus?: "art" | "txt";
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
