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
  dust: 0,
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
    label: "Flux",
    params: {
      ...BASE,
      engine: "flux",
      seed: 50231,
      fluxScale: 46,
      fluxWarp: 62,
      fluxBands: 50,
      fluxDepth: 52,
      soften: 28,
      glow: 60,
      fluxFlow: 68,
      fluxDrift: 58,
      fluxSwirl: 52,
      fluxPulse: 60,
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

// 8 ART starting points for the studio's blank-canvas picker (the 5 engine looks
// + 3 seed variations). A 9th "Random" tile is added by the picker itself.
export const ART_START_LOOKS: Preset[] = [
  PRESETS[1], // Blob
  PRESETS[0], // Grid
  PRESETS[2], // Flux
  PRESETS[3], // Contours
  PRESETS[4], // Signal
  { label: "Blob II", params: { ...PRESETS[1].params, seed: 771203 } },
  { label: "Flux II", params: { ...PRESETS[2].params, seed: 920577 } },
  { label: "Grid II", params: { ...PRESETS[0].params, seed: 558810 } },
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
  // electric-blue line hatch
  {
    label: "Lines",
    params: { engine: "lines", txtBg: "#0a1122", txtInk: "#5b9dff", seed: 7781, txtText: "ECHO", txtSub: "", textFont: "Anton", textCase: "upper", lineAngle: 26 },
  },
  // blue glow goo
  {
    label: "Blur",
    params: { engine: "blur", txtBg: "#0a0f1e", txtInk: "#7db4ff", seed: 2231, txtText: "GLOW", txtSub: "", textFont: "Syne", textCase: "upper", blurAmount: 32, blurThreshold: 54 },
  },
  // cream round pixels
  {
    label: "Dither II",
    params: { engine: "dither", mood: "cream", txtBg: null, txtInk: null, seed: 9090, txtText: "NOISE", txtSub: "", textFont: "Space Grotesk", textCase: "upper", ditherRound: true },
  },
  // inverted hatch — the type is the negative space
  {
    label: "Lines II",
    params: { engine: "lines", mood: "grey", txtBg: null, txtInk: null, seed: 1337, txtText: "WAVE", txtSub: "FORM", textFont: "Instrument Serif", textCase: "upper", lineAngle: 90, lineInvert: true },
  },
  // deep-blue melt
  {
    label: "Blur II",
    params: { engine: "blur", txtBg: "#0b0e1a", txtInk: "#9fc2ff", seed: 5560, txtText: "MELT", txtSub: "", textFont: "Anton", textCase: "upper", blurAmount: 46, blurThreshold: 46 },
  },
  // magenta inverted dither
  {
    label: "Dither III",
    params: { engine: "dither", txtBg: "#160a1c", txtInk: "#ff96ff", seed: 3303, txtText: "TYPE", txtSub: "", textFont: "Syne", textCase: "upper", ditherInvert: true, ditherBreak: 88 },
  },
  // vertical blue signal lines
  {
    label: "Lines III",
    params: { engine: "lines", txtBg: "#06101e", txtInk: "#7db4ff", seed: 8123, txtText: "SIGNAL", txtSub: "V/A", textFont: "Space Grotesk", textCase: "upper", lineAngle: 75, lineSize: 30 },
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
  dust: 0,
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
export const STACK_START_LOOKS: Preset[] = [
  {
    label: "Flux · Blur",
    params: { ...STACK_BASE, engine: "flux", stackTxt: "blur", stackMode: "overlay", seed: 51871, txtText: "AKA", txtSub: "", textFont: "Space Grotesk", txtInk: "#eaf1ff", blurAmount: 30, blurThreshold: 54, fluxFlow: 64, fluxWarp: 60 },
  },
  {
    label: "Contours · Lines",
    params: { ...STACK_BASE, engine: "contours", stackTxt: "lines", stackMode: "overlay", seed: 22045, txtText: "ECHO", txtSub: "", textFont: "Anton", txtInk: "#f3ead8", lineAngle: 24, lineSize: 38, contourFill: 60 },
  },
  {
    label: "Signal · Dither",
    params: { ...STACK_BASE, engine: "signal", stackTxt: "dither", stackMode: "overlay", seed: 88231, txtText: "NOISE", txtSub: "", textFont: "Space Grotesk", txtInk: "#cfe6ff", ditherSize: 30, ditherBreak: 82, signalDrift: 62 },
  },
  {
    label: "Blob · Filled",
    params: { ...STACK_BASE, engine: "blob", stackTxt: "blur", stackMode: "knockout", seed: 41216, txtText: "GLOW", txtSub: "", textFont: "Syne", txtBg: "#080a10", blurAmount: 40, blurThreshold: 48, blobSize: 60, glow: 72 },
  },
  {
    label: "Flux · Dither",
    params: { ...STACK_BASE, engine: "flux", stackTxt: "dither", stackMode: "overlay", seed: 30312, txtText: "TYPE", txtSub: "", textFont: "Syne", txtInk: "#ffd6ff", ditherInvert: false, ditherBreak: 86, fluxWarp: 64 },
  },
  {
    label: "Grid · Lines",
    params: { ...STACK_BASE, engine: "grid", stackTxt: "lines", stackMode: "overlay", stackScrim: 28, seed: 73410, txtText: "WAVE", txtSub: "FORM", textFont: "Instrument Serif", txtInk: "#f2f4ff", txtBg: "#0a0c16", lineAngle: 90, gridCols: 13 },
  },
  {
    label: "Contours · Filled",
    params: { ...STACK_BASE, engine: "contours", stackTxt: "blur", stackMode: "knockout", seed: 50552, txtText: "MELT", txtSub: "", textFont: "Anton", txtBg: "#0b0e14", blurAmount: 44, blurThreshold: 46, contourLines: 62, contourFill: 64 },
  },
  {
    label: "Signal · Lines",
    params: { ...STACK_BASE, engine: "signal", stackTxt: "lines", stackMode: "overlay", seed: 81230, txtText: "SIGNAL", txtSub: "V/A", textFont: "Space Grotesk", txtInk: "#bcdcff", lineAngle: 72, lineSize: 30, signalFreq: 54 },
  },
];
