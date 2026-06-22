import type { FieldArgs, FieldEngine, ParamDef, RNG } from "../types";
import { registerEngine } from "../registry";
import { prng } from "../prng";
import { rgba } from "../color";

// CONTOURS field — topographic iso-lines (level sets) of a SEEDED 3D value-noise
// field, traced with marching squares. The third noise axis is TIME, so as it
// advances the 2D slice genuinely reorganises — hills rise, basins fill, ridges
// split and merge — instead of a flat pattern sliding by. Domain warping breaks
// up any regularity so the lines read organic, not linear.
//
// THE TWO HARD RULES:
//  • Deterministic — the noise hash + all offsets derive from the seed (prng,
//    consumed up front in a stable order). Same (seed, params, t) => same frame.
//  • Flicker-free — motion is gated by anim.anim and only ever moves SPACE (the
//    field evolves / pans / zooms => the LINES move). Colour, width and alpha are
//    time-INDEPENDENT, so nothing strobes.

const TAU = Math.PI * 2;

function fade(t: number): number {
  return t * t * t * (t * (t * 6 - 15) + 10); // quintic smoothstep
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

    // ── (1) DETERMINISTIC — seed stream consumed up front, in a stable order ──
    const r: RNG = prng(seed ^ 0x51c2a7d3);
    const seedHash = (Math.floor(r() * 0xffffffff) ^ (seed * 0x9e3779b1)) | 0;
    const ox = r() * 128;
    const oy = r() * 128;
    const oz = r() * 128;
    const wox = r() * 128;
    const woy = r() * 128;
    const flowDir = r() * TAU; // seeded lateral-flow direction

    // 3D integer-lattice value noise. hash3 -> [0,1) per lattice point; trilinear
    // blend with a quintic fade for smooth, organic hills (no grid artefacts).
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

    // ── (2) FLICKER-FREE motion — gated by ANIM, moves SPACE only ─────────────
    const ANIM = anim.anim;
    const morph = (p.contourMorph == null ? 55 : p.contourMorph) / 100;
    const flow = (p.contourFlow == null ? 35 : p.contourFlow) / 100;
    // Time advances the noise's Z axis -> the surface genuinely morphs.
    const zT = ANIM ? oz + anim.t * (0.05 + morph * 0.55) : oz;
    // Lateral pan (seeded direction) so the whole landscape drifts across.
    const flowD = ANIM ? anim.t * flow * 0.08 : 0;
    const flowX = Math.cos(flowDir) * flowD;
    const flowY = Math.sin(flowDir) * flowD;
    // Beat zoom about centre: contours breathe in/out on the kick (space).
    const zoom = ANIM ? 1 - (anim.kickEnv * 0.05 + anim.kickSpring * 0.035) : 1;
    const driftX = ANIM ? anim.drift * 0.12 * Math.sin(anim.t * 0.2) : 0;
    const driftY = ANIM ? anim.drift * 0.12 * Math.cos(anim.t * 0.17) : 0;

    // ── (3) Composition shaping params ────────────────────────────────────────
    const scale = (p.contourScale == null ? 45 : p.contourScale) / 100;
    const detail = (p.contourDetail == null ? 50 : p.contourDetail) / 100;
    const warp = (p.contourWarp == null ? 50 : p.contourWarp) / 100;
    const relief = (p.contourRelief == null ? 30 : p.contourRelief) / 100;
    const baseFreq = 1.8 + scale * 5.6;
    const octaves = 2 + Math.round(detail * 3); // 2..5
    const warpAmt = warp * 1.1;

    // Scalar field at normalised (nx,ny) in [0,1] -> ~[-1,1].
    const fieldAt = (nx: number, ny: number): number => {
      let x = (nx - 0.5) * zoom + 0.5 + driftX + flowX;
      let y = (ny - 0.5) * zoom + 0.5 + driftY + flowY;
      // Domain warp: offset the sample point by a low-octave noise vector. This
      // is what kills the "linear" look — straight bands become swirled ridges.
      if (warpAmt > 0) {
        const wx = fbm((x + wox) * baseFreq * 0.5, (y + woy) * baseFreq * 0.5, zT, 2) - 0.5;
        const wy = fbm((x + wox + 6.2) * baseFreq * 0.5, (y + woy + 9.1) * baseFreq * 0.5, zT, 2) - 0.5;
        x += wx * warpAmt;
        y += wy * warpAmt;
      }
      let v = fbm((x + ox) * baseFreq, (y + oy) * baseFreq, zT, octaves); // [0,1]
      // Relief: blend toward a RIDGED transform (sharp peaks / canyons) so the
      // topography isn't all rounded hills.
      if (relief > 0) {
        const ridge = 1 - Math.abs(2 * v - 1);
        v = lerp(v, ridge, relief);
      }
      return v * 2 - 1; // ~[-1,1]
    };

    // Line count + weight.
    const lv = (p.contourLines == null ? 55 : p.contourLines) / 100;
    const L = 4 + Math.round(lv * 22); // 4..26 iso-levels
    const weight = (0.5 + ((p.contourWeight == null ? 40 : p.contourWeight) / 100) * 3.2) * (S / 880);

    // Marching-squares grid (resolution-independent of the canvas backing size).
    const G = 124;
    const cell = S / G;
    const stride = G + 1;
    const grid = new Float32Array(stride * stride);
    let mn = Infinity, mx = -Infinity;
    for (let j = 0; j <= G; j++) {
      for (let i = 0; i <= G; i++) {
        const val = fieldAt(i / G, j / G);
        grid[j * stride + i] = val;
        if (val < mn) mn = val;
        if (val > mx) mx = val;
      }
    }
    // ADAPTIVE level placement: spread the levels across the field's ACTUAL range
    // (with a small inset) so every level is crossed and the contour density stays
    // rich regardless of how the noise distributes this frame.
    const span = mx - mn;
    const lo = mn + span * 0.04;
    const hi = mx - span * 0.04;

    ctx.save();
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    ctx.lineWidth = weight;

    const colors = cfg.colors.length ? cfg.colors : [cfg.base];
    for (let l = 0; l < L; l++) {
      const lev = lo + ((l + 0.5) / L) * (hi - lo);
      const col = colors[l % colors.length];
      ctx.strokeStyle = rgba(col, 0.85); // alpha constant -> never flickers
      ctx.beginPath();
      for (let j = 0; j < G; j++) {
        const row = j * stride;
        for (let i = 0; i < G; i++) {
          const a0 = row + i;
          const tl = grid[a0];
          const tr = grid[a0 + 1];
          const bl = grid[a0 + stride];
          const br = grid[a0 + stride + 1];
          let cse = 0;
          if (tl > lev) cse |= 8;
          if (tr > lev) cse |= 4;
          if (br > lev) cse |= 2;
          if (bl > lev) cse |= 1;
          if (cse === 0 || cse === 15) continue;
          const x0 = i * cell;
          const y0 = j * cell;
          const x1 = x0 + cell;
          const y1 = y0 + cell;
          const tX = x0 + cell * ((lev - tl) / (tr - tl));
          const rY = y0 + cell * ((lev - tr) / (br - tr));
          const bX = x0 + cell * ((lev - bl) / (br - bl));
          const lY = y0 + cell * ((lev - tl) / (bl - tl));
          switch (cse) {
            case 1: ctx.moveTo(x0, lY); ctx.lineTo(bX, y1); break;
            case 2: ctx.moveTo(bX, y1); ctx.lineTo(x1, rY); break;
            case 3: ctx.moveTo(x0, lY); ctx.lineTo(x1, rY); break;
            case 4: ctx.moveTo(tX, y0); ctx.lineTo(x1, rY); break;
            case 5: ctx.moveTo(tX, y0); ctx.lineTo(x1, rY); ctx.moveTo(bX, y1); ctx.lineTo(x0, lY); break;
            case 6: ctx.moveTo(tX, y0); ctx.lineTo(bX, y1); break;
            case 7: ctx.moveTo(tX, y0); ctx.lineTo(x0, lY); break;
            case 8: ctx.moveTo(tX, y0); ctx.lineTo(x0, lY); break;
            case 9: ctx.moveTo(tX, y0); ctx.lineTo(bX, y1); break;
            case 10: ctx.moveTo(tX, y0); ctx.lineTo(x0, lY); ctx.moveTo(bX, y1); ctx.lineTo(x1, rY); break;
            case 11: ctx.moveTo(tX, y0); ctx.lineTo(x1, rY); break;
            case 12: ctx.moveTo(x0, lY); ctx.lineTo(x1, rY); break;
            case 13: ctx.moveTo(bX, y1); ctx.lineTo(x1, rY); break;
            case 14: ctx.moveTo(x0, lY); ctx.lineTo(bX, y1); break;
          }
        }
      }
      ctx.stroke();
    }
    ctx.restore();
  },
};

function contourParams(): ParamDef[] {
  return [
    { key: "contourLines", label: "LINES", type: "range", group: "composition", min: 0, max: 100, default: 55 },
    { key: "contourWeight", label: "LINE WEIGHT", type: "range", group: "composition", min: 0, max: 100, default: 40 },
    { key: "contourScale", label: "FIELD SCALE", type: "range", group: "composition", min: 0, max: 100, default: 45 },
    { key: "contourDetail", label: "DETAIL", type: "range", group: "composition", min: 0, max: 100, default: 50 },
    { key: "contourWarp", label: "WARP", type: "range", group: "composition", min: 0, max: 100, default: 50 },
    { key: "contourRelief", label: "RELIEF", type: "range", group: "composition", min: 0, max: 100, default: 30 },
    { key: "contourMorph", label: "MORPH SPEED", type: "range", group: "motion", min: 0, max: 100, default: 55 },
    { key: "contourFlow", label: "FLOW", type: "range", group: "motion", min: 0, max: 100, default: 35 },
  ];
}

registerEngine(contours);

export default contours;
