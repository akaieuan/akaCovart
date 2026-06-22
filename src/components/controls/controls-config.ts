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
  waves: "Wave",
  orb: "Orb",
  orb3d: "3D",
};

// 3D engine shape options (segmented selector). Values match the geometry switch
// in WebGLStage.
export const ORB3D_SHAPE_OPTIONS: SegOption[] = [
  { value: "sphere", label: "Sphere" },
  { value: "icosahedron", label: "Icosa" },
  { value: "tetrahedron", label: "Tetra" },
  { value: "cube", label: "Cube" },
  { value: "octahedron", label: "Octa" },
  { value: "prism", label: "Prism" },
];

export const FALLBACK_ENGINES: SegOption[] = [
  { value: "blob", label: "Blob" },
  { value: "grid", label: "Grid" },
  { value: "waves", label: "Wave" },
  { value: "orb", label: "Orb" },
];

// ── PALETTE / MOOD ───────────────────────────────────────────────────────────
export const MOOD_OPTIONS: SegOption[] = [
  { value: "dark", label: "Dark" },
  { value: "cream", label: "Cream" },
  { value: "grey", label: "Grey" },
  { value: "random", label: "Random" },
];

// Color transform: a real colour picker (rendered directly in Controls.tsx)
// shifts the whole palette toward a picked colour, plus a Tone slider that runs
// the palette light<->dark. Tone below 50 darkens — including the background —
// which is the readability fix. (Hue/Saturation sliders were replaced by the
// picker, which sets store `colorPick`.)
export const COLOR_TONE_GROUP: ControlGroup = {
  controls: [
    { kind: "slider", key: "colorTone", label: "Tone dark–light", min: 0, max: 100 },
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
  waves: [
    {
      controls: [
        { kind: "slider", key: "waveCount", label: "Lines", min: 10, max: 160 },
        { kind: "slider", key: "waveAmp", label: "Amplitude", min: 0, max: 100 },
        { kind: "slider", key: "waveDetail", label: "Detail", min: 0, max: 100 },
        { kind: "slider", key: "waveTurbulence", label: "Turbulence", min: 0, max: 100 },
        { kind: "slider", key: "wavePerspective", label: "Perspective", min: 0, max: 100 },
      ],
    },
  ],
  orb: [
    {
      controls: [
        { kind: "slider", key: "orbSize", label: "Orb size", min: 0, max: 100 },
        { kind: "slider", key: "orbSoft", label: "Softness", min: 0, max: 100 },
        { kind: "slider", key: "orbHalftone", label: "Halftone", min: 0, max: 100 },
        { kind: "slider", key: "orbMelt", label: "Melt", min: 0, max: 100 },
        { kind: "slider", key: "orbShade", label: "3D shade", min: 0, max: 100 },
      ],
    },
  ],
  // 3D (WebGL) engine — a Shape selector plus the liquid/detail/rotation/shade
  // sliders. These set store params consumed by WebGLStage; the shared 2D FINISH
  // group is intentionally skipped for this engine (see Controls.tsx).
  orb3d: [
    {
      heading: "Shape",
      controls: [
        { kind: "segmented", key: "orb3dShape", options: ORB3D_SHAPE_OPTIONS },
      ],
    },
    {
      controls: [
        { kind: "slider", key: "orb3dLiquid", label: "Liquid", min: 0, max: 100 },
        { kind: "slider", key: "orb3dDetail", label: "Detail", min: 0, max: 100 },
        { kind: "slider", key: "orb3dRotate", label: "Rotation", min: 0, max: 100 },
        { kind: "slider", key: "orb3dShade", label: "Shade", min: 0, max: 100 },
      ],
    },
    {
      heading: "Background",
      controls: [
        {
          kind: "segmented",
          key: "orb3dBg",
          options: [
            { value: "studio", label: "Dark" },
            { value: "palette", label: "Palette" },
            { value: "light", label: "Light" },
          ],
        },
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
    { kind: "slider", key: "bloom", label: "Bloom", min: 0, max: 100, sub: true },
    { kind: "slider", key: "soften", label: "Soften · blur", min: 0, max: 100, sub: true },
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

// ── SIGIL ────────────────────────────────────────────────────────────────────
export const SIGIL_GROUPS: ControlGroup[] = [
  {
    controls: [
      { kind: "toggle", key: "sigilMarks", label: "Sigil marks" },
      { kind: "slider", key: "sigilMarkCount", label: "Density", min: 0, max: 20, sub: true },
      { kind: "slider", key: "sigilMarkSize", label: "Size", min: 0, max: 100, sub: true },
      { kind: "slider", key: "sigilMarkScatter", label: "Scatter", min: 0, max: 100, sub: true },
    ],
  },
  {
    controls: [
      { kind: "toggle", key: "sigilFrame", label: "Barb frame" },
      { kind: "slider", key: "sigilFrameDensity", label: "Frame density", min: 0, max: 100, sub: true },
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
  orb: [
    { kind: "slider", key: "orbSpin", label: "Spin", min: 0, max: 100 },
    { kind: "slider", key: "orbWobble", label: "Wobble", min: 0, max: 100 },
    { kind: "slider", key: "orbBounce", label: "Bounce", min: 0, max: 100 },
    { kind: "slider", key: "orbBreath", label: "Breath", min: 0, max: 100 },
    { kind: "slider", key: "orbChurn", label: "Churn", min: 0, max: 100 },
  ],
  waves: [
    { kind: "slider", key: "waveFlow", label: "Flow", min: 0, max: 100 },
    { kind: "slider", key: "waveSwell", label: "Swell", min: 0, max: 100 },
    { kind: "slider", key: "waveSurge", label: "Surge", min: 0, max: 100 },
    { kind: "slider", key: "waveChurn", label: "Churn", min: 0, max: 100 },
    { kind: "slider", key: "waveUndulate", label: "Undulate", min: 0, max: 100 },
  ],
  grid: [
    { kind: "slider", key: "gridRipple", label: "Ripple", min: 0, max: 100 },
    { kind: "slider", key: "gridBob", label: "Bob", min: 0, max: 100 },
    { kind: "slider", key: "gridPop", label: "Pop", min: 0, max: 100 },
    { kind: "slider", key: "gridOrbit", label: "Orbit", min: 0, max: 100 },
    { kind: "slider", key: "gridFlow", label: "Flow", min: 0, max: 100 },
  ],
  orb3d: [
    { kind: "slider", key: "orb3dPulse", label: "Pulse", min: 0, max: 100 },
    { kind: "slider", key: "orb3dWobble", label: "Wobble", min: 0, max: 100 },
  ],
};
