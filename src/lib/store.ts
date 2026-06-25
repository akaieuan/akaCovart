import { create } from "zustand";

import { DEFAULT_FORMAT } from "@/lib/formats";

// ── Studio state ───────────────────────────────────────────────────────────
// All params are mirrored from the prototype defaults (index.html). The store
// is a flat bag of generation params plus UI flags. `renderTo` receives the
// whole object, so keys must match what the engine reads.

export type Mode = "still" | "animate";
// Animate is the single animation. Its motion is driven by either the internal
// BPM clock or an imported audio track — `animSource` selects which.
export type AnimSource = "bpm" | "track";
export type AudioStatus = "idle" | "decoding" | "analyzing" | "ready";
export type MoodSel = "dark" | "cream" | "grey" | "random";

// Selectable clip-window lengths. A finite number of seconds, or "full" for the
// whole track. The active length caps how far the window can grow when dragging.
export type ClipLength = number | "full";

export interface OpenSections {
  library: boolean;
  palette: boolean;
  composition: boolean;
  texture: boolean;
  type: boolean;
}

export interface StudioState {
  // palette / mood
  mood: MoodSel;

  // palette transform (Color controls) — applied to the RESOLVED palette before
  // rendering, so they recolour ALL engines. Defaults are no-ops.
  // colorPick: a "#rrggbb" the whole palette is shifted toward (hue + sat) while
  // keeping each colour's lightness, so the art adopts the colour across its
  // light->dark range. null = use the mood palette's original colours.
  colorPick: string | null;
  colorTone: number; // 0..100; 50 = neutral. <50 darkens (incl. base), >50 lightens.
  colorHue: number; // 0..100; 50 = neutral. Rotates the whole palette's hue ±180°.
  colorSat: number; // 0..100; 50 = neutral. Vibrance: <50 toward grey, >50 more vivid.
  colorWarm: number; // 0..100; 50 = neutral. Temperature: <50 cooler, >50 warmer.

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
  waveFill: number; // 0..100; translucent colour bands between lines (0 = lines only).
  orbSize: number;
  orbSoft: number;
  orbHalftone: number;
  orbMelt: number;
  orbShade: number;
  contourLines: number;
  contourWeight: number;
  contourScale: number;
  contourDetail: number;
  contourWarp: number;
  contourRelief: number;
  contourMorph: number;
  contourFlow: number;
  contourFill: number; // 0..100; colour strata under each ridge (0 = bg occlusion only).
  contourSway: number; // 0..100; whole-frame camera parallax/sway (anim only).
  contourLift: number; // 0..100; beat-driven terrain + camera lift (anim only).

  // flux (liquid-marble colour field) params
  fluxScale: number;
  fluxWarp: number;
  fluxBands: number;
  fluxDepth: number;
  fluxFlow: number;
  fluxDrift: number;
  fluxSwirl: number;
  fluxPulse: number;

  // signal (interference / moiré) params
  signalFreq: number;
  signalLayers: number;
  signalSpread: number;
  signalSharp: number;
  signalDrift: number;
  signalSwirl: number;
  signalPulse: number;
  signalFlow: number;

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

  // texture scratches
  scratches: boolean;
  scratchCount: number;

  // type overlay
  showText: boolean;
  title: string;
  artist: string;
  textColor: string;
  textCase: string;
  textFont: string;
  distort: number;
  textX: number;
  textY: number;
  textAlign: string;

  // audio (SERIALIZABLE mirror only — buffer/timeline/peaks live in src/audio)
  audioName: string | null;
  audioStatus: AudioStatus;
  audioDuration: number; // full track duration (s)
  clipStart: number; // window start (s)
  clipEnd: number; // window end (s); clamped so end-start <= active length
  clipLength: ClipLength; // selected max window length (s) or "full"
  audioReactive: boolean;
  audioIntensity: number; // 0..100, overall reactivity scale
  audioPlaying: boolean;

  // mode + animation params
  mode: Mode;
  // What drives the (single) Animate motion: the internal BPM clock or the
  // imported audio track's analyzed energy/beats.
  animSource: AnimSource;
  // AUTO mode: gently auto-evolve a curated set of params around their manual
  // base values via slow bounded LFOs. Render-loop only — never mutates the
  // stored param values, so toggling off returns to the exact manual look.
  auto: boolean;
  autoIntensity: number; // 0..100, swing scale
  animSpeed: number;
  animDrift: number;
  animSwirl: number;
  animBPM: number;
  animPump: number;
  animKick: number;

  // per-engine motion params (group: "motion") — eased + space-only
  blobFlow: number;
  blobSwirl: number;
  blobPulse: number;
  blobWander: number;
  blobMorph: number;
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
  waveDrift: number; // 0..100; whole-field camera drift/parallax (anim only).
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

  // delivery format (output aspect ratio). The engine renders square; this is a
  // cover-crop applied to the live edit frame + export. See src/lib/formats.ts.
  format: string;
  // nav: multi-format bento overlay open? / preview overlay open? / sidebar collapsed?
  showFormats: boolean;
  showPreview: boolean;
  sidebarCollapsed: boolean;

  // actions
  setState: (patch: Partial<StudioState>) => void;
  toggleSection: (key: keyof OpenSections) => void;
  setAllSections: (open: boolean) => void;
  newSeed: () => void;
  rerollGallery: () => void;
  resetParams: () => void;
  // Set the clip window, clamping end-start <= active length within [0, audioDuration].
  setClip: (start: number, end: number) => void;
  // Set the active window length (seconds or "full") and refit clipEnd/clipStart.
  setClipLength: (len: ClipLength) => void;
}

// Default clip length when a track loads. Also the cap used before a length is
// explicitly chosen. Kept as a named constant so callers don't hardcode 60.
export const DEFAULT_CLIP = 60;
export const CLIP_PRESETS: ClipLength[] = [30, 60, 90, 180, "full"];

// Resolve the active length into a concrete max number of seconds for a track.
export function maxClipSeconds(len: ClipLength, duration: number): number {
  const dur = duration > 0 ? duration : Infinity;
  return len === "full" ? dur : Math.min(len, dur);
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

  // palette transform (Color controls) — neutral defaults => unchanged output.
  colorPick: null as string | null,
  colorTone: 50,
  colorHue: 50,
  colorSat: 50,
  colorWarm: 50,

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
  waveFill: 60,
  orbSize: 55,
  orbSoft: 55,
  orbHalftone: 40,
  orbMelt: 30,
  orbShade: 55,
  contourLines: 55,
  contourWeight: 40,
  contourScale: 45,
  contourDetail: 50,
  contourWarp: 50,
  contourRelief: 30,
  contourMorph: 55,
  contourFlow: 35,
  contourFill: 60,
  contourSway: 50,
  contourLift: 55,

  fluxScale: 50,
  fluxWarp: 55,
  fluxBands: 45,
  fluxDepth: 50,
  fluxFlow: 62,
  fluxDrift: 55,
  fluxSwirl: 48,
  fluxPulse: 58,

  signalFreq: 50,
  signalLayers: 50,
  signalSpread: 50,
  signalSharp: 50,
  signalDrift: 60,
  signalSwirl: 48,
  signalPulse: 58,
  signalFlow: 55,

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

  scratches: true,
  scratchCount: 6,

  showText: true,
  title: "UNTITLED",
  artist: "V/A",
  textColor: "auto",
  textCase: "upper",
  textFont: "Space Grotesk",
  distort: 0,
  textX: 0.05,
  textY: 0.85,
  textAlign: "left",

  audioName: null as string | null,
  audioStatus: "idle" as AudioStatus,
  audioDuration: 0,
  clipStart: 0,
  clipEnd: 60,
  clipLength: 60 as ClipLength,
  audioReactive: true,
  audioIntensity: 65,
  audioPlaying: false,

  mode: "still" as Mode,
  animSource: "bpm" as AnimSource,
  auto: false,
  autoIntensity: 50,
  animSpeed: 55,
  animDrift: 62,
  animSwirl: 24,
  animBPM: 128,
  animPump: 55,
  animKick: 50,

  // per-engine motion params (group: "motion")
  blobFlow: 55,
  blobSwirl: 35,
  blobPulse: 55,
  blobWander: 50,
  blobMorph: 45,
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
  waveDrift: 50,
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
    type: false,
  },
  gallerySeeds: INITIAL_GALLERY,
  format: DEFAULT_FORMAT,
  showFormats: false,
  showPreview: false,
  sidebarCollapsed: false,

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
  setClip: (start, end) =>
    set((s) => {
      const dur = s.audioDuration > 0 ? s.audioDuration : Infinity;
      const maxLen = maxClipSeconds(s.clipLength, s.audioDuration);
      let cs = Math.max(0, Math.min(start, dur));
      let ce = Math.max(cs, Math.min(end, dur));
      // Clamp window length to the active max length.
      if (ce - cs > maxLen) ce = cs + maxLen;
      // If a finite duration shrinks the window, pull start back to keep length.
      if (ce > dur) {
        ce = dur;
        cs = Math.max(0, ce - maxLen);
      }
      return { clipStart: cs, clipEnd: ce };
    }),
  setClipLength: (len) =>
    set((s) => {
      const dur = s.audioDuration > 0 ? s.audioDuration : Infinity;
      const target = maxClipSeconds(len, s.audioDuration);
      // Grow/shrink the window from the current start to the new length, nudging
      // start back if the window would overflow the end of the track.
      let cs = Math.max(0, s.clipStart);
      const ce = Math.min(cs + target, dur);
      if (ce - cs < target) cs = Math.max(0, ce - target);
      return { clipLength: len, clipStart: cs, clipEnd: ce };
    }),
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
    resetParams: _e,
    setAllSections: _f,
    setClip: _g,
    setClipLength: _h,
    ...rest
  } = s;
  void _a;
  void _b;
  void _c;
  void _d;
  void _e;
  void _f;
  void _g;
  void _h;
  return rest;
}
