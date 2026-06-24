import type { FieldArgs, FieldEngine, ParamDef, RNG } from "../types";
import { registerEngine } from "../registry";
import { prng } from "../prng";
import { rgb, rgba } from "../color";

// CONTOURS — a 3D heightfield terrain rendered as elevation ridgelines. A seeded
// fbm value-noise field is treated as a landscape; each "row" is a depth slice
// drawn as a polyline that rides the terrain height, projected with perspective
// (rows recede + converge toward a horizon). Hidden-line removal (painter's
// floating-horizon: fill under each ridge with the background, back-to-front) makes
// near ridges occlude the valleys behind them, so it reads as a real 3D surface —
// not a flat map. Depth fade adds atmospheric perspective.
//
// THE TWO HARD RULES:
//  • Deterministic — the noise hash + offsets derive from the seed (prng, drawn
//    up front in a stable order). Same (seed, params, t) => same frame.
//  • Flicker-free — motion is gated by anim.anim and only moves SPACE (the terrain
//    morphs, scrolls toward the camera, and lifts on the beat — the RIDGES move).
//    Line colour + alpha are time-independent (depth fade is positional), so
//    nothing ever strobes.

function fade(t: number): number {
  return t * t * t * (t * (t * 6 - 15) + 10);
}
function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

const contours: FieldEngine = {
  id: "contours",
  label: "Contours",
  kind: "2d",
  params: contourParams(),
  field(args: FieldArgs): void {
    const { ctx, size: S, params: p, cfg, seed, anim } = args;

    // ── (1) DETERMINISTIC — seed stream up front, stable order ────────────────
    const r: RNG = prng(seed ^ 0x51c2a7d3);
    const seedHash = (Math.floor(r() * 0xffffffff) ^ (seed * 0x9e3779b1)) | 0;
    const ox = r() * 128;
    const oy = r() * 128;
    const oz = r() * 128;
    const wox = r() * 128;
    const woy = r() * 128;
    // Macro-camera phases — drawn AFTER the offset stream so seedHash/offsets are
    // unchanged (still deterministic); only used by the ANIM-gated camera below.
    const camx = r() * 6.2832;
    const camy = r() * 6.2832;

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
      let a = 0.5, f = 1, s = 0, n = 0;
      for (let i = 0; i < oct; i++) {
        s += a * vnoise(x * f, y * f, z * f);
        n += a;
        f *= 2.0;
        a *= 0.5;
      }
      return s / n; // [0,1]
    };

    // ── (2) Shaping params ────────────────────────────────────────────────────
    const scale = (p.contourScale == null ? 45 : p.contourScale) / 100;
    const detail = (p.contourDetail == null ? 50 : p.contourDetail) / 100;
    const warp = (p.contourWarp == null ? 50 : p.contourWarp) / 100;
    const relief = (p.contourRelief == null ? 30 : p.contourRelief) / 100;
    const linesP = (p.contourLines == null ? 55 : p.contourLines) / 100;
    const weightP = (p.contourWeight == null ? 40 : p.contourWeight) / 100;
    // FILL — colour strata under each ridge (0 = original bg-occlusion look).
    const fillAmt = (p.contourFill == null ? 60 : p.contourFill) / 100;
    const swayP = (p.contourSway == null ? 50 : p.contourSway) / 100;
    const liftP = (p.contourLift == null ? 55 : p.contourLift) / 100;
    const baseFreq = 1.6 + scale * 5.0;
    const octaves = 2 + Math.round(detail * 3);
    const warpAmt = warp * 1.0;

    // ── (3) FLICKER-FREE motion — gated, SPACE only ───────────────────────────
    const ANIM = anim.anim;
    const morph = (p.contourMorph == null ? 55 : p.contourMorph) / 100;
    const flow = (p.contourFlow == null ? 35 : p.contourFlow) / 100;
    const zT = oz + (ANIM ? anim.t * (0.04 + morph * 0.4) : 0); // terrain morph
    const scroll = ANIM ? anim.t * flow * 0.42 : 0; // fly forward (rows scroll in)
    const T = ANIM ? anim.t : 0;
    // Audio-/beat-driven deformations — rich + layered + SPACE-only. In Track
    // mode these envelopes are pulled straight from the music's bands; in BPM
    // mode from the Beat/Drift sliders. pump≈bass/energy, kick≈onsets,
    // drift≈mids, swirl≈highs. Each shapes the landscape a different way.
    const kickEnv = anim.kickEnv;
    const kickSpring = anim.kickSpring;
    // bass swells the relief; a slow sine breathes it even on the BPM path (T=0
    // when still, so this stays exactly 1.0 for the still render).
    const swell = 1 + anim.pumpEnv * 0.7 + 0.06 * Math.sin(T * 0.5);
    const beatLift = (kickEnv * 0.26 + kickSpring * 0.16) * (0.4 + liftP * 1.2); // beat lifts the terrain
    const midSwayA = ANIM ? anim.drift * 0.16 : 0; // mids warp it sideways
    const shimmerA = ANIM ? anim.swirl * 0.045 : 0; // highs add fine surface ripple

    // Terrain height at normalised (nx across, ny depth) -> [0,1] above ground.
    const height = (nx: number, ny: number): number => {
      let x = nx, y = ny;
      if (warpAmt > 0) {
        const dx = fbm((x + wox) * baseFreq * 0.5, (y + woy) * baseFreq * 0.5, zT, 2) - 0.5;
        const dy = fbm((x + wox + 6.2) * baseFreq * 0.5, (y + woy + 9.1) * baseFreq * 0.5, zT, 2) - 0.5;
        x += dx * warpAmt;
        y += dy * warpAmt;
      }
      const v = fbm((x + ox) * baseFreq, (y + oy) * baseFreq, zT, octaves);
      return Math.pow(v, 1.15); // a touch of contrast for defined peaks
    };

    // ── (4) Perspective heightfield render ────────────────────────────────────
    const R = 28 + Math.round(linesP * 42); // depth rows (ridgelines)
    const C = 160; // columns per ridgeline
    const horizonY = S * 0.18; // far edge near the top
    const nearY = S * 1.03; // near edge just past the bottom
    const cx = S * 0.5;
    const spread = S * 0.98; // terrain width at the front
    const hMax = S * (0.10 + relief * 0.46); // vertical relief (the "3D-ness")
    const weight = (0.5 + weightP * 3.0) * (S / 880);

    const baseRGB = rgb(cfg.base);
    const colors = cfg.colors.length ? cfg.colors : [cfg.base];

    ctx.save();
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    // MACRO CAMERA — parallax sway + vertical bob + breathing zoom + micro-roll so
    // the whole blurred terrain visibly moves. ANIM-gated => the still is unchanged.
    // swayP carries an always-on component so it drifts even when the audio path's
    // drift/swirl envelopes sit near zero in quiet passages.
    if (ANIM) {
      const camDrift = 0.35 * swayP + 0.45 * anim.drift + 0.35 * anim.swirl + 0.4 * flow;
      const camTX = S * 0.032 * camDrift * Math.sin(T * 0.19 + camx);
      const camTY =
        S * 0.020 * (0.4 * swayP + anim.drift) * Math.sin(T * 0.14 + camy) +
        S * 0.024 * liftP * (kickEnv * 0.5 + anim.pumpEnv * 0.5);
      const camSC = 1 + 0.035 * anim.pumpEnv + 0.022 * swayP * Math.sin(T * 0.27);
      const camROT = 0.010 * (anim.swirl + 0.4 * swayP) * Math.sin(T * 0.09 + camx);
      ctx.translate(S * 0.5 + camTX, S * 0.5 + camTY);
      ctx.rotate(camROT);
      ctx.scale(camSC, camSC);
      ctx.translate(-S * 0.5, -S * 0.5);
    }

    const xs = new Float32Array(C);
    const ys = new Float32Array(C);

    // Back (ri=0) to front (ri=R-1). Each row fills under its ridge with the
    // background colour (occluding everything farther back + lower), then strokes
    // the ridgeline on top.
    for (let ri = 0; ri < R; ri++) {
      const depth = R > 1 ? ri / (R - 1) : 1; // 0 back .. 1 front
      const perspY = Math.pow(depth, 1.6); // rows bunch toward the horizon
      const rowY = horizonY + perspY * (nearY - horizonY);
      const xScale = 0.46 + 0.54 * depth; // back narrower (convergence)
      const hScale = hMax * (0.42 + 0.58 * depth); // back flatter
      const ny = depth * 1.35 + scroll; // sample deeper terrain toward the back

      for (let ci = 0; ci < C; ci++) {
        const nx = ci / (C - 1);
        // mids warp the sampling sideways; bass swells the relief; the beat
        // ripples sweep through depth; highs shimmer on the surface — SPACE only.
        const sway = midSwayA * Math.sin(depth * 4.0 + T * 1.3);
        let h = height(nx + sway, ny) * swell;
        h += kickEnv * 0.2 * Math.sin(depth * 9.0 - T * 4.0);
        h += shimmerA * Math.sin(nx * 38 + T * 7) * Math.cos(depth * 26 - T * 5);
        h += beatLift;
        xs[ci] = cx + (nx - 0.5) * spread * xScale;
        ys[ci] = rowY - h * hScale;
      }

      // STRATA fill: ridge -> down past the bottom -> back. fillAmt=0 paints the
      // background (the original hidden-line occlusion); higher blends in this
      // ridge's palette colour (depth-faded) for a bold layered-terrain look. The
      // skirt extends well off-frame when animating so the camera transform never
      // exposes an unpainted edge (still keeps the original nearY+4).
      const col = colors[ri % colors.length];
      const skirt = ANIM ? S * 1.25 : nearY + 4;
      ctx.beginPath();
      ctx.moveTo(xs[0], ys[0]);
      for (let ci = 1; ci < C; ci++) ctx.lineTo(xs[ci], ys[ci]);
      ctx.lineTo(xs[C - 1], skirt);
      ctx.lineTo(xs[0], skirt);
      ctx.closePath();
      if (fillAmt > 0) {
        const bf = fillAmt * (0.22 + depth * 0.78);
        ctx.fillStyle = rgb([
          Math.round(cfg.base[0] + (col[0] - cfg.base[0]) * bf),
          Math.round(cfg.base[1] + (col[1] - cfg.base[1]) * bf),
          Math.round(cfg.base[2] + (col[2] - cfg.base[2]) * bf),
        ]);
      } else {
        ctx.fillStyle = baseRGB;
      }
      ctx.fill();

      // Ridgeline stroke — palette colour, faded toward the back (atmosphere).
      const a = 0.2 + depth * 0.7;
      ctx.beginPath();
      ctx.moveTo(xs[0], ys[0]);
      for (let ci = 1; ci < C; ci++) ctx.lineTo(xs[ci], ys[ci]);
      ctx.strokeStyle = rgba(col, a);
      // Floor the stroke at ~0.6px so ridgelines stay visible when the field is
      // rendered SMALL (e.g. the 156px gallery variation thumbnails, where the
      // size-scaled weight would otherwise go sub-pixel and the engine looked
      // blank). At full export size the natural weight is always well above this,
      // so the floor never engages and the output is unchanged.
      ctx.lineWidth = Math.max(0.6, weight * (0.45 + depth * 0.85));
      ctx.stroke();
    }
    ctx.restore();
  },
};

function contourParams(): ParamDef[] {
  return [
    { key: "contourLines", label: "RIDGES", type: "range", group: "composition", min: 0, max: 100, default: 55 },
    { key: "contourWeight", label: "LINE WEIGHT", type: "range", group: "composition", min: 0, max: 100, default: 40 },
    { key: "contourScale", label: "TERRAIN SCALE", type: "range", group: "composition", min: 0, max: 100, default: 45 },
    { key: "contourDetail", label: "DETAIL", type: "range", group: "composition", min: 0, max: 100, default: 50 },
    { key: "contourWarp", label: "WARP", type: "range", group: "composition", min: 0, max: 100, default: 50 },
    { key: "contourRelief", label: "HEIGHT", type: "range", group: "composition", min: 0, max: 100, default: 40 },
    { key: "contourFill", label: "FILL", type: "range", group: "composition", min: 0, max: 100, default: 60 },
    { key: "contourMorph", label: "MORPH SPEED", type: "range", group: "motion", min: 0, max: 100, default: 55 },
    { key: "contourFlow", label: "FLY FORWARD", type: "range", group: "motion", min: 0, max: 100, default: 35 },
    { key: "contourSway", label: "CAMERA SWAY", type: "range", group: "motion", min: 0, max: 100, default: 50 },
    { key: "contourLift", label: "BEAT LIFT", type: "range", group: "motion", min: 0, max: 100, default: 55 },
  ];
}

registerEngine(contours);

export default contours;
