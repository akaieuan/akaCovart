import { create } from "zustand";

// ── Studio state ───────────────────────────────────────────────────────────
// All params are mirrored from the prototype defaults (index.html). The store
// is a flat bag of generation params plus UI flags. `renderTo` receives the
// whole object, so keys must match what the engine reads.

export type Mode = "still" | "animate";
export type MoodSel = "dark" | "cream" | "grey" | "random";

export interface OpenSections {
  library: boolean;
  palette: boolean;
  composition: boolean;
  texture: boolean;
  sigil: boolean;
  type: boolean;
}

export interface StudioState {
  // palette / mood
  mood: MoodSel;

  // engine + engine-specific composition params
  engine: string;
  gridCols: number;
  gridDensity: number;
  gridPerspective: number;
  gridMagnet: number;
  waveCount: number;
  waveAmp: number;
  waveDetail: number;
  waveTurbulence: number;
  wavePerspective: number;
  orbSize: number;
  orbSoft: number;
  orbHalftone: number;
  orbMelt: number;
  orbShade: number;

  // seed
  seed: number;

  // shared texture / finish
  soften: number;
  density: number;
  smear: number;
  grain: number;
  blobSize: number;
  glow: number;
  contrast: number;
  saturation: number;
  vignette: number;
  bloom: number;
  grainSize: number;
  dust: number;

  // accent
  accent: number;
  accentCount: number;

  // diamonds
  diamonds: boolean;
  diamondCount: number;
  diamondSize: number;
  diamondShape: number;

  // sigil
  sigilMarks: boolean;
  sigilMarkCount: number;
  sigilMarkSize: number;
  sigilMarkScatter: number;
  sigilFrame: boolean;
  sigilFrameDensity: number;

  // texture scratches
  scratches: boolean;
  scratchCount: number;

  // type overlay
  showText: boolean;
  title: string;
  artist: string;
  textColor: string;
  textCase: string;
  distort: number;
  textX: number;
  textY: number;
  textAlign: string;

  // mode + animation params
  mode: Mode;
  animSpeed: number;
  animDrift: number;
  animSwirl: number;
  animBPM: number;
  animPump: number;
  animKick: number;

  // per-engine motion params (group: "motion") — eased + space-only
  orbSpin: number;
  orbWobble: number;
  orbBounce: number;
  orbBreath: number;
  orbChurn: number;
  waveFlow: number;
  waveSwell: number;
  waveSurge: number;
  waveChurn: number;
  waveUndulate: number;
  gridRipple: number;
  gridBob: number;
  gridPop: number;
  gridOrbit: number;
  gridFlow: number;

  // UI / process flags
  open: OpenSections;
  gallerySeeds: number[];
  rendering: boolean;
  recording: boolean;

  // actions
  setState: (patch: Partial<StudioState>) => void;
  toggleSection: (key: keyof OpenSections) => void;
  setAllSections: (open: boolean) => void;
  newSeed: () => void;
  rerollGallery: () => void;
  resetParams: () => void;
}

export function randSeed(): number {
  return (Math.random() * 1e9) | 0;
}

export function makeSeeds(n: number): number[] {
  const a: number[] = [];
  for (let i = 0; i < n; i++) a.push(randSeed());
  return a;
}

// Prototype defaults, verbatim.
const defaults = {
  mood: "random" as MoodSel,

  engine: "blob",
  gridCols: 9,
  gridDensity: 55,
  gridPerspective: 0,
  gridMagnet: 0,
  waveCount: 60,
  waveAmp: 50,
  waveDetail: 45,
  waveTurbulence: 25,
  wavePerspective: 0,
  orbSize: 55,
  orbSoft: 55,
  orbHalftone: 40,
  orbMelt: 30,
  orbShade: 55,

  soften: 0,
  density: 60,
  smear: 45,
  grain: 60,
  blobSize: 50,
  glow: 55,
  contrast: 50,
  saturation: 50,
  vignette: 28,
  bloom: 22,
  grainSize: 50,
  dust: 18,

  accent: 60,
  accentCount: 2,

  diamonds: true,
  diamondCount: 2,
  diamondSize: 50,
  diamondShape: 50,

  sigilMarks: true,
  sigilMarkCount: 5,
  sigilMarkSize: 42,
  sigilMarkScatter: 58,
  sigilFrame: false,
  sigilFrameDensity: 50,

  scratches: true,
  scratchCount: 6,

  showText: true,
  title: "UNTITLED",
  artist: "V/A",
  textColor: "auto",
  textCase: "upper",
  distort: 0,
  textX: 0.05,
  textY: 0.85,
  textAlign: "left",

  mode: "still" as Mode,
  animSpeed: 55,
  animDrift: 62,
  animSwirl: 24,
  animBPM: 128,
  animPump: 55,
  animKick: 50,

  // per-engine motion params (group: "motion")
  orbSpin: 25,
  orbWobble: 40,
  orbBounce: 50,
  orbBreath: 35,
  orbChurn: 45,
  waveFlow: 50,
  waveSwell: 40,
  waveSurge: 55,
  waveChurn: 40,
  waveUndulate: 45,
  gridRipple: 45,
  gridBob: 40,
  gridPop: 55,
  gridOrbit: 35,
  gridFlow: 30,

  rendering: false,
  recording: false,
};

// Deterministic initial values so the static-prerendered HTML matches the first
// client render (no hydration mismatch). The Studio randomizes both on mount,
// so the user still gets fresh art on every load.
const INITIAL_SEED = 1;
const INITIAL_GALLERY = [101, 202, 303, 404, 505, 606, 707, 808, 909];

export const useStudio = create<StudioState>((set) => ({
  ...defaults,
  seed: INITIAL_SEED,
  open: {
    library: true,
    palette: true,
    composition: false,
    texture: false,
    sigil: true,
    type: false,
  },
  gallerySeeds: INITIAL_GALLERY,

  setState: (patch) => set((s) => ({ ...s, ...patch })),
  toggleSection: (key) =>
    set((s) => ({ open: { ...s.open, [key]: !s.open[key] } })),
  setAllSections: (open) =>
    set((s) => {
      const next = { ...s.open };
      (Object.keys(next) as (keyof OpenSections)[]).forEach((k) => {
        next[k] = open;
      });
      return { open: next };
    }),
  newSeed: () => set({ seed: randSeed() }),
  rerollGallery: () => set({ gallerySeeds: makeSeeds(9) }),
  resetParams: () =>
    set(() => {
      // Reset all generation/animation params to their defaults, but keep the
      // current seed, mode, open sections, gallerySeeds, and process flags.
      const {
        mode: _mode,
        rendering: _rendering,
        recording: _recording,
        ...paramDefaults
      } = defaults;
      void _mode;
      void _rendering;
      void _recording;
      return paramDefaults;
    }),
}));

// ── Render-param projection ─────────────────────────────────────────────────
// renderTo wants a plain param record. Strip the action functions so we never
// pass closures into the engine.
export function renderParams(s: StudioState): Record<string, unknown> {
  const {
    setState: _a,
    toggleSection: _b,
    newSeed: _c,
    rerollGallery: _d,
    ...rest
  } = s;
  void _a;
  void _b;
  void _c;
  void _d;
  return rest;
}
