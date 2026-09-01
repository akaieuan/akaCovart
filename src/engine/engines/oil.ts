import type { FieldArgs, FieldEngine, ParamDef, RNG } from "../types";
import { registerEngine } from "../registry";
import { prng } from "../prng";
import { rgba } from "../color";
import { drawBlurred } from "../blur";
import { resolveEnv } from "./txtMask";

// OIL — an oil-painted landscape that BIT-CRUSHES itself. Three stacked passes,
// ported from the "Abstract Oil-Bit Landscape Banner" study (poster-generator/
// lib/painter.ts):
//
//   1. UNDERLAY (vector) — a 3-stop sky gradient, blurred cloud masses, a stack
//      of fbm ridge silhouettes receding into aerial haze, foreground field
//      bands, and per-scene extras (coast water + glints, storm rain).
//   2. OIL — thousands of ellipse "brush strokes" that sample the underlay's own
//      colour at a jittered offset and lie along an fbm flow field, plus a woven
//      canvas-tooth texture.
//   3. BIT — the painting re-read as a quad-tree of cells, each posterised to a
//      few luminance steps: the paint dissolves into pixel data toward one edge.
//
// THE TWO HARD RULES:
//  • Deterministic — every random value comes from a seeded stream (`prng(seed ^
//    C_*)`, drawn in a FIXED order) or an integer hash. Each pass owns its OWN
//    stream, so changing (say) the cloud count can never shift the strokes. No
//    Math.random / Date.now anywhere.
//  • Flicker-free — everything time-driven is gated on `anim.anim` and moves
//    SPACE only: the camera wanders/zooms, the strokes swim along their own axis,
//    and the dissolve front pops cells in by SCALE. Colour, brightness and alpha
//    are time-independent per element, so nothing ever strobes.
//
// THE REF SAMPLING CONTRACT (why this looks the same at 156px and 3000px):
//   `REF = 396` is the tuning reference — the short side of the original study —
//   so 1 REF pixel == 1 prototype "u" unit and painter.ts's constants transcribe
//   literally. Every build paints the SAME vector underlay twice: once onto a
//   REF-scale buffer and once at the output scale. All *decisions* (stroke
//   colours, cell colours, cell survival) are read from the REF buffer, so the
//   layout and the palette of a frame are a pure function of (seed, params) and
//   never of the canvas size — only the rasterisation gets finer. The output-scale
//   copy is what is actually drawn.
//
// OVERSCAN: the underlay, the strokes and the cells all extend 6% past the frame
// so the ANIM camera transform can never expose an unpainted edge.
//
// SCOPED DETERMINISM EXCEPTION (same spirit as dither.ts's broken-pixel sparkle):
// during the resolve loop a COHERENT dissolve front sweeps along a seed-drawn
// axis and temporarily reveals extra bit cells, each popping in by SCALE. It is
// hashed from (seed, cell, level) and driven by `loopPhase`, so it is reproducible
// at any fps and on export; at `loopPhase === 0` the boost is EXACTLY zero, so the
// resolve frame is the still cell set. Cell colour + alpha never change with time.

// ── tuning reference ─────────────────────────────────────────────────────────
const REF = 396; // 1 REF px == 1 prototype u-unit
const OVERSCAN = 0.06; // painted margin outside the frame, as a fraction of the edge
const OVER = 1 + 2 * OVERSCAN;
const TAU = Math.PI * 2;

// ── PRNG streams (one per pass, so passes never shift each other) ────────────
const C_CAM = 0x4f1b8ad3; // seedHash + camera phases + sweep axis
const C_CLOUD = 0x1d7ac9e5; // cloud masses
const C_EXTRA = 0x2b93f417; // scene extras (coast glints / storm rain)
const C_STROKES = 0x7ae2c15b; // the oil pass

// ── integer-hash lanes (bit cells are hash-driven, never stream-driven, so the
// quad-tree's shape is independent of how many cells came before it) ──────────
const CH_SPLIT = 0x5101;
const CH_SURV = 0x5203;
const CH_ALPHA = 0x5307;
const CH_ACC = 0x540d;
const CH_PICK = 0x5513;
const CH_PHASE = 0x5617;

// Largest boost the dissolve front can ever add (dis ≤ 1 · E ≤ 1 · bump ≤ 1 · 0.9).
// Used to cull cells that can never be shown at ANY dissolve setting — a constant,
// so the pack stays independent of the (motion-only) oilDissolve slider.
const BOOST_MAX = 0.9;
const BAND = 0.28; // width of the dissolve front, in sweep-axis units

type SceneId = "ridgeline" | "dunes" | "coast" | "basin" | "mesa" | "storm";
type BrushId = "impasto" | "knife" | "scumble" | "stipple" | "dry";

interface SceneMod {
  /** Horizon TARGET (fraction of the edge where land begins), blended half and
   *  half with the slider — the scene composes the frame, the slider still steers. */
  hz: number;
  ampMul: number;
  spread: number;
  layersMul: number;
  bandsMul: number;
  hazeMul: number;
  cloudMul: number;
  top: number;
}

/** Scenes are STRUCTURAL: they move the horizon, layer count, amplitude, haze and
 *  band count as multipliers over the sliders, so switching scene recomposes the
 *  picture rather than reshuffling the same noise. (Verbatim from painter.ts.) */
const SCENE_MODS: Record<SceneId, SceneMod> = {
  ridgeline: { hz: 0.62, ampMul: 1, spread: 0.3, layersMul: 1, bandsMul: 1, hazeMul: 1, cloudMul: 1, top: -0.2 },
  dunes: { hz: 0.4, ampMul: 0.55, spread: 0.55, layersMul: 0.5, bandsMul: 1.4, hazeMul: 0.45, cloudMul: 0.35, top: -0.06 },
  coast: { hz: 0.52, ampMul: 0.45, spread: 0.06, layersMul: 0.35, bandsMul: 0, hazeMul: 1.8, cloudMul: 1.6, top: -0.16 },
  basin: { hz: 0.46, ampMul: 2.4, spread: 0.16, layersMul: 0.8, bandsMul: 0.4, hazeMul: 0.7, cloudMul: 0.6, top: -0.34 },
  mesa: { hz: 0.56, ampMul: 1.15, spread: 0.34, layersMul: 1, bandsMul: 0.8, hazeMul: 0.12, cloudMul: 0.6, top: -0.24 },
  storm: { hz: 0.72, ampMul: 0.7, spread: 0.14, layersMul: 0.6, bandsMul: 0.6, hazeMul: 1.4, cloudMul: 3.2, top: -0.1 },
};

const SCENE_IDS: SceneId[] = ["ridgeline", "dunes", "coast", "basin", "mesa", "storm"];
const BRUSH_IDS: BrushId[] = ["impasto", "knife", "scumble", "stipple", "dry"];

// ── small helpers ────────────────────────────────────────────────────────────
function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}
function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}
function fade(t: number): number {
  return t * t * t * (t * (t * 6 - 15) + 10);
}
function mix(a: number[], b: number[], t: number): number[] {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
}
/** Relative luminance in [0,1] — the ONLY ordering used for the palette ramps. */
function lum(c: number[]): number {
  return (0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2]) / 255;
}

// Reused colour triple for the hot draw loops (no per-stroke / per-cell alloc).
const tmpCol = [0, 0, 0];

// ── noise (contours-style integer hash; NO Math.sin hashing anywhere) ────────
interface Noise {
  hash3(x: number, y: number, z: number): number;
  vnoise(x: number, y: number, z: number): number;
  /** painter.ts's fbm EXACTLY (amp 0.5, halving, un-normalised) so its tuning
   *  constants transcribe literally; `z` is a seed LANE, kept on integers so each
   *  lane is an independent 2D slice of the 3D value noise. */
  fbm(x: number, y: number, z: number, oct: number): number;
}

function makeNoise(seedHash: number): Noise {
  const hash3 = (x: number, y: number, z: number): number => {
    let h = (Math.imul(x, 374761393) + Math.imul(y, 668265263) + Math.imul(z, 2147483647) + seedHash) | 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    h = Math.imul(h ^ (h >>> 16), 0x85ebca6b);
    return ((h ^ (h >>> 15)) >>> 0) / 4294967296;
  };
  const vnoise = (x: number, y: number, z: number): number => {
    const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z);
    const xf = x - xi, yf = y - yi, zf = z - zi;
    const u = fade(xf), v = fade(yf), w = fade(zf);
    const c000 = hash3(xi, yi, zi), c100 = hash3(xi + 1, yi, zi);
    const c010 = hash3(xi, yi + 1, zi), c110 = hash3(xi + 1, yi + 1, zi);
    const c001 = hash3(xi, yi, zi + 1), c101 = hash3(xi + 1, yi, zi + 1);
    const c011 = hash3(xi, yi + 1, zi + 1), c111 = hash3(xi + 1, yi + 1, zi + 1);
    return lerp(
      lerp(lerp(c000, c100, u), lerp(c010, c110, u), v),
      lerp(lerp(c001, c101, u), lerp(c011, c111, u), v),
      w,
    );
  };
  const fbm = (x: number, y: number, z: number, oct: number): number => {
    let v = 0, amp = 0.5, f = 1;
    // 7 / 1013 are coprime-ish primes so no (lane, octave) pair ever collides.
    for (let i = 0; i < oct; i++) {
      v += amp * vnoise(x * f, y * f, z * 7 + i * 1013);
      amp *= 0.5;
      f *= 2;
    }
    return v;
  };
  return { hash3, vnoise, fbm };
}

// ── palette ramps ────────────────────────────────────────────────────────────
// cfg arrives with every Color transform already applied (render.ts), so the
// engine NEVER touches hue/sat/light — it only orders what it is given.
interface Pal {
  base: number[];
  colors: number[][];
  accentColors: number[][];
}
interface Ramps {
  sky: number[][]; // 3 stops, top -> horizon
  ridge: number[][]; // 6 stops, index 0 = FAR (nearest the sky), 5 = NEAR
  band: number[][]; // foreground field bands
  accent: number[][]; // bit-cell punctuation
}

function deriveRamps(pal: Pal, scene: SceneId): Ramps {
  const src = pal.colors && pal.colors.length ? pal.colors : [pal.base];
  const sorted = src.map((c) => c.slice()).sort((a, b) => lum(a) - lum(b)); // dark -> light
  // Drop swatches that sit ON the base's luminance: some palettes repeat the base
  // inside `colors`, which would make the far ridge (and the sky gradient built
  // from it) collapse to a flat fill.
  let pool = sorted.filter((c) => Math.abs(lum(c) - lum(pal.base)) > 0.05);
  if (pool.length < 3) pool = sorted;

  // AERIAL PERSPECTIVE: index 0 is the FAR ridge and must be the end of the ramp
  // adjacent to the sky in luminance, so distance reads as "fades into the air"
  // on light and dark palettes alike.
  const light = lum(pal.base) > 0.5;
  const ridge: number[][] = [];
  for (let i = 0; i < 6; i++) {
    const t = i / 5;
    const k = light ? 1 - t : t;
    ridge.push(pool[Math.min(pool.length - 1, Math.round(k * (pool.length - 1)))].slice());
  }

  // Sky = the base walked toward the far-ridge colour, so the horizon cools/warms
  // into the land instead of banding against it.
  const skyEnd = ridge[0];
  let sky = [mix(pal.base, skyEnd, 0), mix(pal.base, skyEnd, 0.35), mix(pal.base, skyEnd, 0.7)];
  // Storm pre-mixes the whole sky toward the NEAR ridge — heavy weather overhead.
  if (scene === "storm") sky = sky.map((s) => mix(s, ridge[5], 0.42));

  // Field bands come from the mid-luminance body of the palette (the ramp ends are
  // already spoken for by sky + near ridge), cycled.
  const lo = Math.floor(pool.length * 0.25);
  const hi = Math.max(lo + 1, Math.ceil(pool.length * 0.75));
  const band = pool.slice(lo, hi).map((c) => c.slice());

  const accent =
    pal.accentColors && pal.accentColors.length ? pal.accentColors.map((c) => c.slice()) : pool.map((c) => c.slice());

  return { sky, ridge, band, accent };
}

// ── build spec (everything the cached build consumes) ────────────────────────
interface BuildSpec {
  scene: SceneId;
  brush: BrushId;
  horizon: number;
  nRidges: number;
  nBands: number;
  ampMul: number;
  rough: number;
  haze: number;
  clouds: number;
  depthContrast: number;
  strokeLen: number;
  baseAlpha: number;
  nStrokes: number;
  tooth: number;
  bakeStrokes: boolean;
  cellU: number;
  steps: number;
  split: number;
  bit: number;
  sweep: number;
  accent: number;
  sx: number;
  sy: number;
  ramps: Ramps;
}

// ── module singletons (one engine instance; every field() call is synchronous
// and self-contained, so these can never race — same pattern as signal.ts) ────
let rCanvas: HTMLCanvasElement | null = null; // REF-scale build buffer (read back)
let sCanvas: HTMLCanvasElement | null = null; // underlay at output scale (drawn)
let xCanvas: HTMLCanvasElement | null = null; // scratch for the drawBlurred layers

interface OilCache {
  key: string;
  underlayS: HTMLCanvasElement;
  underlayImg: ImageData; // REF, vector only — what the strokes sample
  compositeImg: ImageData; // REF, underlay + strokes + tooth — what the cells read
  strokePack: Float32Array;
  strokeCount: number;
  cellRect: Float32Array;
  cellRGB: Uint8Array;
  cellAlpha: Float32Array;
  cellSurv: Float32Array;
  cellProb: Float32Array;
  cellSweep: Float32Array;
  cellCount: number;
  ramps: Ramps;
  margin: number; // output-scale overscan margin, in px
  bakedStrokes: boolean;
}
let cache: OilCache | null = null;

const STRIDE = 10; // x, y, ang, len, thick, alpha, r, g, b, phaseHash

function ctxOf(c: HTMLCanvasElement, willRead: boolean): CanvasRenderingContext2D | null {
  return c.getContext("2d", willRead ? { willReadFrequently: true } : undefined);
}
function ensureCanvas(which: 0 | 1 | 2, side: number): HTMLCanvasElement {
  let c = which === 0 ? rCanvas : which === 1 ? sCanvas : xCanvas;
  if (!c) {
    c = document.createElement("canvas");
    if (which === 0) rCanvas = c;
    else if (which === 1) sCanvas = c;
    else xCanvas = c;
  }
  if (c.width !== side || c.height !== side) {
    c.width = side;
    c.height = side;
  }
  return c;
}

// ── pass 1: the vector underlay ──────────────────────────────────────────────
// Painted TWICE per build with identical geometry (only `edge` differs), so the
// REF buffer the decisions are read from is a scaled twin of what is displayed.
// `margin` is the overscan, in this buffer's pixels; the frame occupies
// [margin, margin + edge].
function paintUnderlayVector(
  ctx: CanvasRenderingContext2D,
  edge: number,
  margin: number,
  spec: BuildSpec,
  noise: Noise,
  seed: number,
): void {
  const N = edge + 2 * margin;
  const M = margin;
  const u = edge / REF; // one prototype u-unit, in this buffer's px
  const scene = spec.scene;
  const mod = SCENE_MODS[scene];
  const horizon = spec.horizon;
  // Everything below the horizon has to fit in the space that is actually left.
  const span = clamp(1 - horizon, 0.08, 1) * 1.6;
  const sky = spec.ramps.sky;
  const ridgeRamp = spec.ramps.ridge;
  const dark = ridgeRamp[5];

  const ident = (): void => ctx.setTransform(1, 0, 0, 1, 0, 0);
  const frame = (): void => ctx.setTransform(1, 0, 0, 1, M, M);
  // A blurred layer is drawn into the scratch buffer and composited ONCE through
  // drawBlurred — ctx.filter is unreliable on WebKit, so blur.ts owns every blur.
  const scratch = ensureCanvas(2, N);
  const beginLayer = (): CanvasRenderingContext2D | null => {
    const sc = ctxOf(scratch, false);
    if (!sc) return null;
    sc.setTransform(1, 0, 0, 1, 0, 0);
    sc.clearRect(0, 0, N, N);
    sc.setTransform(1, 0, 0, 1, M, M);
    return sc;
  };
  const endLayer = (radius: number): void => {
    ident();
    drawBlurred(ctx, scratch, N, radius);
  };

  ident();
  ctx.clearRect(0, 0, N, N);

  // ──────────────────────────────────────────────────────────────────── sky
  frame();
  const grad = ctx.createLinearGradient(0, 0, 0, edge * (horizon + 0.06));
  grad.addColorStop(0, rgba(sky[0], 1));
  grad.addColorStop(0.55, rgba(sky[1], 1));
  grad.addColorStop(1, rgba(sky[2], 1));
  ctx.fillStyle = grad;
  ctx.fillRect(-M, -M, N, N);
  ident();

  // ───────────────────────────────────────────────────────────────── clouds
  // ALL cloud masses go into ONE scratch layer and get ONE blur composite (the
  // prototype blurred each ellipse separately, which is the same look for a
  // fraction of the cost).
  if (spec.clouds > 0) {
    const rc: RNG = prng(seed ^ C_CLOUD);
    const sc = beginLayer();
    if (sc) {
      for (let i = 0; i < spec.clouds; i++) {
        // NB: && short-circuits, so the "heavy" draw only happens on storm —
        // replicated exactly, since both scale passes must consume the same stream.
        const heavy = scene === "storm" && rc() < 0.55;
        sc.fillStyle = heavy
          ? rgba(mix(sky[1], dark, 0.55 + rc() * 0.45), 0.22 + rc() * 0.34)
          : rgba(mix(sky[0], sky[2], rc()), 0.08 + rc() * 0.16);
        sc.beginPath();
        sc.ellipse(
          // spread across the OVERSCANNED frame so the camera never pans onto a
          // cloudless margin (the prototype only had to cover the frame itself)
          (rc() * OVER - OVERSCAN) * edge,
          rc() * edge * horizon * (scene === "storm" ? 1.1 : 0.95),
          (0.08 + rc() * (heavy ? 0.42 : 0.28)) * edge,
          (24 + rc() * (heavy ? 150 : 90)) * u,
          (rc() - 0.5) * 0.25,
          0,
          TAU,
        );
        sc.fill();
      }
      endLayer((scene === "storm" ? 34 : 24) * u);
    }
  }

  // ───────────────────────────────────────────────────────────────── ridges
  const stepX = Math.max(1, (scene === "mesa" ? 3 : 5) * u);
  const x0 = -M - stepX;
  const x1 = edge + M + stepX;
  const floorY = edge + M;
  for (let i = 0; i < spec.nRidges; i++) {
    const depth = spec.nRidges === 1 ? 0 : i / (spec.nRidges - 1); // 0 far .. 1 near
    const swatch = ridgeRamp[Math.min(ridgeRamp.length - 1, Math.round(depth * (ridgeRamp.length - 1)))];
    // Aerial perspective: far ridges are mostly SKY, near ridges are mostly pigment.
    const shaded = mix(sky[2], swatch, clamp(0.35 + depth * 0.65 * spec.depthContrast, 0.1, 1));
    const baseY = edge * (horizon + (mod.top + depth * mod.spread) * span);
    const amp = edge * (0.162 - depth * 0.081) * spec.ampMul * clamp(0.55 + span * 0.5, 0.5, 1.15);
    const sc = beginLayer();
    if (!sc) break;
    sc.fillStyle = rgba(shaded, 0.94 - depth * 0.05);
    sc.beginPath();
    sc.moveTo(x0, floorY);
    for (let x = x0; x <= x1; x += stepX) {
      sc.lineTo(x, baseY - amp * ridgeProfile(scene, x / edge, i, depth, spec.rough, noise));
    }
    sc.lineTo(x1, floorY);
    sc.closePath();
    sc.fill();
    endLayer(clamp((6.5 - depth * 6) * spec.haze, 0, 24) * u);
  }

  // ──────────────────────────────────────────────────────── foreground bands
  const bandRamp = spec.ramps.band;
  for (let i = 0; i < spec.nBands; i++) {
    const t = spec.nBands === 1 ? 0 : i / (spec.nBands - 1);
    const col = bandRamp[i % bandRamp.length];
    const baseY = edge * (horizon + (0.1 + t * 0.34) * span);
    const sc = beginLayer();
    if (!sc) break;
    sc.fillStyle = rgba(col, 0.92);
    sc.beginPath();
    sc.moveTo(x0, floorY);
    for (let x = x0; x <= x1; x += stepX) {
      const freqB = scene === "dunes" ? 0.9 + i * 0.4 : 2.2 + i;
      const n = noise.fbm((x / edge) * freqB * spec.rough + i * 5.5, 40 + i * 3, 100 + i * 13, 4);
      sc.lineTo(
        x,
        baseY -
          (n - 0.5) *
            edge *
            (scene === "dunes" ? 0.26 : 0.146) *
            (1 - t * 0.5) *
            spec.ampMul *
            clamp(0.4 + span * 0.5, 0.4, 1.1),
      );
    }
    sc.lineTo(x1, floorY);
    sc.closePath();
    sc.fill();
    endLayer(clamp((4.5 - t * 3.6) * spec.haze, 0, 18) * u);
  }

  // ──────────────────────────────────────────────────────────── scene extras
  if (scene === "coast" || scene === "storm") {
    const re: RNG = prng(seed ^ C_EXTRA);
    frame();
    if (scene === "coast") {
      const waterTop = edge * (horizon + 0.02);
      const water = mix(sky[2], ridgeRamp[2], 0.55);
      ctx.fillStyle = rgba(water, 0.96);
      ctx.fillRect(-M, waterTop, N, floorY - waterTop);
      // Streak glints on the water — the branch consumes a variable number of
      // draws, which is fine: both scale passes walk the identical stream.
      for (let i = 0; i < 260; i++) {
        const y = waterTop + Math.pow(re(), 0.7) * (floorY - waterTop);
        const len = (0.04 + re() * 0.3) * edge;
        const tone = re() < 0.5 ? mix(water, sky[0], 0.35 + re() * 0.4) : mix(water, dark, 0.3);
        ctx.fillStyle = rgba(tone, 0.1 + re() * 0.3);
        ctx.fillRect((re() * OVER - OVERSCAN) * edge - len / 2, y, len, (0.6 + re() * 2.6) * u);
      }
    } else {
      const rain = mix(sky[0], sky[2], 0.4);
      for (let i = 0; i < 900; i++) {
        ctx.save();
        ctx.translate(re() * edge * 1.2 - edge * 0.1, (re() * OVER - OVERSCAN) * edge);
        ctx.rotate(0.22 + (re() - 0.5) * 0.08);
        ctx.fillStyle = rgba(rain, 0.04 + re() * 0.09);
        ctx.fillRect(0, 0, (0.5 + re() * 1.1) * u, (18 + re() * 90) * u);
        ctx.restore();
      }
    }
    ident();
  }

  ident();
}

/** Ridge silhouette height at `t` across the frame — one branch per scene, ported
 *  verbatim from painter.ts (mesa's quantized plateaus, basin's parabolic walls). */
function ridgeProfile(
  scene: SceneId,
  t: number,
  i: number,
  depth: number,
  rough: number,
  noise: Noise,
): number {
  switch (scene) {
    case "dunes": {
      const a = noise.fbm(t * 1.1 * rough + i * 4.7, 12 + i * 2.3, 31 * i, 3);
      const b = noise.fbm(t * 2.6 * rough + i * 9.1, 30 + i * 5.1, 47 * i, 2);
      return (a - 0.5) * 1.5 + (b - 0.5) * 0.35 + 0.35;
    }
    case "coast":
      return noise.fbm(t * (0.8 + depth) * rough * 2 + i * 3.3, i * 9.1, 31 * i, 3) * 0.45 - 0.1;
    case "storm":
      return noise.fbm(t * (1.4 + depth) * rough * 3 + i * 6.2, i * 7.4, 31 * i, 4) * 0.55 - 0.15;
    case "basin": {
      const n = noise.fbm(t * (1.2 + depth * 1.4) * rough * 3 + i * 3.3, i * 9.1, 31 * i, 4);
      const walls = Math.pow(Math.abs(t - 0.5) * 2, 2.2) * 3.4 * (1.3 - depth * 0.7);
      return n * 0.55 - 0.15 + walls;
    }
    case "mesa": {
      const cells = 5 + Math.round(depth * 4);
      const step = Math.floor(t * cells * rough) / cells;
      const plateau = noise.hash3(Math.floor(t * cells * rough), i * 13, 7);
      const edge = noise.fbm(t * 26 * rough, i * 3.1, 19 * i, 2) * 0.12;
      return 0.25 + plateau * 1.5 + step * 0.25 + edge;
    }
    default: {
      const n = noise.fbm(t * (1.1 + depth * 1.9) * rough * 4 + i * 3.3, i * 9.1, 31 * i, 5);
      const ridged =
        1 - Math.abs(noise.fbm(t * (2.2 + depth * 2) * rough * 3 + i * 5.5, i * 4.4, 71 * i, 4) * 2 - 1);
      const peak = Math.pow(Math.max(0, Math.sin(t * (1.6 + i * 0.7) * Math.PI + i * 2.1)), 3);
      return n * 1.2 - 0.35 + ridged * 0.8 + peak * (1.9 - depth) * 1.15;
    }
  }
}

// ── pass 2: the oil strokes ──────────────────────────────────────────────────
// Every value is packed in u-units / normalised frame coords, so ONE pack serves
// the REF bake, the output-scale bake and the per-frame live draw.
function buildStrokePack(
  spec: BuildSpec,
  noise: Noise,
  under: ImageData,
  refMargin: number,
  seed: number,
): Float32Array {
  const n = spec.nStrokes;
  const pack = new Float32Array(n * STRIDE);
  if (n <= 0) return pack;
  const r: RNG = prng(seed ^ C_STROKES);
  const d = under.data;
  const W = under.width;
  const H = under.height;
  const horizon = spec.horizon;
  const brush = spec.brush;

  for (let i = 0; i < n; i++) {
    // normalised frame coords, spread across the overscan
    const nx = r() * OVER - OVERSCAN;
    const ny = r() * OVER - OVERSCAN;
    // REF pixel of this stroke, and the jittered pixel its colour is lifted from
    const px = refMargin + nx * REF;
    const py = refMargin + ny * REF;
    const sxp = clamp((px + (r() - 0.5) * 16) | 0, 0, W - 1);
    const syp = clamp((py + (r() - 0.5) * 11) | 0, 0, H - 1);
    const k = (syp * W + sxp) * 4;
    // painter.ts's fixed ±24 RGB drift + a 12% warm bias — pigment never mixes
    // perfectly, and the warm flecks are what stop the field reading as a gradient.
    const jit = (r() - 0.5) * 24;
    const warm = r() < 0.12 ? 1 : 0;
    const cr = clamp(d[k] + jit + warm * 10, 0, 255);
    const cg = clamp(d[k + 1] + jit + warm * 4, 0, 255);
    const cb = clamp(d[k + 2] + jit - warm * 8, 0, 255);

    // flow field — strokes lie along the landscape, tipping at the horizon
    const flow =
      (noise.fbm((px - refMargin) / 140, (py - refMargin) / 90, 5, 3) - 0.5) * 1.1 + (ny > horizon ? 0.05 : -0.02);
    const gate = brush === "dry" ? noise.fbm((px - refMargin) / 60, (py - refMargin) / 34, 91, 3) : 1;
    // Drawn BEFORE the brush branch — painter.ts evaluates this as an argument, so
    // it precedes strokeShape's own draws in the stream.
    const baseAlpha = spec.baseAlpha * (0.6 + r() * 0.8);

    let ang = flow;
    let len: number;
    let thick: number;
    let alpha = baseAlpha;
    let skip = false;
    switch (brush) {
      case "knife":
        ang = flow * 0.35;
        len = (18 + r() * 44) * spec.strokeLen;
        thick = 0.8 + r() * 1.5;
        alpha = baseAlpha * 1.35;
        break;
      case "scumble":
        ang = flow + (r() < 0.5 ? 0.72 : -0.72);
        len = (4 + r() * 11) * spec.strokeLen;
        thick = 1.5 + r() * 2.2;
        break;
      case "stipple":
        ang = 0;
        len = (1.2 + r() * 3.6) * spec.strokeLen;
        thick = len * (0.7 + r() * 0.5);
        alpha = baseAlpha * 1.2;
        break;
      case "dry":
        ang = flow * 0.8;
        len = (12 + r() * 40) * spec.strokeLen;
        thick = 0.7 + r() * 1.3;
        alpha = baseAlpha * (0.85 + gate);
        // The dry brush breaks up — but the skip is decided AFTER the draws, so
        // every stroke consumes the SAME number of stream values and the pack
        // stays a pure function of (seed, brush, count).
        skip = gate < 0.46;
        break;
      default:
        len = (6 + r() * 24) * spec.strokeLen;
        thick = 1.3 + r() * 3.2;
        break;
    }

    const o = i * STRIDE;
    pack[o] = nx;
    pack[o + 1] = ny;
    pack[o + 2] = ang;
    pack[o + 3] = skip ? 0 : len;
    pack[o + 4] = skip ? 0 : thick;
    pack[o + 5] = clamp(alpha, 0, 1);
    pack[o + 6] = Math.round(cr);
    pack[o + 7] = Math.round(cg);
    pack[o + 8] = Math.round(cb);
    pack[o + 9] = noise.hash3(i, 7, CH_PHASE); // fixed per-stroke motion phase
  }
  return pack;
}

/** Draw the pack into `ctx`. `flowAmt > 0` adds the ANIM-gated swim (space only:
 *  a tilt about the stroke's own axis plus a slide along it — never a colour or
 *  alpha change, so a moving stroke can never strobe). */
function drawStrokes(
  ctx: CanvasRenderingContext2D,
  edge: number,
  margin: number,
  pack: Float32Array,
  count: number,
  flowAmt: number,
  T: number,
): void {
  const u = edge / REF;
  for (let i = 0; i < count; i++) {
    const o = i * STRIDE;
    const len = pack[o + 3];
    if (len <= 0) continue; // dry-brush skip
    let ang = pack[o + 2];
    let cx = margin + pack[o] * edge;
    let cy = margin + pack[o + 1] * edge;
    if (flowAmt > 0) {
      const h = pack[o + 9];
      ang += flowAmt * 0.3 * Math.sin(T * (0.3 + 0.5 * h) + h * TAU);
      const slide = flowAmt * 2.2 * u * Math.sin(T * (0.21 + 0.37 * h) + h * Math.PI);
      cx += Math.cos(ang) * slide;
      cy += Math.sin(ang) * slide;
    }
    tmpCol[0] = pack[o + 6];
    tmpCol[1] = pack[o + 7];
    tmpCol[2] = pack[o + 8];
    ctx.fillStyle = rgba(tmpCol, pack[o + 5]);
    ctx.beginPath();
    // Floor the radii so strokes stay visible when the field renders SMALL (the
    // gallery thumbnails), exactly as contours floors its line weight.
    ctx.ellipse(cx, cy, Math.max(0.35, len * u), Math.max(0.2, pack[o + 4] * u), ang, 0, TAU);
    ctx.fill();
  }
}

/** Woven canvas tooth — painter.ts's per-pixel weave, in place. Deliberately a
 *  SCREEN-space texture (like film grain): it is the surface the paint sits on,
 *  not part of the composition, so it does not scale with the frame. */
function toothInPlace(data: Uint8ClampedArray, W: number, H: number, amt: number): void {
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const k = (y * W + x) * 4;
      const n = (((x * 7 + y * 13 + ((x * y) % 31)) % 17) - 8) * 0.42;
      const weave = (x % 3 === 0 ? 3 : 0) + (y % 4 === 0 ? -3 : 0);
      const dv = (n + weave * 0.5) * amt;
      data[k] = clamp(data[k] + dv, 0, 255);
      data[k + 1] = clamp(data[k + 1] + dv, 0, 255);
      data[k + 2] = clamp(data[k + 2] + dv, 0, 255);
    }
  }
}

// ── pass 3: the bit cells ────────────────────────────────────────────────────
interface CellPack {
  rect: Float32Array;
  rgbv: Uint8Array;
  alpha: Float32Array;
  surv: Float32Array;
  prob: Float32Array;
  sweep: Float32Array;
  count: number;
}

function buildCellPack(spec: BuildSpec, noise: Noise, img: ImageData, refMargin: number): CellPack {
  const rect: number[] = [];
  const rgbv: number[] = [];
  const alpha: number[] = [];
  const surv: number[] = [];
  const prob: number[] = [];
  const sweep: number[] = [];
  if (spec.bit <= 0) {
    return {
      rect: new Float32Array(0),
      rgbv: new Uint8Array(0),
      alpha: new Float32Array(0),
      surv: new Float32Array(0),
      prob: new Float32Array(0),
      sweep: new Float32Array(0),
      count: 0,
    };
  }

  const d = img.data;
  const W = img.width;
  const H = img.height;
  const cellPx = Math.max(2, Math.round(spec.cellU));
  const minChild = Math.max(cellPx / 4, 2);
  const quantStep = 255 / spec.steps;
  const stride = 2;
  const accents = spec.ramps.accent;
  const bitP = spec.bit * 1.4;
  const sweepP = spec.sweep * 3;
  const accP = spec.accent * 0.12;
  const sx = spec.sx;
  const sy = spec.sy;

  /** Integer coordinates only — a fractional index into imageData reads undefined,
   *  which poisons the average with NaN and leaves the context reusing a stale
   *  fillStyle (the prototype's "green confetti" bug). */
  const averageCell = (ax: number, ay: number, sz: number): number[] | null => {
    let r = 0, g = 0, b = 0, n = 0;
    const yEnd = Math.min(H, ay + sz);
    const xEnd = Math.min(W, ax + sz);
    for (let y = Math.max(0, ay); y < yEnd; y += stride) {
      for (let x = Math.max(0, ax); x < xEnd; x += stride) {
        const k = (y * W + x) * 4;
        r += d[k];
        g += d[k + 1];
        b += d[k + 2];
        n++;
      }
    }
    return n ? [r / n, g / n, b / n] : null;
  };

  // The quad-tree's SHAPE is decided by the split hash alone (never by survival),
  // so the cell geometry is static and the dissolve front only ever toggles
  // VISIBILITY — cells can never re-shape mid-loop.
  const walk = (ax: number, ay: number, sz: number, level: number): void => {
    const half = sz >> 1;
    if (sz >= 8 && half >= minChild && noise.hash3(ax, ay, CH_SPLIT + level) < spec.split) {
      walk(ax, ay, half, level + 1);
      walk(ax + half, ay, half, level + 1);
      walk(ax, ay + half, half, level + 1);
      walk(ax + half, ay + half, half, level + 1);
      return;
    }
    // centre in normalised FRAME coords (outside 0..1 in the overscan)
    const cx = (ax + sz / 2 - refMargin) / REF;
    const cy = (ay + sz / 2 - refMargin) / REF;
    // rotated sweep coordinate, remapped to 0..1
    const t = clamp((cx - 0.5) * sx + (cy - 0.5) * sy + 0.5, 0, 1);
    let p = bitP * (0.1 + Math.pow(t, 1.7) * sweepP + Math.pow(Math.max(0, 1 - cy), 1.6) * 0.45);
    p *= 0.35 + noise.fbm(cx * 5, cy * 5, 77, 3) * 1.5;
    const s = noise.hash3(ax, ay, CH_SURV + level);
    if (s >= p + BOOST_MAX) return; // can never be shown at ANY dissolve setting

    const avg = averageCell(ax, ay, sz);
    if (!avg) return;
    // Quantise LUMINANCE, not channels — per-channel rounding throws chroma
    // speckle (green/white confetti) into near-neutral skies.
    const l = 0.299 * avg[0] + 0.587 * avg[1] + 0.114 * avg[2];
    const ql = clamp(Math.round(l / quantStep) * quantStep, 8, 248);
    const kk = l > 1 ? ql / l : 1;
    let cr = clamp(avg[0] * kk, 0, 255);
    let cg = clamp(avg[1] * kk, 0, 255);
    let cb = clamp(avg[2] * kk, 0, 255);
    if (accents.length && noise.hash3(ax, ay, CH_ACC + level) < accP) {
      // Punctuation, not confetti: tint the hue, keep the cell's own brightness.
      const a = accents[(noise.hash3(ax, ay, CH_PICK + level) * accents.length) | 0];
      const tr = cr + (a[0] - cr) * 0.4;
      const tg = cg + (a[1] - cg) * 0.4;
      const tb = cb + (a[2] - cb) * 0.4;
      const tl = 0.299 * tr + 0.587 * tg + 0.114 * tb;
      const k2 = tl > 1 ? ql / tl : 1;
      cr = clamp(tr * k2, 0, 255);
      cg = clamp(tg * k2, 0, 255);
      cb = clamp(tb * k2, 0, 255);
    }

    rect.push((ax - refMargin) / REF, (ay - refMargin) / REF, sz / REF, sz / REF);
    rgbv.push(Math.round(cr), Math.round(cg), Math.round(cb));
    alpha.push(0.7 + 0.3 * noise.hash3(ax, ay, CH_ALPHA + level));
    surv.push(s);
    prob.push(p);
    sweep.push(t);
  };

  for (let y = 0; y < H; y += cellPx) {
    for (let x = 0; x < W; x += cellPx) walk(x, y, cellPx, 0);
  }

  return {
    rect: Float32Array.from(rect),
    rgbv: Uint8Array.from(rgbv),
    alpha: Float32Array.from(alpha),
    surv: Float32Array.from(surv),
    prob: Float32Array.from(prob),
    sweep: Float32Array.from(sweep),
    count: alpha.length,
  };
}

// ── the cached build ─────────────────────────────────────────────────────────
// A PURE memo: the key names every input the build reads, and the build reads
// nothing else — so the frame is byte-identical with or without a cache hit.
function ensureCache(spec: BuildSpec, noise: Noise, seed: number, S: number, key: string): OilCache | null {
  if (cache && cache.key === key) return cache;
  // Drop the old entry BEFORE the buffers it points at get resized/repainted, so a
  // failed build can never leave a live key pointing at half-painted pixels.
  cache = null;

  const refMargin = Math.round(OVERSCAN * REF); // 24
  const RS = REF + 2 * refMargin; // 444
  const margin = Math.round(OVERSCAN * S);
  const So = S + 2 * margin;

  const rc = ensureCanvas(0, RS);
  const rctx = ctxOf(rc, true); // read back twice per build
  const sc = ensureCanvas(1, So);
  const sctx = ctxOf(sc, false);
  if (!rctx || !sctx) return null;

  // 1. REF underlay -> the raster the strokes lift their colour from.
  paintUnderlayVector(rctx, REF, refMargin, spec, noise, seed);
  const underlayImg = rctx.getImageData(0, 0, RS, RS);

  // 2. strokes, then the REF composite the cells read (underlay + paint + tooth).
  const strokePack = buildStrokePack(spec, noise, underlayImg, refMargin, seed);
  drawStrokes(rctx, REF, refMargin, strokePack, spec.nStrokes, 0, 0);
  const compositeImg = rctx.getImageData(0, 0, RS, RS);
  if (spec.tooth > 0) toothInPlace(compositeImg.data, RS, RS, spec.tooth);
  // (no putImageData — the REF buffer is only ever sampled, never displayed)

  // 3. the same underlay at output scale. Strokes are baked in ONLY when they are
  //    not going to be redrawn per frame; `bakeStrokes` is part of the key, so the
  //    two modes are separate builds and each is internally consistent.
  paintUnderlayVector(sctx, S, margin, spec, noise, seed);
  if (spec.bakeStrokes) drawStrokes(sctx, S, margin, strokePack, spec.nStrokes, 0, 0);
  if (spec.tooth > 0) {
    const img = sctx.getImageData(0, 0, So, So);
    toothInPlace(img.data, So, So, spec.tooth);
    sctx.putImageData(img, 0, 0);
  }

  // 4. the bit cells, read off the REF composite.
  const cells = buildCellPack(spec, noise, compositeImg, refMargin);

  cache = {
    key,
    underlayS: sc,
    underlayImg,
    compositeImg,
    strokePack,
    strokeCount: spec.nStrokes,
    cellRect: cells.rect,
    cellRGB: cells.rgbv,
    cellAlpha: cells.alpha,
    cellSurv: cells.surv,
    cellProb: cells.prob,
    cellSweep: cells.sweep,
    cellCount: cells.count,
    ramps: spec.ramps,
    margin,
    bakedStrokes: spec.bakeStrokes,
  };
  return cache;
}

// ─────────────────────────────────────────────────────────────────────────────

const oil: FieldEngine = {
  id: "oil",
  label: "Oil",
  kind: "2d",
  focus: "oil",
  params: oilParams(),
  field(args: FieldArgs): void {
    const { ctx, size: S, params: p, cfg, seed, anim } = args;
    if (!(S > 0)) return;

    // ── (1) DETERMINISTIC — seed stream up front, stable order ────────────────
    const r: RNG = prng(seed ^ C_CAM);
    const seedHash = (Math.floor(r() * 0xffffffff) ^ (seed * 0x9e3779b1)) | 0;
    const camx = r() * TAU;
    const camy = r() * TAU;
    // Dissolve axis: ±35° around horizontal, so the sweep always reads as a
    // left-to-right wipe rather than an arbitrary diagonal.
    const sweepAng = (r() - 0.5) * ((70 * Math.PI) / 180);
    const sx = Math.cos(sweepAng);
    const sy = Math.sin(sweepAng);
    const noise = makeNoise(seedHash);

    // ── (2) Shaping params ────────────────────────────────────────────────────
    const sceneRaw = typeof p.oilScene === "string" ? p.oilScene : "ridgeline";
    const scene: SceneId = (SCENE_IDS.indexOf(sceneRaw as SceneId) >= 0 ? sceneRaw : "ridgeline") as SceneId;
    const brushRaw = typeof p.oilBrush === "string" ? p.oilBrush : "impasto";
    const brush: BrushId = (BRUSH_IDS.indexOf(brushRaw as BrushId) >= 0 ? brushRaw : "impasto") as BrushId;
    const mod = SCENE_MODS[scene];

    const horizonP = (p.oilHorizon == null ? 63 : p.oilHorizon) / 100;
    const ridgesP = (p.oilRidges == null ? 83 : p.oilRidges) / 100;
    const peaksP = (p.oilPeaks == null ? 35 : p.oilPeaks) / 100;
    const roughP = (p.oilRough == null ? 23 : p.oilRough) / 100;
    const skyP = (p.oilSky == null ? 40 : p.oilSky) / 100;
    const paintP = (p.oilPaint == null ? 45 : p.oilPaint) / 100;
    const strokeP = (p.oilStroke == null ? 26 : p.oilStroke) / 100;
    const opacityP = (p.oilOpacity == null ? 35 : p.oilOpacity) / 100;
    const toothP = (p.oilTooth == null ? 50 : p.oilTooth) / 100;
    const bitP = (p.oilBit == null ? 43 : p.oilBit) / 100;
    const cellP = (p.oilCell == null ? 27 : p.oilCell) / 100;
    const stepsP = (p.oilSteps == null ? 18 : p.oilSteps) / 100;
    const splitP = (p.oilSplit == null ? 42 : p.oilSplit) / 100;
    const accentP = (p.oilAccent == null ? 4 : p.oilAccent) / 100;
    const sweepSl = (p.oilSweep == null ? 53 : p.oilSweep) / 100;

    // The scene composes the frame; the slider still steers (half-and-half blend).
    const horizon = clamp((0.15 + horizonP * 0.75) * 0.5 + mod.hz * 0.5, 0.12, 0.9);
    const haze = skyP * 3 * mod.hazeMul;
    // Depth spread is NOT a slider — atmosphere and depth contrast are the same
    // physical thing, so haze drives both (more air => flatter depth).
    const depthContrast = 1.25 - 0.5 * (haze / 3);

    // ── (3) FLICKER-FREE motion — gated, SPACE only ───────────────────────────
    const ANIM = anim.anim;
    const swayP = (p.oilSway == null ? 50 : p.oilSway) / 100;
    const flowP = (p.oilFlow == null ? 35 : p.oilFlow) / 100;
    const dissolveP = (p.oilDissolve == null ? 45 : p.oilDissolve) / 100;
    const T = ANIM ? anim.t : 0;
    // Strokes are either BAKED into the underlay (still / no flow) or redrawn per
    // frame with their swim (live flow). Never both — the flag is in the key.
    const flowLive = ANIM && flowP > 0 && paintP > 0;

    // ── (4) Cache key — names every input the build reads, nothing more ────────
    // Palette bytes: exact for a true still, quantised whenever animating —
    // INCLUDING bake/export frames. Auto mode drifts the palette every frame;
    // on the exact path a video export would rebuild the whole underlay per
    // encoded frame (minutes, not seconds). Quantising costs ≤4/255 per channel
    // vs the still, is imperceptible, and stays fully deterministic. The BUILD
    // consumes the same quantised values it is keyed on, so the memo stays pure.
    const exactCfg = !ANIM;
    const q = (v: number): number => clamp(Math.round(v / 8) * 8, 0, 255);
    const pal: Pal = exactCfg
      ? { base: cfg.base, colors: cfg.colors, accentColors: cfg.accentColors }
      : {
          base: cfg.base.map(q),
          colors: cfg.colors.map((c) => c.map(q)),
          accentColors: (cfg.accentColors || []).map((c) => c.map(q)),
        };
    const palKey =
      pal.base.join(",") + ";" + pal.colors.map((c) => c.join(",")).join(";") + "|" +
      pal.accentColors.map((c) => c.join(",")).join(";");

    const spec: BuildSpec = {
      scene,
      brush,
      horizon,
      nRidges: Math.max(scene === "coast" ? 1 : 0, Math.round(Math.round(ridgesP * 6) * mod.layersMul)),
      nBands: Math.round(4 * mod.bandsMul),
      ampMul: (0.2 + peaksP * 2.3) * mod.ampMul,
      rough: 0.4 + roughP * 2.6,
      haze,
      clouds: Math.round(skyP * 60 * mod.cloudMul * 0.7),
      depthContrast,
      strokeLen: 0.3 + strokeP * 2.7,
      baseAlpha: 0.04 + opacityP * 0.46,
      nStrokes: Math.round(paintP * paintP * 12000 * OVER * OVER),
      tooth: toothP * 2,
      bakeStrokes: !flowLive,
      cellU: 6 + cellP * 66,
      steps: 2 + Math.round(stepsP * 22),
      split: splitP,
      bit: bitP,
      sweep: sweepSl,
      accent: accentP,
      sx,
      sy,
      ramps: deriveRamps(pal, scene),
    };

    const key = [
      seed, S, scene, brush,
      horizonP, ridgesP, peaksP, roughP, skyP,
      paintP, strokeP, opacityP, toothP,
      bitP, cellP, stepsP, splitP, accentP, sweepSl,
      flowLive ? 1 : 0, palKey,
    ].join("|");

    const c = ensureCache(spec, noise, seed, S, key);
    if (!c) return;

    ctx.save();

    // ── (5) MACRO CAMERA — a NOISE-driven wander (smooth random walk) plus a
    // breathing zoom and a micro-roll, so the whole painting visibly moves.
    // ANIM-gated => the still is unchanged. The zoom term is always ≥ 1 and the
    // translations stay inside the 6% overscan, so no unpainted edge can appear.
    if (ANIM) {
      const nw = (rate: number, lane: number): number => noise.vnoise(T * rate + camx, lane, camy) - 0.5;
      const camTX = S * 0.05 * swayP * nw(0.05, 1.7);
      const camTY = S * 0.03 * swayP * nw(0.043, 4.3) + S * 0.014 * swayP * (anim.kickEnv * 0.5 + anim.pumpEnv * 0.5);
      const camSC =
        1 + 0.035 * anim.pumpEnv + 0.03 * swayP * (nw(0.037, 7.1) + 0.5) + 0.018 * Math.max(0, anim.kickSpring);
      const camROT = 0.012 * swayP * nw(0.031, 9.6);
      ctx.translate(S * 0.5 + camTX, S * 0.5 + camTY);
      ctx.rotate(camROT);
      ctx.scale(camSC, camSC);
      ctx.translate(-S * 0.5, -S * 0.5);
    }

    // ── (6) the underlay (drawn 1:1 at an integer offset — no resampling) ──────
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(c.underlayS, -c.margin, -c.margin);

    // ── (7) live oil strokes (already baked into the underlay otherwise) ───────
    if (!c.bakedStrokes) drawStrokes(ctx, S, 0, c.strokePack, c.strokeCount, flowP, T);

    // ── (8) the bit cells ─────────────────────────────────────────────────────
    // Base visibility is the still: survivalHash < P. While animating, a coherent
    // front sweeps the seed's axis once per resolve loop and lifts P inside a soft
    // band, so extra cells appear and SCALE in behind it. `E` is 0 at loopPhase 0,
    // so the resolve frame is exactly the still cell set.
    const E = ANIM ? resolveEnv(anim.loopPhase) : 0;
    const boostA = dissolveP * E * 0.9;
    const rect = c.cellRect;
    const rgbv = c.cellRGB;
    for (let i = 0; i < c.cellCount; i++) {
      const slack = c.cellProb[i] - c.cellSurv[i];
      let pop = 1;
      if (slack <= 0) {
        if (boostA <= 0) continue;
        const bx = (E - c.cellSweep[i]) / BAND; // distance behind the front
        if (bx <= 0 || bx >= 1) continue;
        const bump = Math.sin(bx * Math.PI);
        if (slack + boostA * bump <= 0) continue;
        pop = 0.6 + 0.4 * bump; // space-only pop-in (never an alpha fade)
      }
      const o = i * 4;
      let x = rect[o] * S;
      let y = rect[o + 1] * S;
      let w = rect[o + 2] * S;
      let h = rect[o + 3] * S;
      if (pop < 1) {
        x += w * (1 - pop) * 0.5;
        y += h * (1 - pop) * 0.5;
        w *= pop;
        h *= pop;
      }
      const t3 = i * 3;
      tmpCol[0] = rgbv[t3];
      tmpCol[1] = rgbv[t3 + 1];
      tmpCol[2] = rgbv[t3 + 2];
      ctx.fillStyle = rgba(tmpCol, c.cellAlpha[i]);
      ctx.fillRect(x, y, w, h);
    }

    ctx.restore();
  },
};

function oilParams(): ParamDef[] {
  return [
    {
      key: "oilScene",
      label: "SCENE",
      type: "select",
      group: "composition",
      default: "ridgeline",
      options: [
        { value: "ridgeline", label: "RIDGELINE" },
        { value: "dunes", label: "DUNES" },
        { value: "coast", label: "COAST" },
        { value: "basin", label: "BASIN" },
        { value: "mesa", label: "MESA" },
        { value: "storm", label: "STORM" },
      ],
    },
    { key: "oilHorizon", label: "HORIZON", type: "range", group: "composition", min: 0, max: 100, default: 63 },
    { key: "oilRidges", label: "RIDGE LAYERS", type: "range", group: "composition", min: 0, max: 100, default: 83 },
    { key: "oilPeaks", label: "PEAK HEIGHT", type: "range", group: "composition", min: 0, max: 100, default: 35 },
    { key: "oilRough", label: "ROUGHNESS", type: "range", group: "composition", min: 0, max: 100, default: 23 },
    { key: "oilSky", label: "ATMOSPHERE", type: "range", group: "composition", min: 0, max: 100, default: 40 },
    {
      key: "oilBrush",
      label: "BRUSH",
      type: "select",
      group: "composition",
      default: "impasto",
      options: [
        { value: "impasto", label: "IMPASTO" },
        { value: "knife", label: "KNIFE" },
        { value: "scumble", label: "SCUMBLE" },
        { value: "stipple", label: "STIPPLE" },
        { value: "dry", label: "DRY BRUSH" },
      ],
    },
    { key: "oilPaint", label: "BRUSH LOAD", type: "range", group: "composition", min: 0, max: 100, default: 45 },
    { key: "oilStroke", label: "STROKE LENGTH", type: "range", group: "composition", min: 0, max: 100, default: 26 },
    { key: "oilOpacity", label: "PAINT OPACITY", type: "range", group: "composition", min: 0, max: 100, default: 35 },
    { key: "oilTooth", label: "CANVAS TOOTH", type: "range", group: "composition", min: 0, max: 100, default: 50 },
    { key: "oilBit", label: "CELL DENSITY", type: "range", group: "composition", min: 0, max: 100, default: 43 },
    { key: "oilCell", label: "CELL SIZE", type: "range", group: "composition", min: 0, max: 100, default: 27 },
    { key: "oilSteps", label: "COLOUR STEPS", type: "range", group: "composition", min: 0, max: 100, default: 18 },
    { key: "oilSplit", label: "SUBDIVIDE", type: "range", group: "composition", min: 0, max: 100, default: 42 },
    { key: "oilAccent", label: "ACCENT CELLS", type: "range", group: "composition", min: 0, max: 100, default: 4 },
    { key: "oilSweep", label: "DISSOLVE SWEEP", type: "range", group: "composition", min: 0, max: 100, default: 53 },
    { key: "oilSway", label: "CAMERA SWAY", type: "range", group: "motion", min: 0, max: 100, default: 50 },
    { key: "oilFlow", label: "PAINT FLOW", type: "range", group: "motion", min: 0, max: 100, default: 35 },
    { key: "oilDissolve", label: "DISSOLVE", type: "range", group: "motion", min: 0, max: 100, default: 45 },
  ];
}

registerEngine(oil);

export default oil;
