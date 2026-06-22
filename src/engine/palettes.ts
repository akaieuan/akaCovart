import type { Mood, Palette } from "./types";
import { prng } from "./prng";
import { huerot } from "./color";

// Palettes ported verbatim from the prototype (index.html `palettes()`).
export const palettes: Record<Mood, Palette> = {
  dark: {
    base: [6, 7, 9],
    colors: [
      [214, 226, 220],
      [214, 226, 220],
      [196, 212, 210],
      [104, 148, 134],
      [40, 74, 86],
      [60, 96, 78],
      [186, 138, 146],
      [150, 176, 196],
      [150, 140, 84],
    ],
    diamondColors: [
      [226, 234, 229],
      [150, 202, 182],
      [120, 172, 192],
      [202, 150, 162],
      [110, 164, 142],
      [230, 228, 222],
    ],
    fleck: [236, 241, 239],
    smoke: [40, 44, 46],
    accentColors: [
      [212, 190, 72],
      [80, 182, 172],
      [212, 120, 142],
    ],
    scratch: "rgb(206,212,212)",
    markerColors: [
      [120, 132, 128],
      [150, 148, 92],
      [92, 144, 154],
    ],
    markerBg: [34, 40, 42],
    markerDot: [150, 160, 158],
    blobCount: 26,
    rMin: 0.05,
    rMax: 0.18,
    aMin: 0.32,
    aMax: 0.72,
    diamondAlpha: 0.95,
    topSmudge: false,
    clearCenter: false,
  },
  cream: {
    base: [233, 231, 220],
    colors: [
      [233, 231, 220],
      [210, 214, 196],
      [176, 200, 158],
      [214, 168, 180],
      [150, 150, 176],
      [208, 170, 128],
      [180, 176, 96],
      [120, 140, 128],
      [96, 112, 134],
      [150, 112, 90],
      [110, 116, 118],
    ],
    diamondColors: [
      [150, 176, 134],
      [176, 128, 142],
      [120, 134, 168],
      [170, 150, 108],
      [206, 224, 190],
      [120, 128, 124],
    ],
    fleck: [252, 250, 244],
    smoke: [120, 118, 112],
    accentColors: [
      [200, 176, 30],
      [70, 168, 176],
      [214, 120, 150],
    ],
    scratch: "rgb(96,94,88)",
    markerColors: [
      [120, 114, 96],
      [80, 140, 150],
      [150, 110, 96],
    ],
    markerBg: [150, 140, 116],
    markerDot: [90, 74, 56],
    blobCount: 26,
    rMin: 0.1,
    rMax: 0.32,
    aMin: 0.1,
    aMax: 0.3,
    diamondAlpha: 0.34,
    topSmudge: true,
    clearCenter: true,
  },
  grey: {
    base: [204, 198, 192],
    colors: [
      [120, 116, 112],
      [170, 160, 144],
      [190, 150, 158],
      [150, 144, 178],
      [180, 172, 108],
      [120, 140, 160],
      [44, 72, 56],
      [92, 90, 88],
      [150, 110, 86],
    ],
    diamondColors: [
      [120, 134, 120],
      [160, 120, 130],
      [118, 124, 156],
      [150, 150, 110],
      [90, 96, 92],
    ],
    fleck: [244, 242, 238],
    smoke: [100, 98, 96],
    accentColors: [
      [196, 176, 40],
      [60, 150, 150],
      [206, 120, 148],
    ],
    scratch: "rgb(54,52,50)",
    markerColors: [
      [100, 96, 92],
      [80, 130, 140],
      [150, 110, 120],
    ],
    markerBg: [120, 114, 108],
    markerDot: [56, 54, 52],
    blobCount: 40,
    rMin: 0.08,
    rMax: 0.26,
    aMin: 0.18,
    aMax: 0.46,
    diamondAlpha: 0.4,
    topSmudge: false,
    clearCenter: false,
  },
};

// Ported verbatim from the prototype (index.html `resolveMood`).
export function resolveMood(seed: number, mood: Mood | "random"): Mood {
  if (mood !== "random") return mood;
  const r = prng(seed >>> 0);
  const moods: Mood[] = ["dark", "cream", "grey"];
  return moods[Math.floor(r() * 3)];
}

// ── Palette transform (Color controls) ───────────────────────────────────────
// Recolours a resolved palette before rendering so the three "Color" sliders
// (tone / hue / saturation) affect EVERY engine. Operates only on the rgb color
// fields (base, colors, accentColors, diamondColors, fleck, smoke); every other
// field — counts, alphas, flags, and the `scratch` string — is carried through
// untouched. At default values (tone=50, hue=0, sat=50) the transform is skipped
// entirely so output is byte-identical to before this feature existed.
function clamp255(v: number): number {
  return v < 0 ? 0 : v > 255 ? 255 : v;
}

// Transform a single rgb triple: hue rotation -> saturation scale -> tone bias.
function transformColor(c: number[], deg: number, sat: number, t: number): number[] {
  // 1) Hue rotation (degrees), reusing the prototype's HSL rotation.
  let out = deg ? huerot(c, deg) : [c[0], c[1], c[2]];
  // 2) Saturation: pull toward / push away from luma. sat==50 -> identity.
  if (sat !== 50) {
    const k = sat / 50;
    const gray = 0.299 * out[0] + 0.587 * out[1] + 0.114 * out[2];
    out = [
      clamp255(gray + (out[0] - gray) * k),
      clamp255(gray + (out[1] - gray) * k),
      clamp255(gray + (out[2] - gray) * k),
    ];
  }
  // 3) Tone lightness bias. t<0 darkens (incl. the base), t>0 lightens.
  if (t !== 0) {
    out =
      t < 0
        ? [out[0] * (1 + t * 0.85), out[1] * (1 + t * 0.85), out[2] * (1 + t * 0.85)]
        : [
            out[0] + (255 - out[0]) * (t * 0.75),
            out[1] + (255 - out[1]) * (t * 0.75),
            out[2] + (255 - out[2]) * (t * 0.75),
          ];
  }
  return [
    Math.round(clamp255(out[0])),
    Math.round(clamp255(out[1])),
    Math.round(clamp255(out[2])),
  ];
}

export function transformPalette(
  cfg: Palette,
  tone: number,
  hue: number,
  sat: number,
): Palette {
  // Defaults -> no-op, so existing art is unchanged to the byte.
  if (tone === 50 && hue === 0 && sat === 50) return cfg;

  const deg = (hue / 100) * 360;
  const t = (tone - 50) / 50;
  const c1 = (c: number[]) => transformColor(c, deg, sat, t);
  const cN = (cs: number[][]) => cs.map(c1);

  return {
    ...cfg,
    base: c1(cfg.base),
    colors: cN(cfg.colors),
    diamondColors: cN(cfg.diamondColors),
    fleck: c1(cfg.fleck),
    smoke: c1(cfg.smoke),
    accentColors: cN(cfg.accentColors),
  };
}
