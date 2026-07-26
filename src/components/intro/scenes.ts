// Curated landing scenes — one look per engine. Shared by the landing loop
// backdrop (Intro) and the studio's blank-canvas starting-point picker
// (StartPicker), so the suggestions match the looping hero the visitor just saw.
export type Preset = { label: string; params: Record<string, unknown> };

const BASE: Record<string, unknown> = {
  mood: "dark",
  colorPick: null,
  colorTone: 50,
  contrast: 50,
  saturation: 50,
  vignette: 30,
  bloom: 24,
  grain: 60,
  grainSize: 14,
  scratches: false,
  scratchCount: 0,
  showText: false,
  animBPM: 124,
  animPump: 55,
  animKick: 48,
  animSpeed: 52,
  animDrift: 60,
  animSwirl: 24,
};

export const PRESETS: Preset[] = [
  {
    label: "Grid",
    params: {
      ...BASE,
      engine: "grid",
      seed: 730104923,
      gridCols: 14,
      gridDensity: 56,
      gridPerspective: 0,
      gridMagnet: 36,
      soften: 55,
      grainSize: 13,
      gridRipple: 78,
      gridBob: 100,
      gridPop: 55,
      gridOrbit: 77,
      gridFlow: 100,
    },
  },
  {
    label: "Blob",
    params: {
      ...BASE,
      engine: "blob",
      seed: 412556,
      density: 62,
      smear: 58,
      blobSize: 64,
      glow: 72,
      diamonds: true,
      diamondCount: 2,
      diamondSize: 54,
      diamondShape: 48,
      accent: 58,
      accentCount: 2,
      soften: 42,
      blobFlow: 62,
      blobSwirl: 42,
      blobPulse: 58,
      blobWander: 56,
      blobMorph: 52,
    },
  },
  {
    label: "Contours",
    params: {
      ...BASE,
      engine: "contours",
      seed: 305522,
      contourLines: 60,
      contourWeight: 36,
      contourScale: 46,
      contourDetail: 54,
      contourWarp: 56,
      contourRelief: 34,
      contourFill: 62,
      contourMorph: 60,
      contourFlow: 48,
      contourSway: 52,
      soften: 30,
      glow: 55,
    },
  },
  {
    label: "Signal",
    params: {
      ...BASE,
      engine: "signal",
      seed: 88412,
      signalFreq: 50,
      signalLayers: 55,
      signalSpread: 52,
      signalSharp: 58,
      soften: 26,
      glow: 60,
      signalDrift: 65,
      signalSwirl: 50,
      signalPulse: 60,
      signalFlow: 58,
    },
  },
];

// 8 ART starting points for the studio's blank-canvas picker. A 9th "Random" tile
// is added by the picker itself.
//
// Each is the 4 engines × two GENUINELY different treatments — not seed variants.
// A reseed alone barely changes Grid/Contours (their character comes from the
// params, not the seed), so the second pass of each engine varies mood, palette
// and composition: light vs dark, soft vs hard, filled vs line-only, coarse vs fine.
export const ART_START_LOOKS: Preset[] = [
  PRESETS[1], // Blob — dark, soft glowing clouds
  PRESETS[0], // Grid — dark, dense scattered cells
  PRESETS[2], // Contours — dark, colour-filled terrain
  PRESETS[3], // Signal — dark, coarse moiré webbing
  // Cream, airy: few huge soft blobs on a light ground (vs the dark cloud field).
  {
    label: "Blob · Cream",
    params: {
      ...PRESETS[1].params,
      mood: "cream",
      seed: 771203,
      density: 52,
      blobSize: 70,
      smear: 34,
      glow: 58,
      diamonds: true,
      diamondCount: 3,
      diamondSize: 62,
      accent: 68,
      accentCount: 3,
      soften: 18,
      vignette: 30,
      grain: 44,
    },
  },
  // Hard geometry: few BIG bright cells on a 3D plane, no blur (vs the soft,
  // dark, fine-grained speckle of the base Grid).
  {
    label: "Grid · Plane",
    params: {
      ...PRESETS[0].params,
      seed: 558810,
      colorPick: "#ff7a1a", // vivid warm — the only hot tile in the set
      gridCols: 6,
      gridDensity: 94,
      gridPerspective: 42,
      gridMagnet: 0,
      soften: 0,
      glow: 96,
      grainSize: 42,
      vignette: 10,
    },
  },
  // Dark line-drawing terrain: tall relief, heavy strokes, NO colour fill — the
  // stark inverse of the base Contours (which is soft + colour-filled).
  {
    label: "Contours · Relief",
    params: {
      ...PRESETS[2].params,
      mood: "grey",
      colorTone: 50,
      seed: 920577,
      contourLines: 84,
      contourWeight: 78,
      contourRelief: 78,
      contourFill: 0,
      contourScale: 28,
      soften: 0,
      glow: 24,
      vignette: 34,
    },
  },
  // Fine violet THREADS: high frequency + high sharpness makes crisp thin fringes
  // (vs the base Signal's fat soft white webbing), with the flow warp curving them.
  {
    label: "Signal · Weave",
    params: {
      ...PRESETS[3].params,
      seed: 305881,
      colorPick: "#8b5bff",
      signalFreq: 88,
      signalLayers: 88,
      signalSpread: 80,
      signalSharp: 88,
      signalWarp: 74,
      soften: 0,
      glow: 40,
      vignette: 40,
    },
  },
];

// 8 TxT starting points — distinct type treatments across Dither / Lines / Blur
// with varied display text, fonts and two-tone colours. Each is self-contained
// (sets engine + text + the two tones, or a mood to derive them).
export const TXT_START_LOOKS: Preset[] = [
  // brand default — stark mono dither
  {
    label: "Dither",
    params: { engine: "dither", mood: "dark", txtBg: null, txtInk: null, seed: 4412, txtText: "AKA", txtSub: "COVART", textFont: "Space Grotesk", textCase: "upper" },
  },
  // bold blue FIELD with white hatched type — inverts the value relationship, so it
  // never reads as another dark-navy-with-blue-text tile like the Blur "GLOW".
  {
    label: "Lines",
    params: { engine: "lines", txtBg: "#1b3f9c", txtInk: "#eef4ff", seed: 7781, txtText: "ECHO", txtSub: "", textFont: "Anton", textCase: "upper", lineAngle: 26, lineSize: 46 },
  },
  // blue glow goo
  {
    label: "Blur",
    params: { engine: "blur", txtBg: "#0a0f1e", txtInk: "#7db4ff", seed: 2231, txtText: "GLOW", txtSub: "", textFont: "Syne", textCase: "upper", blurAmount: 32, blurThreshold: 54 },
  },
  // cream round pixels — bigger cells + a denser dropout so the word stays legible
  {
    label: "Dither II",
    params: { engine: "dither", mood: "cream", txtBg: null, txtInk: null, seed: 9090, txtText: "NOISE", txtSub: "", textFont: "Space Grotesk", textCase: "upper", ditherRound: true, ditherSize: 52, ditherBreak: 92, ditherGap: 6 },
  },
  // inverted hatch — the type is the negative space
  {
    label: "Lines II",
    params: { engine: "lines", mood: "grey", txtBg: null, txtInk: null, seed: 1337, txtText: "WAVE", txtSub: "FORM", textFont: "Instrument Serif", textCase: "upper", lineAngle: 90, lineInvert: true },
  },
  // molten amber — heavy merge, warm (deliberately NOT another blue goo)
  {
    label: "Blur II",
    params: { engine: "blur", txtBg: "#160c04", txtInk: "#ffae4d", seed: 5560, txtText: "MELT", txtSub: "", textFont: "Anton", textCase: "upper", blurAmount: 58, blurThreshold: 40 },
  },
  // magenta inverted dither
  {
    label: "Dither III",
    params: { engine: "dither", txtBg: "#160a1c", txtInk: "#ff96ff", seed: 3303, txtText: "TYPE", txtSub: "", textFont: "Syne", textCase: "upper", ditherInvert: true, ditherBreak: 88 },
  },
  // acid-green fine vertical hatch on near-black (distinct from the blue ECHO hatch)
  {
    label: "Lines III",
    params: { engine: "lines", txtBg: "#07120b", txtInk: "#7dff9e", seed: 8123, txtText: "SIGNAL", txtSub: "V/A", textFont: "Space Grotesk", textCase: "upper", lineAngle: 75, lineSize: 18, lineGap: 8 },
  },
];

// Shared base for the Stack starting points — sets focus + a calm dark, grainy
// art finish so every tile reads as "art behind, type on top".
const STACK_BASE: Record<string, unknown> = {
  focus: "stack",
  mood: "dark",
  colorPick: null,
  contrast: 50,
  saturation: 52,
  vignette: 30,
  bloom: 26,
  soften: 32,
  glow: 60,
  grain: 50,
  grainSize: 14,
  scratches: false,
  showText: false,
  textCase: "upper",
  stackAnim: "txt",
  txtLoopBeats: 20,
  animBPM: 124,
  animPump: 55,
  animKick: 48,
  animSpeed: 52,
  animDrift: 60,
  animSwirl: 24,
};

// 8 STACK starting points — an Art background + a TxT type layer (on-top overlay or
// art-filled knockout) across the engine pairings. A 9th "Random" tile is added by
// the picker (it mixes a random art bg + a random type engine).
// Each of the 4 art backgrounds is used EXACTLY TWICE (paired with a different
// type engine each time) so no two tiles share a backdrop, and the two knockout
// ("art-filled") tiles use a deliberately BRIGHT background — art-filled letters
// on a near-black ground only read when the art inside them is light.
export const STACK_START_LOOKS: Preset[] = [
  {
    label: "Signal · Blur",
    params: { ...STACK_BASE, engine: "signal", stackTxt: "blur", stackMode: "overlay", seed: 51871, txtText: "AKA", txtSub: "", textFont: "Space Grotesk", txtInk: "#eaf1ff", blurAmount: 30, blurThreshold: 54, signalFreq: 46, signalLayers: 52 },
  },
  {
    label: "Contours · Lines",
    params: { ...STACK_BASE, engine: "contours", stackTxt: "lines", stackMode: "overlay", seed: 22045, txtText: "ECHO", txtSub: "", textFont: "Anton", txtInk: "#f3ead8", lineAngle: 24, lineSize: 38, contourFill: 60 },
  },
  {
    label: "Grid · Dither",
    params: { ...STACK_BASE, engine: "grid", stackTxt: "dither", stackMode: "overlay", seed: 88231, txtText: "NOISE", txtSub: "", textFont: "Space Grotesk", txtInk: "#cfe6ff", ditherSize: 30, ditherBreak: 82, gridCols: 9, gridDensity: 66, gridMagnet: 44, soften: 20 },
  },
  {
    // Art-filled letters need art with VISIBLE STRUCTURE inside them, not just
    // bright art — a vivid cyan blob field with accents reads as pattern-in-type.
    label: "Blob · Filled",
    params: { ...STACK_BASE, engine: "blob", stackTxt: "blur", stackMode: "knockout", seed: 41216, colorPick: "#22e0ff", txtText: "GLOW", txtSub: "", textFont: "Syne", txtBg: "#05070c", blurAmount: 40, blurThreshold: 48, blobSize: 78, density: 88, glow: 96, accent: 74, accentCount: 3, diamonds: true, diamondCount: 3, soften: 30 },
  },
  {
    label: "Blob · Dither",
    params: { ...STACK_BASE, engine: "blob", stackTxt: "dither", stackMode: "overlay", seed: 30312, txtText: "TYPE", txtSub: "", textFont: "Syne", txtInk: "#ffd6ff", ditherInvert: false, ditherBreak: 86, blobSize: 62, density: 74, glow: 92, accent: 70, accentCount: 3, soften: 18 },
  },
  {
    label: "Grid · Lines",
    params: { ...STACK_BASE, engine: "grid", stackTxt: "lines", stackMode: "overlay", stackScrim: 18, seed: 73410, txtText: "WAVE", txtSub: "FORM", textFont: "Instrument Serif", txtInk: "#f2f4ff", txtBg: "#0a0c16", lineAngle: 90, gridCols: 12, gridDensity: 84, gridPerspective: 56, glow: 88, soften: 10 },
  },
  {
    // The other knockout — vivid warm terrain bands so the letters read as strata.
    label: "Contours · Filled",
    params: { ...STACK_BASE, engine: "contours", stackTxt: "blur", stackMode: "knockout", seed: 50552, colorPick: "#ff9f2e", txtText: "MELT", txtSub: "", textFont: "Anton", txtBg: "#0c0904", blurAmount: 44, blurThreshold: 46, contourLines: 76, contourFill: 100, contourRelief: 66, contourWeight: 52, soften: 6 },
  },
  {
    label: "Signal · Lines",
    params: { ...STACK_BASE, engine: "signal", stackTxt: "lines", stackMode: "overlay", seed: 81230, txtText: "SIGNAL", txtSub: "V/A", textFont: "Space Grotesk", txtInk: "#bcdcff", lineAngle: 72, lineSize: 22, lineGap: 10, signalFreq: 78, signalWarp: 64, signalSharp: 34 },
  },
];
