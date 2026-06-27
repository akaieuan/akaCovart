import type { NumKey, BoolKey, StrKey } from "./primitives";

// ── Data-driven control config ───────────────────────────────────────────────
// Every repetitive control row is described as DATA here, then rendered by a
// generic mapper in Controls.tsx. No copy-pasted slider/toggle JSX.
//
// `key` is a numeric/boolean/string field on the Zustand store. `kind` selects
// the primitive. Ranges/steps mirror src/lib/store.ts defaults and the engine
// param expectations. Each rendered row self-subscribes to its own store slice.

export interface SegOption {
  value: string;
  label: string;
}

export interface SliderControl {
  kind: "slider";
  key: NumKey;
  label: string;
  min: number;
  max: number;
  step?: number;
  /** Render as a quieter "sub" row (indented child of a toggle group). */
  sub?: boolean;
}

export interface ToggleControl {
  kind: "toggle";
  key: BoolKey;
  label: string;
}

export interface SegmentedControl {
  kind: "segmented";
  key: StrKey;
  label?: string;
  options: SegOption[];
}

export interface TextControl {
  kind: "text";
  key: StrKey;
  placeholder?: string;
  /** Slightly muted styling for the secondary (artist) field. */
  muted?: boolean;
}

export type Control =
  | SliderControl
  | ToggleControl
  | SegmentedControl
  | TextControl;

// A labelled run of controls inside a section (e.g. "ACCENT STREAKS").
export interface ControlGroup {
  /** Optional sub-heading shown above the run. */
  heading?: string;
  controls: Control[];
}

// ── Engine identity ──────────────────────────────────────────────────────────
export const ENGINE_TAB_LABELS: Record<string, string> = {
  blob: "Blob",
  grid: "Grid",
  contours: "Contours",
  flux: "Flux",
  signal: "Signal",
  // TxT focus
  dither: "Dither",
  lines: "Lines",
  blur: "Blur",
};

export const FALLBACK_ENGINES: SegOption[] = [
  { value: "blob", label: "Blob" },
  { value: "grid", label: "Grid" },
  { value: "contours", label: "Contours" },
  { value: "flux", label: "Flux" },
  { value: "signal", label: "Signal" },
  { value: "dither", label: "Dither" },
  { value: "lines", label: "Lines" },
  { value: "blur", label: "Blur" },
];

// ── PALETTE / MOOD ───────────────────────────────────────────────────────────
export const MOOD_OPTIONS: SegOption[] = [
  { value: "dark", label: "Dark" },
  { value: "cream", label: "Cream" },
  { value: "grey", label: "Grey" },
  { value: "random", label: "Random" },
];

// Color transform: a colour picker (rendered directly in Controls.tsx) shifts the
// whole palette toward a picked colour, plus four sliders that recolour EVERY
// engine via the shared palette transform — Tone (light<->dark, <50 darkens the
// background too), Hue shift (rotate the whole wheel), Vibrance (grey<->vivid) and
// Warmth (cool<->warm). All are 50-neutral, so the default output is unchanged.
export const COLOR_GROUP: ControlGroup = {
  controls: [
    { kind: "slider", key: "colorTone", label: "Tone dark–light", min: 0, max: 100 },
    { kind: "slider", key: "colorHue", label: "Hue shift", min: 0, max: 100 },
    { kind: "slider", key: "colorSat", label: "Vibrance", min: 0, max: 100 },
    { kind: "slider", key: "colorWarm", label: "Warmth cool–warm", min: 0, max: 100 },
  ],
};

// Atmosphere: the abstraction controls that bring the animation to life through
// blur. Promoted to the first ("Look") panel. `soften` is the soft-focus blur and
// `bloom` the glow bleed — both global finish passes that apply to every engine.
export const ATMOSPHERE_GROUP: ControlGroup = {
  controls: [
    { kind: "slider", key: "soften", label: "Blur", min: 0, max: 100 },
    { kind: "slider", key: "bloom", label: "Glow", min: 0, max: 100 },
  ],
};

// ── COMPOSITION (per-engine) ─────────────────────────────────────────────────
// Each engine contributes its own groups; a shared FINISH group is appended for
// all engines by the renderer.
export const COMPOSITION_BY_ENGINE: Record<string, ControlGroup[]> = {
  blob: [
    {
      controls: [
        { kind: "slider", key: "density", label: "Blob density", min: 0, max: 100 },
        { kind: "slider", key: "smear", label: "Smear / blur", min: 0, max: 100 },
        { kind: "slider", key: "blobSize", label: "Blob size", min: 0, max: 100 },
        { kind: "slider", key: "glow", label: "Glow", min: 0, max: 100 },
      ],
    },
    {
      controls: [
        { kind: "toggle", key: "diamonds", label: "Diamond zones" },
        { kind: "slider", key: "diamondCount", label: "Count", min: 0, max: 4, sub: true },
        { kind: "slider", key: "diamondSize", label: "Size", min: 0, max: 100, sub: true },
        { kind: "slider", key: "diamondShape", label: "Shape wide–tall", min: 0, max: 100, sub: true },
      ],
    },
    {
      heading: "Accent streaks",
      controls: [
        { kind: "slider", key: "accent", label: "Intensity", min: 0, max: 100, sub: true },
        { kind: "slider", key: "accentCount", label: "Count", min: 0, max: 4, sub: true },
      ],
    },
  ],
  grid: [
    {
      controls: [
        { kind: "slider", key: "gridCols", label: "Columns", min: 3, max: 18 },
        { kind: "slider", key: "gridDensity", label: "Fill density", min: 0, max: 100 },
        { kind: "slider", key: "gridPerspective", label: "3D plane", min: 0, max: 100 },
        { kind: "slider", key: "gridMagnet", label: "Magnet · scatter", min: 0, max: 100 },
      ],
    },
  ],
  flux: [
    {
      controls: [
        { kind: "slider", key: "fluxScale", label: "Scale", min: 0, max: 100 },
        { kind: "slider", key: "fluxWarp", label: "Warp", min: 0, max: 100 },
        { kind: "slider", key: "fluxBands", label: "Veins", min: 0, max: 100 },
        { kind: "slider", key: "fluxDepth", label: "Depth", min: 0, max: 100 },
      ],
    },
  ],
  signal: [
    {
      controls: [
        { kind: "slider", key: "signalFreq", label: "Frequency", min: 0, max: 100 },
        { kind: "slider", key: "signalLayers", label: "Layers", min: 0, max: 100 },
        { kind: "slider", key: "signalSpread", label: "Angle spread", min: 0, max: 100 },
        { kind: "slider", key: "signalSharp", label: "Sharpness", min: 0, max: 100 },
      ],
    },
  ],
  contours: [
    {
      controls: [
        { kind: "slider", key: "contourLines", label: "Ridges", min: 0, max: 100 },
        { kind: "slider", key: "contourWeight", label: "Line weight", min: 0, max: 100 },
        { kind: "slider", key: "contourScale", label: "Terrain scale", min: 0, max: 100 },
        { kind: "slider", key: "contourDetail", label: "Detail", min: 0, max: 100 },
        { kind: "slider", key: "contourWarp", label: "Warp", min: 0, max: 100 },
        { kind: "slider", key: "contourRelief", label: "Height", min: 0, max: 100 },
        { kind: "slider", key: "contourFill", label: "Colour fill", min: 0, max: 100 },
      ],
    },
  ],
  // ── TxT focus engines ──────────────────────────────────────────────────────
  dither: [
    {
      controls: [
        { kind: "slider", key: "ditherSize", label: "Pixel size", min: 0, max: 100 },
        { kind: "slider", key: "ditherBreak", label: "Break", min: 0, max: 100 },
        { kind: "slider", key: "ditherGap", label: "Spacing", min: 0, max: 100 },
        { kind: "toggle", key: "ditherRound", label: "Round pixels" },
        { kind: "toggle", key: "ditherInvert", label: "Invert" },
      ],
    },
  ],
  lines: [
    {
      controls: [
        { kind: "slider", key: "lineSize", label: "Thickness", min: 0, max: 100 },
        { kind: "slider", key: "lineGap", label: "Spacing", min: 0, max: 100 },
        { kind: "slider", key: "lineAngle", label: "Angle", min: 0, max: 100 },
        { kind: "toggle", key: "lineInvert", label: "Invert" },
      ],
    },
  ],
  blur: [
    {
      controls: [
        { kind: "slider", key: "blurAmount", label: "Blur", min: 0, max: 100 },
        { kind: "slider", key: "blurThreshold", label: "Threshold", min: 0, max: 100 },
        { kind: "toggle", key: "blurInvert", label: "Invert" },
      ],
    },
  ],
};

// Shared FINISH group, appended to every engine's COMPOSITION section.
export const FINISH_GROUP: ControlGroup = {
  heading: "Finish",
  controls: [
    { kind: "slider", key: "contrast", label: "Contrast", min: 0, max: 100, sub: true },
    { kind: "slider", key: "saturation", label: "Saturation", min: 0, max: 100, sub: true },
    { kind: "slider", key: "vignette", label: "Vignette", min: 0, max: 100, sub: true },
  ],
};

// ── TEXTURE ──────────────────────────────────────────────────────────────────
export const TEXTURE_GROUPS: ControlGroup[] = [
  {
    controls: [
      { kind: "slider", key: "grain", label: "Film grain", min: 0, max: 100 },
      { kind: "slider", key: "grainSize", label: "Grain size", min: 0, max: 100 },
      { kind: "slider", key: "dust", label: "Dust / specks", min: 0, max: 100 },
    ],
  },
  {
    controls: [
      { kind: "toggle", key: "scratches", label: "Scratch lines" },
      { kind: "slider", key: "scratchCount", label: "Count", min: 0, max: 16, sub: true },
    ],
  },
];

// ── TYPE OVERLAY ─────────────────────────────────────────────────────────────
export const TEXT_CASE_OPTIONS: SegOption[] = [
  { value: "upper", label: "Upper" },
  { value: "lower", label: "Lower" },
  { value: "asis", label: "As-is" },
  { value: "manic", label: "Manic" },
];

export const TEXT_COLOR_OPTIONS: SegOption[] = [
  { value: "auto", label: "Auto" },
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
];

// TxT display-text alignment + vertical position (the type IS the subject).
export const TXT_ALIGN_OPTIONS: SegOption[] = [
  { value: "left", label: "Left" },
  { value: "center", label: "Center" },
  { value: "right", label: "Right" },
];

export const TXT_VALIGN_OPTIONS: SegOption[] = [
  { value: "top", label: "Top" },
  { value: "middle", label: "Middle" },
  { value: "bottom", label: "Bottom" },
];

// ── STACK focus ──────────────────────────────────────────────────────────────
// The overlay TxT engine, how it composites over the art, and which layer animates.
export const STACK_TXT_OPTIONS: SegOption[] = [
  { value: "dither", label: "Dither" },
  { value: "lines", label: "Lines" },
  { value: "blur", label: "Blur" },
];

export const STACK_MODE_OPTIONS: SegOption[] = [
  { value: "overlay", label: "On top" },
  { value: "knockout", label: "Art-filled" },
];

export const STACK_ANIM_OPTIONS: SegOption[] = [
  { value: "art", label: "Art" },
  { value: "txt", label: "Text" },
  { value: "both", label: "Both" },
];

// Curated cover faces. `value` is the real CSS family name (loaded via the
// globals.css @import) that the engine writes into params.textFont and draws.
export const TEXT_FONT_OPTIONS: SegOption[] = [
  { value: "Space Grotesk", label: "Space Grotesk" },
  { value: "Anton", label: "Anton" },
  { value: "Instrument Serif", label: "Instrument Serif" },
  { value: "Syne", label: "Syne" },
];

// 3x3 position grid: column carries x + align, rows carry y.
export const POS_COLS = [
  { x: 0.05, align: "left" },
  { x: 0.5, align: "center" },
  { x: 0.95, align: "right" },
] as const;
export const POS_ROWS = [0.06, 0.45, 0.84] as const;

// ── ANIMATE: BEAT / DRIFT / MOTION ───────────────────────────────────────────
export const BEAT_GROUP: ControlGroup = {
  heading: "Beat",
  controls: [
    { kind: "slider", key: "animBPM", label: "BPM", min: 90, max: 160 },
    { kind: "slider", key: "animPump", label: "Pump", min: 0, max: 100 },
    { kind: "slider", key: "animKick", label: "Kick", min: 0, max: 100 },
  ],
};

export const DRIFT_GROUP: ControlGroup = {
  heading: "Drift",
  controls: [
    { kind: "slider", key: "animSpeed", label: "Speed", min: 0, max: 100 },
    { kind: "slider", key: "animDrift", label: "Wander", min: 0, max: 100 },
    { kind: "slider", key: "animSwirl", label: "Swirl", min: 0, max: 100 },
  ],
};

// Per-engine MOTION. Every engine has a dedicated, space-only motion set.
export const MOTION_BY_ENGINE: Record<string, Control[]> = {
  blob: [
    { kind: "slider", key: "blobFlow", label: "Flow", min: 0, max: 100 },
    { kind: "slider", key: "blobSwirl", label: "Swirl", min: 0, max: 100 },
    { kind: "slider", key: "blobPulse", label: "Pulse", min: 0, max: 100 },
    { kind: "slider", key: "blobWander", label: "Wander", min: 0, max: 100 },
    { kind: "slider", key: "blobMorph", label: "Morph", min: 0, max: 100 },
  ],
  contours: [
    { kind: "slider", key: "contourMorph", label: "Morph speed", min: 0, max: 100 },
    { kind: "slider", key: "contourFlow", label: "Fly forward", min: 0, max: 100 },
    { kind: "slider", key: "contourSway", label: "Camera sway", min: 0, max: 100 },
    { kind: "slider", key: "contourLift", label: "Beat lift", min: 0, max: 100 },
  ],
  flux: [
    { kind: "slider", key: "fluxFlow", label: "Flow", min: 0, max: 100 },
    { kind: "slider", key: "fluxDrift", label: "Drift", min: 0, max: 100 },
    { kind: "slider", key: "fluxSwirl", label: "Swirl", min: 0, max: 100 },
    { kind: "slider", key: "fluxPulse", label: "Pulse", min: 0, max: 100 },
  ],
  signal: [
    { kind: "slider", key: "signalDrift", label: "Drift", min: 0, max: 100 },
    { kind: "slider", key: "signalSwirl", label: "Swirl", min: 0, max: 100 },
    { kind: "slider", key: "signalPulse", label: "Pulse", min: 0, max: 100 },
    { kind: "slider", key: "signalFlow", label: "Shimmer", min: 0, max: 100 },
  ],
  grid: [
    { kind: "slider", key: "gridRipple", label: "Ripple", min: 0, max: 100 },
    { kind: "slider", key: "gridBob", label: "Bob", min: 0, max: 100 },
    { kind: "slider", key: "gridPop", label: "Pop", min: 0, max: 100 },
    { kind: "slider", key: "gridOrbit", label: "Orbit", min: 0, max: 100 },
    { kind: "slider", key: "gridFlow", label: "Flow", min: 0, max: 100 },
  ],
  // ── TxT focus engines ──
  dither: [
    { kind: "slider", key: "txtLoopBeats", label: "Resolve", min: 0, max: 100 },
    { kind: "slider", key: "ditherShuffle", label: "Shuffle", min: 0, max: 100 },
    { kind: "slider", key: "ditherJitter", label: "Jitter", min: 0, max: 100 },
    { kind: "slider", key: "ditherPulse", label: "Pulse", min: 0, max: 100 },
    { kind: "slider", key: "ditherSwell", label: "Breathe", min: 0, max: 100 },
  ],
  lines: [
    { kind: "slider", key: "txtLoopBeats", label: "Resolve", min: 0, max: 100 },
    { kind: "slider", key: "lineRotate", label: "Sweep", min: 0, max: 100 },
    { kind: "slider", key: "lineScroll", label: "Scroll", min: 0, max: 100 },
    { kind: "slider", key: "linePulse", label: "Pulse", min: 0, max: 100 },
    { kind: "slider", key: "lineWave", label: "Wave", min: 0, max: 100 },
  ],
  blur: [
    { kind: "slider", key: "txtLoopBeats", label: "Resolve", min: 0, max: 100 },
    { kind: "slider", key: "blurFlow", label: "Melt", min: 0, max: 100 },
    { kind: "slider", key: "blurPulse", label: "Pulse", min: 0, max: 100 },
    { kind: "slider", key: "blurDrift", label: "Drift", min: 0, max: 100 },
  ],
};
