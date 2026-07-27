import { prng } from "./prng";

// ── SEED VARIATION — the seed shapes the LOOK, not just the layout ───────────
//
// Without this, a seed only reshuffles an engine's internal randomness (blob
// positions, grating angles, terrain offsets). Every composition slider stays
// put, so pressing Generate changes the arrangement but never the CHARACTER —
// same density, same scale, same weight, every time. This gives the seed a
// bounded say over a curated set of still-composition params so different seeds
// read as genuinely different looks.
//
// Design rules (these are what keep it usable, not just noisy):
//   • The user's slider is the BASE. This only adds a bounded offset on top, so
//     moving a slider always moves the result — the seed never overrides you.
//   • Amplitude is a fraction of each param's real [min,max], scaled by the
//     `seedVariation` control (0 = exactly your sliders, 100 = full swing).
//   • STILL composition only. Motion/animation params are untouched, so the
//     resolve loop and the flicker-free guarantees are unaffected.
//   • Pure function of (params, seed, amount) — no time, no Math.random(). Same
//     seed + same sliders ⇒ same image, so a seed stays copy-pasteable.
//   • Never written back to the store: it is applied inside renderTo, so every
//     surface (live canvas, format tiles, PNG, every exported video frame) sees
//     the identical values.

type ParamBag = Record<string, unknown>;

interface VaryChannel {
  key: string;
  min: number;
  max: number;
  /** Fraction of [min,max] used as the max offset at full variation. */
  frac: number;
  /** Round to a whole number (counts / columns). */
  int?: boolean;
}

// Curated per-engine channels. Ranges mirror controls-config.ts. Fractions are
// tuned so the look shifts meaningfully without wandering into broken territory
// (type stays legible, grids stay grids). Order is FIXED — the PRNG is drawn in
// this order, so inserting a channel changes what an existing seed looks like.
const CHANNELS: VaryChannel[] = [
  // shared atmosphere — a little softness/glow spread goes a long way
  { key: "soften", min: 0, max: 100, frac: 0.16 },
  { key: "glow", min: 0, max: 100, frac: 0.18 },

  // blob
  { key: "density", min: 0, max: 100, frac: 0.26 },
  { key: "smear", min: 0, max: 100, frac: 0.26 },
  { key: "blobSize", min: 0, max: 100, frac: 0.24 },
  { key: "diamondCount", min: 0, max: 4, frac: 0.3, int: true },
  { key: "diamondSize", min: 0, max: 100, frac: 0.24 },
  { key: "diamondShape", min: 0, max: 100, frac: 0.3 },
  { key: "accent", min: 0, max: 100, frac: 0.28 },
  { key: "accentCount", min: 0, max: 4, frac: 0.3, int: true },

  // grid
  { key: "gridCols", min: 3, max: 18, frac: 0.26, int: true },
  { key: "gridDensity", min: 0, max: 100, frac: 0.24 },
  { key: "gridPerspective", min: 0, max: 100, frac: 0.24 },
  { key: "gridMagnet", min: 0, max: 100, frac: 0.3 },

  // contours
  { key: "contourLines", min: 0, max: 100, frac: 0.22 },
  { key: "contourWeight", min: 0, max: 100, frac: 0.24 },
  { key: "contourScale", min: 0, max: 100, frac: 0.26 },
  { key: "contourDetail", min: 0, max: 100, frac: 0.24 },
  { key: "contourWarp", min: 0, max: 100, frac: 0.26 },
  { key: "contourRelief", min: 0, max: 100, frac: 0.24 },
  { key: "contourFill", min: 0, max: 100, frac: 0.22 },

  // signal
  { key: "signalFreq", min: 0, max: 100, frac: 0.26 },
  { key: "signalLayers", min: 0, max: 100, frac: 0.24 },
  { key: "signalSpread", min: 0, max: 100, frac: 0.28 },
  { key: "signalSharp", min: 0, max: 100, frac: 0.24 },
  { key: "signalWarp", min: 0, max: 100, frac: 0.26 },

  // TxT engines — gentler: these must stay READABLE at any seed.
  { key: "ditherSize", min: 0, max: 100, frac: 0.16 },
  { key: "ditherBreak", min: 0, max: 100, frac: 0.1 },
  { key: "ditherGap", min: 0, max: 100, frac: 0.16 },
  { key: "lineSize", min: 0, max: 100, frac: 0.16 },
  { key: "lineGap", min: 0, max: 100, frac: 0.16 },
  { key: "lineAngle", min: 0, max: 100, frac: 0.18 },
  { key: "blurAmount", min: 0, max: 100, frac: 0.1 },
  { key: "blurThreshold", min: 0, max: 100, frac: 0.1 },
];

function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}

/**
 * Returns a COPY of `params` with the curated composition channels nudged around
 * their slider values, deterministically from `seed`. Returns `params` untouched
 * when variation is 0 (so the manual look is reproducible exactly).
 */
export function applySeedVariation(params: ParamBag, seed: number): ParamBag {
  const amt = clamp(((params.seedVariation as number) ?? 0) / 100, 0, 1);
  if (amt <= 0) return params;

  // Dedicated stream so this never disturbs the engines' own seed streams.
  const r = prng(seed ^ 0x5eed1a37);
  const out: ParamBag = { ...params };

  for (const ch of CHANNELS) {
    // Draw in a FIXED order regardless of whether the key is used, so the values
    // a given seed produces never depend on which engine is active.
    const signed = r() * 2 - 1; // -1..1
    const cur = params[ch.key];
    if (typeof cur !== "number" || !Number.isFinite(cur)) continue;
    const offset = (ch.max - ch.min) * ch.frac * amt * signed;
    const next = clamp(cur + offset, ch.min, ch.max);
    out[ch.key] = ch.int ? Math.round(next) : next;
  }

  return out;
}
