import type { AnimState, FieldArgs, FieldEngine, ParamDef, RNG } from "../types";
import { registerEngine } from "../registry";
import { prng } from "../prng";
import { rgba } from "../color";
import { drawBlurred } from "../blur";
import { clipPhaseOf as sharedClipPhase, loopBeatsOf } from "../loop";

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
//    Math.random / Date.now anywhere; the only per-frame inputs are the three
//    periodic clocks below.
//  • Flicker-free — the PAINTING IS LOCKED OFF: the strokes are baked into the
//    raster and nothing swims. Everything time-driven is gated on `anim.anim`
//    and moves SPACE only. The painting is THREE DEPTH PLANES (sky + clouds /
//    far ridges / near land), each a raster the camera moves with its own
//    parallax factor, so a wander or push-in separates the ridgelines like a
//    dolly through the scene; the clouds drift across the sky plane; the near
//    paint heaves sideways as a travelling SWELL (drawn in horizontal strips);
//    the far plane wobbles like heat (SHIMMER); and the BIT TIDE — the crush
//    front advances from the crushed edge toward the painted edge and every
//    extra cell GROWS in by scale from nothing, sliding onto its rest position
//    as it fills — with a CRUSH PULSE: cells breathe on the kick / bass and the
//    accent cells pop on the highs. Colour, brightness and alpha are constants
//    per element, so nothing strobes.
//
// THE THREE CLOCKS — all periodic and all EXACTLY 0 at frame 0, so the still,
// the first frame and the last frame of an export loop are the same image:
//   b = anim.beat       → kick / pump / spring, attack-shaped (`att`) so they are
//                         0 at b = 0 and ride through the loop seam.
//   φ = anim.loopPhase  → one resolve cycle: a small cycle breath (push-in).
//   ψ = clip phase      → one export clip (nCyc cycles ≈ 6 s): the tide, the
//                         camera wander and the slow push-in. Read from
//                         `anim.clipPhase` when the driver supplies it, else
//                         derived from `anim.rt` on the SHARED clip clock
//                         (../loop.ts — the same arithmetic export.ts's
//                         loopFrames uses) — see `clipPhaseOf`.
//   Track mode (`anim.track`): `beat` there is an onset FEATURE (strength), not
//   a phase, so the phase-shaped attack / release is skipped — the kick, pump
//   and spring ride the audio springs directly; ψ/φ are clocks on clip time and
//   the loop carries no seamless guarantee (as with every engine in track).
//   `anim.drift / swirl / speed` (the Drift sliders in BPM mode; the live mid /
//   high / energy features in Track mode) scale the swell, the shimmer + accent
//   pops, and the cloud drift — AMPLITUDE only, never a rate, so the clip still
//   loops whatever the music does. `anim.t` is not read.
//
// THE REF SAMPLING CONTRACT (why this looks the same at 156px and 3000px):
//   `REF = 396` is the tuning reference — the short side of the original study —
//   so 1 REF pixel == 1 prototype "u" unit and painter.ts's constants transcribe
//   literally. Every build paints the SAME vector underlay twice: once onto a
//   REF-scale buffer and once at the raster BUCKET scale (below). All *decisions*
//   (stroke colours, cell colours, cell survival) are read from the REF buffer, so
//   the layout and the palette of a frame are a pure function of (seed, params)
//   and never of the canvas size — only the rasterisation gets finer. The bucket
//   copy is what is actually drawn.
//
// OIL OWNS ITS COLOUR (why the Color panel does not touch it):
//   The painting is built from the study's OWN three palettes (paper / dusk /
//   ash — sky, ridge and field swatches transcribed verbatim from poster-
//   generator/lib/palettes.ts) plus its five brand accents, graded exactly as
//   painter.ts grades them: `grade(swatch, hue, sat, light)` = an HSL hue
//   rotation, a saturation multiply and a lightness lift, with the per-depth
//   lightness lift on ridges and bands (the Depth slider). The ridge ramp keeps
//   PROTOTYPE ORDER (index 0 = far, 5 = near — paper reads light-far / dark-
//   near, dusk dark-far / light-near, exactly as its data says; nothing is
//   re-sorted by luminance). `cfg` (the mood palette with the Color transforms
//   applied) is NOT read at all, so the studio's Hue / Vibrance / Warmth and
//   Auto mode's slow hue drift cannot reach the cache key and can never force a
//   rebuild — Oil's own Palette panel (palette, hue, saturation, light) is the
//   only colour input, and it is in the key like any composition param.
//
// THE SIZE-BUCKET CACHE (why animating never rebuilds):
//   The build is split in two memos keyed on the SAME numeric key (seed, every
//   composition + palette param — never S, never time, never a motion param,
//   never the Animate flag):
//     • refSlots (2, LRU) — everything size-independent: the REF images, the
//       stroke pack, the cell pack and its prebuilt fill styles. Two slots so
//       two Oil keys rendering in one loop (the studio canvas + a hovered start
//       tile) each keep theirs instead of rebuilding every frame.
//     • rasterSlots (2, LRU) — the painted underlay + strokes + tooth at a
//       BUCKET size from LADDER (the smallest rung ≥ S). Per frame the raster is
//       blitted scaled to S (1:1 for the 880 still and the 1080 hero/video), so
//       the live valve's 640–880 hunting all lands in ONE bucket and can never
//       cause a rebuild; the strokes and cells are vectors at S already. Two
//       slots so the 880 still survives a 3072 PNG export or a 560 draft; three
//       concurrent buckets would thrash (not a real path today).
//
// OVERSCAN: the underlay, the strokes and the cells all extend 6% past the frame
// so the ANIM camera transform can never expose an unpainted edge (its
// translation is bounded to < 4.7% of S; its zoom is always ≥ 1 about an
// interior pivot).

// ── tuning reference ─────────────────────────────────────────────────────────
const REF = 396; // 1 REF px == 1 prototype u-unit
const OVERSCAN = 0.06; // painted margin outside the frame, as a fraction of the edge
const OVER = 1 + 2 * OVERSCAN;
const TAU = Math.PI * 2;

// ── raster size ladder ───────────────────────────────────────────────────────
// StartGrid tiles 180 → 256; DRAFT 560 / Preview 520 → 560; Formats 640, Preview
// 720, the live valve 640–880 and the still 880 → 880 (1:1 for the still); hero
// 1080 + video ≤ 1080 → 1080 (1:1); PNG 3000 → 3072. Anything larger rounds up
// to a multiple of 512.
const LADDER = [256, 560, 880, 1080, 1536, 2048, 3072];
function bucketOf(S: number): number {
  for (let i = 0; i < LADDER.length; i++) if (LADDER[i] >= S) return LADDER[i];
  return Math.ceil(S / 512) * 512;
}
const RASTER_SLOTS = 2;
const REF_SLOTS = 2;

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

// ── value-noise lanes the camera / tide own (no fbm caller ever lands on them) ─
const LANE_PANX = 11;
const LANE_PANY = 17;
const LANE_PATCH = 83;

// ── depth planes ─────────────────────────────────────────────────────────────
// The painting is built as three planes so the camera can move THROUGH it: the
// sky (gradient + clouds), the far ridges (the back half of the stack) and the
// near land (front ridges, bands, water, rain). Every stroke and cell is tagged
// with the plane whose paint it sits on (read off the planes' alpha at REF), so
// it rides that plane. A still-only raster at MERGE_ABOVE and up (the PNG
// export) is ONE merged plane: it never moves, and three 3264² canvases would
// be ~130 MB.
const P_SKY = 1;
const P_FAR = 2;
const P_NEAR = 4;
const P_ALL = P_SKY | P_FAR | P_NEAR;
// The fraction of the camera each plane lags behind the near plane at Parallax 100.
const PX_FAR = 0.45;
const PX_SKY = 0.75;
// Horizontal strips the near / far planes are blitted in while a swell / shimmer
// is live, so each strip can be pushed sideways on its own.
const SWELL_STRIPS = 20;
const SHIM_STRIPS = 10;
const MERGE_ABOVE = 2048;

// ── the bit tide ─────────────────────────────────────────────────────────────
// Largest participation the tide can ever add (G ≤ BOOST_MAX). Used to cull cells
// that can never be shown at ANY Tide-reach setting — a constant, so the pack
// stays independent of the (motion-only) oilDissolve slider.
const BOOST_MAX = 0.9;
const BANDW = 0.6; // width of the grow band, in sweep-axis units
const LAG = 0.25; // how far behind the front the deepest / most-sheltered cells rise
const KSURGE = 0.03; // kick surge of the front, in sweep units
const SUBPX = 1.0; // px — a cell narrower than this is not drawn yet (grows from nothing)
const KBREATH = 0.05; // crush thump on the kick …
const PBREATH = 0.02; // … and on the pump, both scaled by Tide reach
const BREATH_MAX = 0.03; // cap on that thump (a lattice pulse would read as strobe)

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
/** A slider read: the default for a missing OR non-finite value, so neither the
 *  cache key nor the build can ever see NaN (a NaN key slot would miss forever). */
function sl(v: unknown, def: number): number {
  return typeof v === "number" && Number.isFinite(v) ? v : def;
}
/** Key-slot guard: a non-finite value becomes a sentinel that compares equal to
 *  itself, so a junk param can never force a rebuild every frame. */
function fin(v: number): number {
  return Number.isFinite(v) ? v : -1;
}
/** Attack shaping for the beat envelopes: 0 at b = 0, a quarter-sine up to 1 over
 *  the first `w` of the beat. Keeps every push EXACTLY 0 on the loop seam. */
function att(b: number, w: number): number {
  return b <= 0 ? 0 : b < w ? Math.sin((Math.PI / 2) * (b / w)) : 1;
}

// Reused colour triple for the build loops (no per-stroke / per-cell alloc).
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

// ── the seed's own stream, memoised ──────────────────────────────────────────
// The C_CAM stream (seedHash, camera phases, sweep axis) and the noise closures
// are a pure function of the seed, so they are built once per seed instead of
// per frame (that was 4 closure allocations a frame).
interface Cam {
  seed: number;
  seedHash: number;
  camx: number;
  camy: number;
  sx: number; // sweep axis (unit vector): t grows along +(sx, sy) toward the crushed edge
  sy: number;
  noise: Noise;
}
let camMemo: Cam | null = null;

function camOf(seed: number): Cam {
  if (camMemo && camMemo.seed === seed) return camMemo;
  const r: RNG = prng(seed ^ C_CAM);
  const seedHash = (Math.floor(r() * 0xffffffff) ^ (seed * 0x9e3779b1)) | 0;
  const camx = r() * TAU;
  const camy = r() * TAU;
  // Dissolve axis: ±35° around horizontal, so the sweep always reads as a
  // left-to-right wipe rather than an arbitrary diagonal.
  const sweepAng = (r() - 0.5) * ((70 * Math.PI) / 180);
  camMemo = {
    seed,
    seedHash,
    camx,
    camy,
    sx: Math.cos(sweepAng),
    sy: Math.sin(sweepAng),
    noise: makeNoise(seedHash),
  };
  return camMemo;
}

// ── the study's palettes (poster-generator/lib/palettes.ts, hex -> RGB verbatim)
// "Art-layer constants: mid-toned, readable on paper and near-black alike."
// sky = 3 gradient stops top -> horizon; ridge = 6 swatches FAR -> NEAR (index
// 0 sits against the sky); field = 5 foreground bands, index = band index.
interface OilPalette {
  sky: number[][];
  ridge: number[][];
  field: number[][];
}
type PaletteId = "paper" | "dusk" | "ash";
const PALETTE_IDS: PaletteId[] = ["paper", "dusk", "ash"];
const OIL_PALETTES: Record<PaletteId, OilPalette> = {
  paper: {
    sky: [[245, 243, 235], [234, 235, 228], [216, 224, 227]],
    ridge: [[183, 201, 218], [159, 181, 203], [132, 156, 183], [106, 131, 160], [82, 108, 136], [67, 89, 111]],
    field: [[167, 177, 137], [196, 183, 120], [143, 158, 109], [119, 133, 94], [97, 110, 76]],
  },
  dusk: {
    sky: [[22, 22, 20], [31, 33, 30], [44, 50, 51]],
    ridge: [[51, 60, 76], [62, 74, 94], [76, 90, 112], [92, 107, 130], [112, 128, 154], [132, 147, 171]],
    field: [[35, 38, 31], [51, 57, 42], [69, 74, 48], [44, 49, 38], [29, 32, 25]],
  },
  ash: {
    sky: [[232, 230, 223], [217, 216, 209], [196, 198, 195]],
    ridge: [[168, 171, 166], [149, 153, 154], [127, 132, 136], [105, 110, 116], [84, 88, 97], [67, 70, 78]],
    field: [[142, 141, 128], [163, 156, 134], [120, 120, 107], [96, 95, 85], [76, 75, 68]],
  },
};
/** The five brand accents — punctuation only: a handful of cells, never a fill. */
const OIL_ACCENTS: number[][] = [
  [235, 187, 99],
  [143, 217, 166],
  [127, 176, 227],
  [179, 157, 232],
  [232, 143, 174],
];

// ── grade (poster-generator/lib/color.ts, transcribed) ───────────────────────
/** Hue-rotate / saturate / lift a swatch: RGB -> HSL, h + hueDeg, s × satMul
 *  (clamped to [0,1]), l + lightAdd (clamped to [0.02,0.98]) -> RGB. Pure;
 *  build-time only (never on the frame path). Floats out — rgba() rounds. */
function gradeRGB(c: number[], hueDeg: number, satMul: number, lightAdd: number): number[] {
  const r = c[0] / 255;
  const g = c[1] / 255;
  const b = c[2] / 255;
  const mx = Math.max(r, g, b);
  const mn = Math.min(r, g, b);
  const l0 = (mx + mn) / 2;
  let h = 0;
  let s = 0;
  if (mx !== mn) {
    const d = mx - mn;
    s = l0 > 0.5 ? d / (2 - mx - mn) : d / (mx + mn);
    if (mx === r) h = (g - b) / d + (g < b ? 6 : 0);
    else if (mx === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60;
  }
  h = (((h + hueDeg) % 360) + 360) % 360;
  s = clamp(s * satMul, 0, 1);
  const l = clamp(l0 + lightAdd, 0.02, 0.98);
  if (s === 0) {
    const v = l * 255;
    return [v, v, v];
  }
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const hh = h / 360;
  const f = (t: number): number => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };
  return [f(hh + 1 / 3) * 255, f(hh) * 255, f(hh - 1 / 3) * 255];
}

// ── palette ramps ────────────────────────────────────────────────────────────
// The graded swatches the underlay consumes AS-IS. Ridge and band fills are NOT
// here: painter.ts grades those per element with a depth-dependent lightness
// lift, so the underlay grades them from the source palette where the swatch is
// chosen (see `gradeRGB` calls in paintUnderlayVector — build-time only).
interface Ramps {
  sky: number[][]; // 3 stops, top -> horizon (storm: pre-mixed 42 % toward ridge[5])
  ridge: number[][]; // 6 base-graded stops in PROTOTYPE order: 0 = FAR, 5 = NEAR
  accent: number[][]; // bit-cell punctuation (hue/sat graded, never lifted)
}

function rampsFromPalette(pal: OilPalette, hueDeg: number, satMul: number, lightAdd: number, scene: SceneId): Ramps {
  const ridge = pal.ridge.map((c) => gradeRGB(c, hueDeg, satMul, lightAdd));
  let sky = pal.sky.map((c) => gradeRGB(c, hueDeg, satMul, lightAdd));
  // Storm pre-mixes the whole sky toward the NEAR ridge — heavy weather overhead.
  if (scene === "storm") sky = sky.map((s) => mix(s, ridge[5], 0.42));
  const accent = OIL_ACCENTS.map((c) => gradeRGB(c, hueDeg, satMul, 0));
  return { sky, ridge, accent };
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
  drift: number; // per-stroke RGB jitter amplitude (painter.ts's p.drift)
  cellU: number;
  steps: number;
  split: number;
  bit: number;
  sweep: number;
  accent: number;
  sx: number;
  sy: number;
  pal: OilPalette; // the source swatches (ridges / bands grade from these per element)
  hueDeg: number;
  satMul: number;
  lightAdd: number;
  ramps: Ramps;
}

// ── the numeric cache key ────────────────────────────────────────────────────
// One reusable Float64Array, filled per frame and compared element-wise — no
// string joins, no per-frame allocation. Slots: seed, sceneIdx, brushIdx, the 16
// composition sliders (3..17), then the palette panel — paletteIdx, hue, sat,
// light, depth, drift (18..23). Every slot is finite (`sl` / `fin`). NOTHING that
// changes while animating with fixed params is in here (no S, no time, no motion
// params, no Animate flag, and nothing from cfg).
const KEY_LEN = 24;
const keyTmp = new Float64Array(KEY_LEN);
function sameKey(a: Float64Array, b: Float64Array): boolean {
  for (let i = 0; i < KEY_LEN; i++) if (a[i] !== b[i]) return false;
  return true;
}

// ── module singletons (one engine instance; every field() call is synchronous
// and self-contained, so these can never race — same pattern as signal.ts) ────
let rCanvas: HTMLCanvasElement | null = null; // REF-scale build buffer (read back)
let xCanvas: HTMLCanvasElement | null = null; // scratch for the drawBlurred layers
let frameNo = 0; // LRU clock for the raster slots

/** Build counters — for the perf harness / dev hooks only; never read by the render path. */
export const oilStats = { refBuilds: 0, rasterBuilds: 0 };

/** Everything size-independent: a pure function of the key. */
interface OilRef {
  keyVec: Float64Array;
  lastUse: number; // LRU clock (frameNo)
  spec: BuildSpec;
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
  cellPatch: Float32Array; // smooth 0..1 fbm field — shapes the tide's shoreline
  cellStyle: string[]; // prebuilt rgba() strings — the hot loop never formats
  cellPlaneEnd: Int32Array; // cells are SORTED by plane: [endSky, endFar, endNear]
  cellAccent: Uint8Array; // 1 = an accent-tinted cell (pops on the kick)
  cellCount: number;
}
const refSlots: OilRef[] = [];

/** The painted raster (underlay + strokes + tooth) at one bucket size. */
interface RasterSlot {
  keyVec: Float64Array;
  B: number; // bucket edge (0 = never valid)
  Mb: number; // overscan margin at B, in px
  planes: HTMLCanvasElement[]; // [sky, far, near], each (B + 2·Mb)² — or ONE merged plane
  merged: boolean;
  lastUse: number;
}
const rasterSlots: RasterSlot[] = [];

const STRIDE = 10; // x, y, ang, len, thick, alpha, r, g, b, phaseHash

function ctxOf(c: HTMLCanvasElement, willRead: boolean): CanvasRenderingContext2D | null {
  return c.getContext("2d", willRead ? { willReadFrequently: true } : undefined);
}
let pCanvas: HTMLCanvasElement | null = null; // the plane-alpha passes at REF (build only)
function ensureCanvas(which: 0 | 1 | 2, side: number): HTMLCanvasElement {
  let c = which === 0 ? rCanvas : which === 1 ? xCanvas : pCanvas;
  if (!c) {
    c = document.createElement("canvas");
    if (which === 0) rCanvas = c;
    else if (which === 1) xCanvas = c;
    else pCanvas = c;
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
  mask: number,
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
  const scratch = ensureCanvas(1, N);
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
  // (`mask` picks the plane being painted: P_ALL paints everything into one
  // buffer — the REF decisions and a merged still; a single plane bit paints
  // just that plane onto a transparent buffer. Each pass owns its own PRNG
  // stream, so skipping a pass can never shift another.)
  if (mask & P_SKY) {
    frame();
    const grad = ctx.createLinearGradient(0, 0, 0, edge * (horizon + 0.06));
    grad.addColorStop(0, rgba(sky[0], 1));
    grad.addColorStop(0.55, rgba(sky[1], 1));
    grad.addColorStop(1, rgba(sky[2], 1));
    ctx.fillStyle = grad;
    ctx.fillRect(-M, -M, N, N);
    ident();
  }

  // ───────────────────────────────────────────────────────────────── clouds
  // ALL cloud masses go into ONE scratch layer and get ONE blur composite (the
  // prototype blurred each ellipse separately, which is the same look for a
  // fraction of the cost).
  if (mask & P_SKY && spec.clouds > 0) {
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
  const pal = spec.pal;
  for (let i = 0; i < spec.nRidges; i++) {
    const depth = spec.nRidges === 1 ? 0 : i / (spec.nRidges - 1); // 0 far .. 1 near
    // The back half of the stack is the FAR plane, the front half the NEAR plane.
    if (!(mask & (depth < 0.5 ? P_FAR : P_NEAR))) continue;
    // painter.ts: g(ridge[round(depth·5)], (0.5 - depth)·0.1·(contrast - 1)·2) — the
    // Depth slider lifts the far ridges and sinks the near ones (a tiny HSL lift,
    // graded from the source swatch in ONE shot so the clamps match the study).
    const swatch = gradeRGB(
      pal.ridge[Math.min(pal.ridge.length - 1, Math.round(depth * (pal.ridge.length - 1)))],
      spec.hueDeg,
      spec.satMul,
      spec.lightAdd + (0.5 - depth) * 0.1 * (spec.depthContrast - 1) * 2,
    );
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
  for (let i = 0; mask & P_NEAR && i < spec.nBands; i++) {
    const t = spec.nBands === 1 ? 0 : i / (spec.nBands - 1);
    // painter.ts: g(field[min(4, i)], (t - 0.5)·0.06·(contrast - 1)) — band i takes
    // field swatch i (the last one repeats past five), with the Depth lift.
    const col = gradeRGB(
      pal.field[Math.min(pal.field.length - 1, i)],
      spec.hueDeg,
      spec.satMul,
      spec.lightAdd + (t - 0.5) * 0.06 * (spec.depthContrast - 1),
    );
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
  if (mask & P_NEAR && (scene === "coast" || scene === "storm")) {
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
// the REF bake and every bucket raster.
function buildStrokePack(
  spec: BuildSpec,
  noise: Noise,
  under: ImageData,
  nearA: ImageData,
  farA: ImageData,
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
  const nd = nearA.data;
  const fd = farA.data;
  const horizon = spec.horizon;
  const brush = spec.brush;

  for (let i = 0; i < n; i++) {
    // normalised frame coords, spread across the overscan
    const nx = r() * OVER - OVERSCAN;
    const ny = r() * OVER - OVERSCAN;
    // REF pixel of this stroke, and the jittered pixel its colour is lifted from
    const px = refMargin + nx * REF;
    const py = refMargin + ny * REF;
    // The plane this stroke's paint sits on (the near / far planes' alpha at its
    // own pixel) — it rides that plane. Read-only: no stream draw.
    const kp = (clamp(py | 0, 0, H - 1) * W + clamp(px | 0, 0, W - 1)) * 4 + 3;
    const plane = nd[kp] >= 128 ? P_NEAR : fd[kp] >= 128 ? P_FAR : P_SKY;
    const sxp = clamp((px + (r() - 0.5) * 16) | 0, 0, W - 1);
    const syp = clamp((py + (r() - 0.5) * 11) | 0, 0, H - 1);
    const k = (syp * W + sxp) * 4;
    // painter.ts's ±drift RGB jitter (the Colour drift slider; the study's default
    // was 24) + a 12% warm bias — pigment never mixes perfectly, and the warm
    // flecks are what stop the field reading as a gradient. The draw happens even
    // at drift 0, so the stream is the same for every drift setting.
    const jit = (r() - 0.5) * spec.drift;
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
    pack[o + 9] = plane; // the depth plane it is baked onto (P_SKY / P_FAR / P_NEAR)
  }
  return pack;
}

/** Bake the pack into `ctx` — the REF composite and every bucket raster. Strokes
 *  are STATIC: the paint under the tide is the still's paint at every phase, so
 *  there is no per-frame ellipse cost and nothing to boil. */
function drawStrokes(
  ctx: CanvasRenderingContext2D,
  edge: number,
  margin: number,
  pack: Float32Array,
  count: number,
  plane: number, // P_ALL, or the one plane whose strokes to bake
): void {
  const u = edge / REF;
  for (let i = 0; i < count; i++) {
    const o = i * STRIDE;
    const len = pack[o + 3];
    if (len <= 0) continue; // dry-brush skip
    if (plane !== P_ALL && pack[o + 9] !== plane) continue;
    tmpCol[0] = pack[o + 6];
    tmpCol[1] = pack[o + 7];
    tmpCol[2] = pack[o + 8];
    ctx.fillStyle = rgba(tmpCol, pack[o + 5]);
    ctx.beginPath();
    // Floor the radii so strokes stay visible when the field renders SMALL (the
    // gallery thumbnails), exactly as contours floors its line weight.
    ctx.ellipse(
      margin + pack[o] * edge,
      margin + pack[o + 1] * edge,
      Math.max(0.35, len * u),
      Math.max(0.2, pack[o + 4] * u),
      pack[o + 2],
      0,
      TAU,
    );
    ctx.fill();
  }
}

/** Woven canvas tooth — painter.ts's per-pixel weave, in place. Deliberately a
 *  SCREEN-space texture (like film grain): it is the surface the paint sits on,
 *  not part of the composition, so it does not scale with the frame. */
function toothInPlace(
  data: Uint8ClampedArray,
  W: number,
  H: number,
  amt: number,
  skipSoft = false, // transparent planes: leave the soft (alpha < 250) edges alone
): void {
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const k = (y * W + x) * 4;
      if (skipSoft && data[k + 3] < 250) continue;
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
  patch: Float32Array;
  style: string[];
  planeEnd: Int32Array; // cells sorted by plane: [endSky, endFar, endNear]
  accent: Uint8Array;
  count: number;
}

function buildCellPack(
  spec: BuildSpec,
  noise: Noise,
  img: ImageData,
  nearA: ImageData,
  farA: ImageData,
  refMargin: number,
): CellPack {
  const rect: number[] = [];
  const rgbv: number[] = [];
  const alpha: number[] = [];
  const surv: number[] = [];
  const prob: number[] = [];
  const sweep: number[] = [];
  const patch: number[] = [];
  const plane: number[] = []; // 0 sky, 1 far, 2 near
  const accent: number[] = [];
  if (spec.bit <= 0) {
    return {
      rect: new Float32Array(0),
      rgbv: new Uint8Array(0),
      alpha: new Float32Array(0),
      surv: new Float32Array(0),
      prob: new Float32Array(0),
      sweep: new Float32Array(0),
      patch: new Float32Array(0),
      style: [],
      planeEnd: Int32Array.from([0, 0, 0]),
      accent: new Uint8Array(0),
      count: 0,
    };
  }

  const d = img.data;
  const W = img.width;
  const H = img.height;
  const nd = nearA.data;
  const fd = farA.data;
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
  // so the cell geometry is static and the tide only ever GROWS a cell in place —
  // cells can never re-shape mid-loop.
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
    if (s >= p + BOOST_MAX) return; // can never be shown at ANY tide setting

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
    let acc = 0;
    if (accents.length && noise.hash3(ax, ay, CH_ACC + level) < accP) {
      acc = 1;
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
    // A smooth 0..1 field with ~⅓-frame features (2 octaves, max 0.75): the tide's
    // shoreline advances in coherent patches instead of hash-noise.
    patch.push(clamp(noise.fbm(cx * 3, cy * 3, LANE_PATCH, 2) / 0.75, 0, 1));
    // The plane this cell rides — the near / far planes' alpha at its centre.
    const kp = (clamp(Math.round(ay + sz / 2), 0, H - 1) * W + clamp(Math.round(ax + sz / 2), 0, W - 1)) * 4 + 3;
    plane.push(nd[kp] >= 128 ? 2 : fd[kp] >= 128 ? 1 : 0);
    accent.push(acc);
  };

  for (let y = 0; y < H; y += cellPx) {
    for (let x = 0; x < W; x += cellPx) walk(x, y, cellPx, 0);
  }

  // Sort the cells by plane (stable — the walk order is kept inside a plane) so
  // the per-frame draw is three index ranges, one per plane transform.
  const count = alpha.length;
  const order: number[] = new Array(count);
  for (let i = 0; i < count; i++) order[i] = i;
  order.sort((a, b) => plane[a] - plane[b] || a - b);
  const planeEnd = Int32Array.from([0, 0, 0]);
  for (let i = 0; i < count; i++) planeEnd[plane[order[i]]]++;
  planeEnd[1] += planeEnd[0];
  planeEnd[2] += planeEnd[1];

  const rectArr = new Float32Array(count * 4);
  const rgbArr = new Uint8Array(count * 3);
  const alphaArr = new Float32Array(count);
  const survArr = new Float32Array(count);
  const probArr = new Float32Array(count);
  const sweepArr = new Float32Array(count);
  const patchArr = new Float32Array(count);
  const accentArr = new Uint8Array(count);
  const style: string[] = new Array(count);
  for (let i = 0; i < count; i++) {
    const j = order[i];
    rectArr[i * 4] = rect[j * 4];
    rectArr[i * 4 + 1] = rect[j * 4 + 1];
    rectArr[i * 4 + 2] = rect[j * 4 + 2];
    rectArr[i * 4 + 3] = rect[j * 4 + 3];
    rgbArr[i * 3] = rgbv[j * 3];
    rgbArr[i * 3 + 1] = rgbv[j * 3 + 1];
    rgbArr[i * 3 + 2] = rgbv[j * 3 + 2];
    alphaArr[i] = alpha[j];
    survArr[i] = surv[j];
    probArr[i] = prob[j];
    sweepArr[i] = sweep[j];
    patchArr[i] = patch[j];
    accentArr[i] = accent[j];
    // Prebuilt fill styles from the PACKED values (float32 alpha), so the hot loop
    // emits exactly the strings the per-cell rgba() call used to.
    tmpCol[0] = rgbArr[i * 3];
    tmpCol[1] = rgbArr[i * 3 + 1];
    tmpCol[2] = rgbArr[i * 3 + 2];
    style[i] = rgba(tmpCol, alphaArr[i]);
  }

  return {
    rect: rectArr,
    rgbv: rgbArr,
    alpha: alphaArr,
    surv: survArr,
    prob: probArr,
    sweep: sweepArr,
    patch: patchArr,
    style,
    planeEnd,
    accent: accentArr,
    count,
  };
}

// ── the cached builds ────────────────────────────────────────────────────────
// PURE memos: the key names every input the builds read, and the builds read
// nothing else — so the frame is byte-identical with or without a cache hit.

/** Steps 1, 2, 4: the REF images, the stroke pack and the cell pack. Returns a
 *  NEW entry (the caller slots it); the live entries hold their own ImageData
 *  copies, so repainting the shared REF buffer can never touch them. */
function buildRef(spec: BuildSpec, noise: Noise, seed: number): OilRef | null {
  const refMargin = Math.round(OVERSCAN * REF); // 24
  const RS = REF + 2 * refMargin; // 444
  const rc = ensureCanvas(0, RS);
  const rctx = ctxOf(rc, true); // read back twice per build
  if (!rctx) return null;

  // 1. REF underlay -> the raster the strokes lift their colour from.
  paintUnderlayVector(rctx, REF, refMargin, spec, noise, seed, P_ALL);
  const underlayImg = rctx.getImageData(0, 0, RS, RS);

  // 1b. the near and far planes ALONE — their alpha is the map that tags every
  //     stroke and cell with the plane it rides. Painted into a third canvas so
  //     the REF buffer keeps the full underlay (the blur scratch is canvas 1).
  const pc = ensureCanvas(2, RS);
  const pctx = ctxOf(pc, true);
  if (!pctx) return null;
  paintUnderlayVector(pctx, REF, refMargin, spec, noise, seed, P_NEAR);
  const nearA = pctx.getImageData(0, 0, RS, RS);
  paintUnderlayVector(pctx, REF, refMargin, spec, noise, seed, P_FAR);
  const farA = pctx.getImageData(0, 0, RS, RS);

  // 2. strokes, then the REF composite the cells read (underlay + paint + tooth).
  const strokePack = buildStrokePack(spec, noise, underlayImg, nearA, farA, refMargin, seed);
  drawStrokes(rctx, REF, refMargin, strokePack, spec.nStrokes, P_ALL);
  const compositeImg = rctx.getImageData(0, 0, RS, RS);
  if (spec.tooth > 0) toothInPlace(compositeImg.data, RS, RS, spec.tooth);
  // (no putImageData — the REF buffer is only ever sampled, never displayed)

  // 4. the bit cells, read off the REF composite, tagged + sorted by plane.
  const cells = buildCellPack(spec, noise, compositeImg, nearA, farA, refMargin);

  const ref: OilRef = {
    keyVec: Float64Array.from(keyTmp),
    lastUse: frameNo,
    spec,
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
    cellPatch: cells.patch,
    cellStyle: cells.style,
    cellPlaneEnd: cells.planeEnd,
    cellAccent: cells.accent,
    cellCount: cells.count,
  };
  oilStats.refBuilds++;
  return ref;
}

/** The ref entry under the current key (a hit, LRU-touched), or null — a miss;
 *  `refVictim` then names the least-recently-used slot for `slotRef`. A plain
 *  lookup + a module index rather than a build callback so a hit allocates
 *  nothing (mirrors ensureRaster's LRU). */
let refVictim = -1;
function findRef(): OilRef | null {
  refVictim = -1;
  for (let i = 0; i < refSlots.length; i++) {
    const s = refSlots[i];
    if (sameKey(s.keyVec, keyTmp)) {
      s.lastUse = frameNo;
      return s;
    }
    if (refVictim < 0 || s.lastUse < refSlots[refVictim].lastUse) refVictim = i;
  }
  return null;
}
function slotRef(ref: OilRef): void {
  if (refSlots.length < REF_SLOTS || refVictim < 0) refSlots.push(ref);
  else refSlots[refVictim] = ref;
}

/** Step 3: the underlay + baked strokes + tooth at bucket `B`, into `slot` — as
 *  the three depth planes, or ONE merged plane for a still-only raster at
 *  MERGE_ABOVE and up (memory). Source-over compositing is associative, so the
 *  three planes drawn at rest are the merged paint, pixel for pixel. */
function buildRaster(slot: RasterSlot, B: number, ref: OilRef, noise: Noise, seed: number): boolean {
  slot.B = 0; // never valid until the build completes
  const Mb = Math.round(OVERSCAN * B);
  const Bo = B + 2 * Mb;
  const merged = B >= MERGE_ABOVE;
  const masks = merged ? [P_ALL] : [P_SKY, P_FAR, P_NEAR];
  while (slot.planes.length > masks.length) slot.planes.pop(); // release the extra planes
  for (let i = 0; i < masks.length; i++) {
    let c = slot.planes[i];
    if (!c) {
      c = document.createElement("canvas");
      slot.planes[i] = c;
    }
    if (c.width !== Bo || c.height !== Bo) {
      c.width = Bo;
      c.height = Bo;
    }
    const sctx = ctxOf(c, false);
    if (!sctx) return false;
    const mask = masks[i];
    paintUnderlayVector(sctx, B, Mb, ref.spec, noise, seed, mask);
    drawStrokes(sctx, B, Mb, ref.strokePack, ref.strokeCount, mask);
    if (ref.spec.tooth > 0) {
      const img = sctx.getImageData(0, 0, Bo, Bo);
      // The far / near planes are transparent outside their paint: leave their
      // soft edges alone (a tooth through premultiplied 8-bit alpha speckles).
      toothInPlace(img.data, Bo, Bo, ref.spec.tooth, mask === P_FAR || mask === P_NEAR);
      sctx.putImageData(img, 0, 0);
    }
  }
  // A PNG-export raster leaves a ~42 MB scratch behind — release it.
  if (B >= MERGE_ABOVE) ensureCanvas(1, 1);

  slot.keyVec.set(keyTmp);
  slot.B = B;
  slot.Mb = Mb;
  slot.merged = merged;
  slot.lastUse = frameNo;
  oilStats.rasterBuilds++;
  return true;
}

/** The raster slot for bucket `B` under the current key: a hit, or the LRU slot rebuilt. */
function ensureRaster(B: number, ref: OilRef, noise: Noise, seed: number): RasterSlot | null {
  let victim: RasterSlot | null = null;
  for (let i = 0; i < rasterSlots.length; i++) {
    const s = rasterSlots[i];
    if (s.B === B && sameKey(s.keyVec, keyTmp)) {
      s.lastUse = frameNo;
      return s;
    }
    if (!victim || s.lastUse < victim.lastUse) victim = s;
  }
  let slot: RasterSlot;
  if (rasterSlots.length < RASTER_SLOTS || !victim) {
    slot = {
      keyVec: new Float64Array(KEY_LEN),
      B: 0,
      Mb: 0,
      planes: [],
      merged: false,
      lastUse: 0,
    };
    rasterSlots.push(slot);
  } else {
    slot = victim;
  }
  return buildRaster(slot, B, ref, noise, seed) ? slot : null;
}

// ── the clip clock ───────────────────────────────────────────────────────────
/** ψ in [0,1): the phase of one export clip (nCyc resolve cycles, ≈ 6 s). Prefers
 *  `anim.clipPhase` from the driver; otherwise the shared clip clock (../loop.ts
 *  — the arithmetic export.ts's loopFrames uses) on `anim.rt`, so the tide period
 *  equals the clip and the export loop is seamless. 0 at rt = 0. */
function clipPhaseOf(anim: AnimState, p: Record<string, any>): number {
  if (typeof anim.clipPhase === "number") return anim.clipPhase;
  const bps = (p.animBPM == null ? 128 : p.animBPM) / 60;
  return sharedClipPhase(anim.rt, bps, loopBeatsOf(p.txtLoopBeats));
}

// ── the camera's noise circle ────────────────────────────────────────────────
/** A closed loop through 3D value noise (C²-smooth through the seam) minus its
 *  ψ = 0 sample, squashed by tanh: EXACTLY 0 at ψ = 0 because both vnoise calls
 *  then receive identical arguments. `cs`/`sn` = cos/sin(2πψ). */
function nzc(noise: Noise, camx: number, camy: number, cs: number, sn: number, lane: number): number {
  return Math.tanh(
    2.6 * (noise.vnoise(camx + 0.35 * cs, camy + 0.35 * sn, lane) - noise.vnoise(camx + 0.35, camy, lane)),
  );
}

// ── the bit tide ─────────────────────────────────────────────────────────────
/** Draw the cell set: the still cells (slack > 0) at rest, plus — while the front
 *  `F` is out — every tide cell inside the grow band, scaled by a smoothstep of
 *  its distance behind the front and slid `off` along the sweep axis. Scale is a
 *  continuous function of (F, t, deficit, patch): nothing appears or vanishes
 *  except by growth, neighbours share t and patch so they rise together, and
 *  colour/alpha are per-cell constants. At F = 0 and breath = 1 this is EXACTLY
 *  the still cell set (the `scl === 1` path uses the rest arithmetic). */
function drawCells(
  ctx: CanvasRenderingContext2D,
  S: number,
  ref: OilRef,
  from: number, // index range — one plane's cells (the pack is sorted by plane)
  to: number,
  F: number,
  G: number,
  breath: number,
  accentScl: number,
  flowP: number,
  sx: number,
  sy: number,
): void {
  if (to <= from) return;
  const rect = ref.cellRect;
  const surv = ref.cellSurv;
  const prob = ref.cellProb;
  const sweep = ref.cellSweep;
  const patch = ref.cellPatch;
  const style = ref.cellStyle;
  const accent = ref.cellAccent;
  const tideOn = F > 0;
  const invB = 1 / BANDW;
  for (let i = from; i < to; i++) {
    const slack = prob[i] - surv[i];
    let pop = 1;
    if (slack <= 0) {
      if (!tideOn) continue;
      const deficit = -slack;
      if (deficit >= G) continue; // time-independent participation gate
      const u = deficit / G;
      // The hash breaks up the interior; the smooth patch shapes the shoreline.
      const lag = LAG * (0.5 * u + 0.5 * (1 - patch[i]));
      const x = (F - (1 - sweep[i]) - lag) * invB; // 0 at the front's edge, 1 fully grown
      if (x <= 0) continue;
      pop = x >= 1 ? 1 : x * x * (3 - 2 * x);
    }
    const o = i * 4;
    const x0 = rect[o] * S;
    const y0 = rect[o + 1] * S;
    const w = rect[o + 2] * S;
    const h = rect[o + 3] * S;
    const scl = pop * breath * (accent[i] ? accentScl : 1);
    ctx.fillStyle = style[i];
    if (scl === 1) {
      ctx.fillRect(x0, y0, w, h);
      continue;
    }
    const ws = w * scl;
    const hs = h * scl;
    if (ws < SUBPX) continue; // grows from nothing — continuous threshold
    // The cell sits toward the crushed side while small and lands on its rest
    // position as it fills (still cells have pop 1 ⇒ off 0).
    const off = flowP * 1.2 * w * (1 - pop);
    const cx = x0 + w * 0.5 + off * sx;
    const cy = y0 + h * 0.5 + off * sy;
    ctx.fillRect(cx - ws * 0.5, cy - hs * 0.5, ws, hs);
  }
}

// ─────────────────────────────────────────────────────────────────────────────

const oil: FieldEngine = {
  id: "oil",
  label: "Oil",
  kind: "2d",
  focus: "oil",
  params: oilParams(),
  field(args: FieldArgs): void {
    // NB: `cfg` is deliberately not read — Oil owns its colour (see the header).
    const { ctx, size: S, params: p, seed, anim } = args;
    if (!(S > 0)) return;
    frameNo++;

    // ── (1) DETERMINISTIC — the seed's stream, memoised per seed ──────────────
    const cam = camOf(seed);
    const noise = cam.noise;
    const sx = cam.sx;
    const sy = cam.sy;

    // ── (2) Shaping params ────────────────────────────────────────────────────
    const sceneRaw = typeof p.oilScene === "string" ? p.oilScene : "ridgeline";
    const sceneIdx = Math.max(0, SCENE_IDS.indexOf(sceneRaw as SceneId));
    const scene: SceneId = SCENE_IDS[sceneIdx];
    const brushRaw = typeof p.oilBrush === "string" ? p.oilBrush : "impasto";
    const brushIdx = Math.max(0, BRUSH_IDS.indexOf(brushRaw as BrushId));
    const brush: BrushId = BRUSH_IDS[brushIdx];
    const mod = SCENE_MODS[scene];

    const horizonP = sl(p.oilHorizon, 63) / 100;
    const ridgesP = sl(p.oilRidges, 83) / 100;
    const peaksP = sl(p.oilPeaks, 35) / 100;
    const roughP = sl(p.oilRough, 23) / 100;
    const skyP = sl(p.oilSky, 40) / 100;
    const paintP = sl(p.oilPaint, 45) / 100;
    const strokeP = sl(p.oilStroke, 26) / 100;
    const opacityP = sl(p.oilOpacity, 35) / 100;
    const toothP = sl(p.oilTooth, 50) / 100;
    const bitP = sl(p.oilBit, 43) / 100;
    const cellP = sl(p.oilCell, 27) / 100;
    const stepsP = sl(p.oilSteps, 18) / 100;
    const splitP = sl(p.oilSplit, 42) / 100;
    const accentP = sl(p.oilAccent, 4) / 100;
    const sweepSl = sl(p.oilSweep, 53) / 100;

    // The Palette panel — Oil's ONLY colour input (cfg is never read).
    const paletteRaw = typeof p.oilPalette === "string" ? p.oilPalette : "paper";
    const paletteIdx = Math.max(0, PALETTE_IDS.indexOf(paletteRaw as PaletteId)); // unknown -> paper
    const hueP = sl(p.oilHue, 50) / 100; // 0.5 = 0°, maps to -180..180°
    const satP = sl(p.oilSat, 50) / 100; // 0.5 = 1×, maps to 0..2×
    const lightP = sl(p.oilLight, 50) / 100; // 0.5 = 0, maps to -0.2..0.2
    const depthP = sl(p.oilDepth, 47) / 100; // maps to 0.3..1.8× (47 ≈ 1.0)
    const driftP = sl(p.oilDrift, 40) / 100; // maps to 0..60 (40 = the study's 24)

    // ── (3) FLICKER-FREE motion params — gated, SPACE only ────────────────────
    const ANIM = anim.anim;
    const swayA = sl(p.oilSway, 50) / 100; // Camera
    const flowP = sl(p.oilFlow, 35) / 100; // Tide drift
    const dissolveP = sl(p.oilDissolve, 45) / 100; // Tide reach
    const parallaxP = sl(p.oilParallax, 55) / 100; // plane separation
    const cloudP = sl(p.oilClouds, 45) / 100; // cloud drift
    const swellP = sl(p.oilSwell, 40) / 100; // paint swell
    const shimP = sl(p.oilShimmer, 30) / 100; // heat shimmer
    const crushP = sl(p.oilCrush, 50) / 100; // crush pulse

    // ── (4) Cache key — names every input the builds read, nothing more ────────
    keyTmp[0] = fin(seed);
    keyTmp[1] = sceneIdx;
    keyTmp[2] = brushIdx;
    keyTmp[3] = fin(horizonP);
    keyTmp[4] = fin(ridgesP);
    keyTmp[5] = fin(peaksP);
    keyTmp[6] = fin(roughP);
    keyTmp[7] = fin(skyP);
    keyTmp[8] = fin(paintP);
    keyTmp[9] = fin(strokeP);
    keyTmp[10] = fin(opacityP);
    keyTmp[11] = fin(toothP);
    keyTmp[12] = fin(bitP);
    keyTmp[13] = fin(cellP);
    keyTmp[14] = fin(stepsP);
    keyTmp[15] = fin(splitP);
    keyTmp[16] = fin(accentP);
    keyTmp[17] = fin(sweepSl);
    keyTmp[18] = paletteIdx;
    keyTmp[19] = fin(hueP);
    keyTmp[20] = fin(satP);
    keyTmp[21] = fin(lightP);
    keyTmp[22] = fin(depthP);
    keyTmp[23] = fin(driftP);

    let ref = findRef();
    if (!ref) {
      // A miss: build the spec (the palette ramps are only ever graded here) and
      // the size-independent memo, then slot it over the LRU entry.
      const horizon = clamp((0.15 + horizonP * 0.75) * 0.5 + mod.hz * 0.5, 0.12, 0.9);
      const haze = skyP * 3 * mod.hazeMul;
      const pal = OIL_PALETTES[PALETTE_IDS[paletteIdx]];
      const hueDeg = (hueP - 0.5) * 360;
      const satMul = satP * 2;
      const lightAdd = (lightP - 0.5) * 0.4;
      // Depth spread (painter.ts's `contrast`): how hard distance washes toward
      // the sky, and the per-depth lightness lift on ridges and bands.
      const depthContrast = 0.3 + depthP * 1.5;
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
        drift: driftP * 60,
        cellU: 6 + cellP * 66,
        steps: 2 + Math.round(stepsP * 22),
        split: splitP,
        bit: bitP,
        sweep: sweepSl,
        accent: accentP,
        sx,
        sy,
        pal,
        hueDeg,
        satMul,
        lightAdd,
        ramps: rampsFromPalette(pal, hueDeg, satMul, lightAdd, scene),
      };
      ref = buildRef(spec, noise, seed);
      if (!ref) return;
      slotRef(ref);
    }
    const B = bucketOf(S);
    const slot = ensureRaster(B, ref, noise, seed);
    if (!slot) return;
    const horizon = ref.spec.horizon;

    // ── (5) Per-frame motion scalars — every one EXACTLY 0 / 1 at frame 0 ─────
    let tx = 0;
    let ty = 0;
    let sc = 1;
    let F = 0; // tide front, from the crushed edge (t=1) toward the painted edge (t=0)
    let G = 0; // participation gate
    let breath = 1;
    let accentScl = 1; // accent cells pop on the kick
    let cloudDx = 0; // sky plane slide (cloud drift), px
    let swellA = 0; // near-plane swell amplitude, px (clip-gated)
    let swellK = 0; // near-plane kick push, px
    let shimA = 0; // far-plane shimmer amplitude, px (clip-gated)
    let psi = 0;
    if (ANIM) {
      const phi = anim.loopPhase;
      psi = clipPhaseOf(anim, p);
      const b = anim.beat;
      // Track mode: `beat` is an onset FEATURE (strength), not a phase — the
      // phase-shaped attack / release below would zero the kick exactly on the
      // hits, so the audio springs are taken as they come.
      const isTrack = anim.track === true;
      const kickS = Math.min(anim.kickEnv, 1.4) * (isTrack ? 1 : att(b, 0.1));
      const pumpS = Math.min(anim.pumpEnv, 1.4) * (isTrack ? 1 : att(b, 0.2));
      // The spring is released over the last quarter of the beat so the shove is
      // 0 at BOTH b = 0 and b -> 1: the damped cosine is not 0 as the beat wraps,
      // and without the release the camera stepped at every beat seam.
      const springS =
        clamp(anim.kickSpring, -1.2, 1.2) * (isTrack ? 1 : att(b, 0.1) * Math.min(1, 4 * (1 - b)));
      // The Drift group — Wander / Swirl / Speed sliders in BPM mode, the live
      // mid / high / energy features in Track mode. AMPLITUDE only, never a
      // rate: a rate would break the clip seam.
      const driftA = clamp(anim.drift, 0, 1.2);
      const swirlA = clamp(anim.swirl, 0, 1.2);
      const speedA = clamp(anim.speed, 0, 1.4);
      const envT = 0.5 * (1 - Math.cos(TAU * psi)); // the tide / the clip
      const envC = 0.5 * (1 - Math.cos(TAU * phi)); // the cycle breath
      const cs = Math.cos(TAU * psi);
      const sn = Math.sin(TAU * psi);
      const surge = Math.min(1, 6 * envT); // gates every beat-driven term to 0 at ψ = 0

      // CLOUDS drift across the sky plane over the clip (sin 2πψ is 0 at the seam
      // and C¹ through it); energy widens the drift a little.
      cloudDx = S * 0.035 * cloudP * (0.6 + 0.4 * speedA) * sn;
      // SWELL — a travelling wave pushes the near paint sideways, strip by strip.
      // Its amplitude rides the clip envelope (so frame 0 is the still) with a
      // kick push on top; Wander (mids) scales it.
      swellA = S * 0.009 * swellP * (0.5 + 0.5 * driftA) * envT;
      swellK = S * 0.005 * swellP * kickS * surge;
      // SHIMMER — the far plane wobbles like heat; Swirl (highs) scales it.
      shimA = S * 0.0035 * shimP * (0.4 + 0.6 * swirlA) * envT;

      // CAMERA — one plane, no roll (a lens roll on a painting reads as shake).
      // Wander on a closed noise circle over the clip, a lean WITH the tide toward
      // the painted edge, a signed overshoot-and-settle shove on the kick, a dip
      // on kick + pump, and a slow push-in (clip) + cycle breath + beat zoom.
      const panX = S * 0.032 * swayA * nzc(noise, cam.camx, cam.camy, cs, sn, LANE_PANX);
      const panY = S * 0.022 * swayA * nzc(noise, cam.camx, cam.camy, cs, sn, LANE_PANY);
      const lean = S * 0.01 * swayA * envT;
      const shove = S * 0.004 * swayA * springS;
      const dipY = S * 0.006 * (0.5 * kickS + 0.5 * pumpS);
      tx = panX - sx * lean + sx * shove;
      ty = panY - sy * lean + sy * shove + dipY;
      // Beat zoom is deliberately NOT scaled by Camera (the Kick / Pump sliders own
      // beat amplitude, as in contours): Camera 0 is a locked-off frame that still
      // nods on the beat — and ONLY on the beat (the clip push-in and the cycle
      // breath both scale with Camera, so at 0 the frame is static between beats).
      sc = 1 + 0.026 * swayA * envT + 0.01 * swayA * envC + 0.012 * pumpS + 0.008 * kickS;

      // TIDE + CRUSH PULSE — the front rides envT out to REACH and back; the kick
      // surge (and the bass surge the Crush slider adds) is gated by `surge` so F
      // is EXACTLY 0 at ψ = 0 for any kick. Cells breathe on the kick / bass and
      // the accent cells pop on the kick, more when the highs are hot.
      G = BOOST_MAX * Math.pow(dissolveP, 1.5);
      const reach = 0.9 + 0.9 * dissolveP;
      F = reach * envT + (KSURGE * kickS + 0.25 * crushP * pumpS) * surge;
      breath =
        1 +
        Math.min(
          BREATH_MAX + 0.04 * crushP,
          dissolveP * (KBREATH * kickS + PBREATH * pumpS) + crushP * (0.05 * kickS + 0.03 * pumpS),
        );
      accentScl = 1 + 0.12 * crushP * kickS * (0.4 + 0.6 * swirlA) * surge;
    }

    ctx.save();
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";

    // ── (6) CAMERA, per plane, about the horizon pivot (a push-in grows land
    // downward and sky upward). The near plane takes the whole camera; the far
    // and sky planes lag it by Parallax — a dolly through the painting. |tx| ≤
    // 0.047·S, |ty| ≤ 0.040·S, sc ≥ 1 about an interior pivot ⇒ never samples
    // outside the 6 % overscan. Skipped when it is the identity, so the still
    // and frame 0 share one path.
    const px = 0.5 * S;
    const py = horizon * S;
    const planeXf = (z: number): void => {
      const t = 1 - (1 - z) * parallaxP; // this plane's share of the camera
      const ptx = tx * t;
      const pty = ty * t;
      const psc = 1 + (sc - 1) * t;
      if (ptx !== 0 || pty !== 0 || psc !== 1) {
        ctx.translate(px + ptx, py + pty);
        ctx.scale(psc, psc);
        ctx.translate(-px, -py);
      }
    };

    // ── (7) the painted planes — 1:1 at an integer offset when S is their
    // bucket (the still), else one smoothed scaled blit each (the planes are the
    // only thing resampled; strokes are baked into them, the cells are vectors).
    const k = S / B;
    const Mb = slot.Mb;
    const Bo = B + 2 * Mb;
    const blit = (c: HTMLCanvasElement, dx: number): void => {
      if (k === 1) ctx.drawImage(c, -Mb + dx, -Mb);
      else ctx.drawImage(c, -Mb * k + dx, -Mb * k, Bo * k, Bo * k);
    };
    // A plane in `n` horizontal strips, each pushed sideways by `off(i, yMid)`
    // (yMid in frame fractions) — the swell and the shimmer. Rows map 1:1 to the
    // plane's pixels through k, so at rest this is the plain blit.
    const strips = (c: HTMLCanvasElement, n: number, off: (i: number, ym: number) => number): void => {
      const rowsPer = Bo / n;
      for (let i = 0; i < n; i++) {
        const sy0 = Math.floor(i * rowsPer);
        const sy1 = i === n - 1 ? Bo : Math.floor((i + 1) * rowsPer);
        const dx = off(i, ((sy0 + sy1) * 0.5 - Mb) / B);
        ctx.drawImage(c, 0, sy0, Bo, sy1 - sy0, -Mb * k + dx, (sy0 - Mb) * k, Bo * k, (sy1 - sy0) * k);
      }
    };

    const pe = ref.cellPlaneEnd;
    if (slot.merged) {
      // Still-only raster: one plane, the full camera (it never animates).
      planeXf(1);
      blit(slot.planes[0], 0);
      drawCells(ctx, S, ref, 0, ref.cellCount, F, G, breath, accentScl, flowP, sx, sy);
    } else {
      // sky + clouds — drifting
      ctx.save();
      planeXf(1 - PX_SKY);
      blit(slot.planes[0], cloudDx);
      drawCells(ctx, S, ref, 0, pe[0], F, G, breath, accentScl, flowP, sx, sy);
      ctx.restore();
      // far ridges — shimmering
      ctx.save();
      planeXf(1 - PX_FAR);
      if (shimA !== 0) {
        strips(slot.planes[1], SHIM_STRIPS, (i) => shimA * Math.sin(TAU * 3 * psi + i * 1.7 + cam.camx));
      } else {
        blit(slot.planes[1], 0);
      }
      drawCells(ctx, S, ref, pe[0], pe[1], F, G, breath, accentScl, flowP, sx, sy);
      ctx.restore();
      // near land — the swell
      ctx.save();
      planeXf(1);
      if (swellA !== 0 || swellK !== 0) {
        strips(
          slot.planes[2],
          SWELL_STRIPS,
          (_, ym) => swellA * Math.sin(TAU * (2 * psi - 1.6 * ym)) + swellK * Math.sin(TAU * (0.25 - 1.6 * ym)),
        );
      } else {
        blit(slot.planes[2], 0);
      }
      drawCells(ctx, S, ref, pe[1], pe[2], F, G, breath, accentScl, flowP, sx, sy);
      ctx.restore();
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
    { key: "oilDepth", label: "DEPTH", type: "range", group: "composition", min: 0, max: 100, default: 47 },
    {
      key: "oilPalette",
      label: "PALETTE",
      type: "select",
      group: "palette",
      default: "paper",
      options: [
        { value: "paper", label: "PAPER" },
        { value: "dusk", label: "DUSK" },
        { value: "ash", label: "ASH" },
      ],
    },
    { key: "oilHue", label: "HUE", type: "range", group: "palette", min: 0, max: 100, default: 50 },
    { key: "oilSat", label: "SATURATION", type: "range", group: "palette", min: 0, max: 100, default: 50 },
    { key: "oilLight", label: "LIGHT", type: "range", group: "palette", min: 0, max: 100, default: 50 },
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
    { key: "oilDrift", label: "COLOUR DRIFT", type: "range", group: "texture", min: 0, max: 100, default: 40 },
    { key: "oilBit", label: "CELL DENSITY", type: "range", group: "composition", min: 0, max: 100, default: 43 },
    { key: "oilCell", label: "CELL SIZE", type: "range", group: "composition", min: 0, max: 100, default: 27 },
    { key: "oilSteps", label: "COLOUR STEPS", type: "range", group: "composition", min: 0, max: 100, default: 18 },
    { key: "oilSplit", label: "SUBDIVIDE", type: "range", group: "composition", min: 0, max: 100, default: 42 },
    { key: "oilAccent", label: "ACCENT CELLS", type: "range", group: "composition", min: 0, max: 100, default: 4 },
    { key: "oilSweep", label: "DISSOLVE SWEEP", type: "range", group: "composition", min: 0, max: 100, default: 53 },
    { key: "oilSway", label: "CAMERA", type: "range", group: "motion", min: 0, max: 100, default: 50 },
    { key: "oilParallax", label: "PARALLAX", type: "range", group: "motion", min: 0, max: 100, default: 55 },
    { key: "oilClouds", label: "CLOUD DRIFT", type: "range", group: "motion", min: 0, max: 100, default: 45 },
    { key: "oilSwell", label: "PAINT SWELL", type: "range", group: "motion", min: 0, max: 100, default: 40 },
    { key: "oilShimmer", label: "HEAT SHIMMER", type: "range", group: "motion", min: 0, max: 100, default: 30 },
    { key: "oilDissolve", label: "TIDE REACH", type: "range", group: "motion", min: 0, max: 100, default: 45 },
    { key: "oilFlow", label: "TIDE DRIFT", type: "range", group: "motion", min: 0, max: 100, default: 35 },
    { key: "oilCrush", label: "CRUSH PULSE", type: "range", group: "motion", min: 0, max: 100, default: 50 },
  ];
}

registerEngine(oil);

export default oil;
