import type { FieldArgs, FieldEngine, ParamDef, RNG } from "../types";
import { registerEngine } from "../registry";
import { prng } from "../prng";
import { rgba } from "../color";

// CONTOURS field — topographic iso-lines (level sets) of a smooth, seeded
// sum-of-sines scalar field, traced with marching squares. The field slowly
// MORPHS over time (each wave's phase advances) and the beat gently zooms the
// sampling space, so the lines reorganise like a living topographic map.
//
// THE TWO HARD RULES:
//  • Deterministic — every wave's angle / frequency / phase / speed is drawn
//    from the seed (prng) in a STABLE order, BEFORE any time math. So the same
//    (seed, params) always reproduces the same surface.
//  • Flicker-free — all motion is gated by anim.anim and only ever moves SPACE
//    (phases advance; the beat zooms / drift pans the sampling coords). Line
//    colour, width and alpha are time-INDEPENDENT, so nothing ever strobes.

const NWAVES = 6;
const TAU = Math.PI * 2;

interface Wave {
  ax: number; // unit direction x
  ay: number; // unit direction y
  w: number; // spatial frequency (cycles across the field)
  ph: number; // seeded phase
  sp: number; // morph speed (phase advance per unit time)
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

    const scale = (p.contourScale == null ? 45 : p.contourScale) / 100;
    const warpAmt = ((p.contourWarp == null ? 35 : p.contourWarp) / 100) * 0.5;
    const baseFreq = 1.4 + scale * 6.5;

    const waves: Wave[] = [];
    for (let i = 0; i < NWAVES; i++) {
      const ang = r() * TAU;
      waves.push({
        ax: Math.cos(ang),
        ay: Math.sin(ang),
        w: baseFreq * (0.55 + r() * 1.05),
        ph: r() * TAU,
        sp: 0.12 + r() * 0.5,
      });
    }
    // Two low-frequency components drive the domain warp (wavier contours).
    const mkWarp = (): Wave => {
      const a = r() * TAU;
      return { ax: Math.cos(a), ay: Math.sin(a), w: 1.1 + scale * 1.6, ph: r() * TAU, sp: 0.1 + r() * 0.3 };
    };
    const wX = mkWarp();
    const wY = mkWarp();

    // ── (2) FLICKER-FREE motion — gated by ANIM, moves SPACE only ─────────────
    const ANIM = anim.anim;
    const morph = ANIM ? (p.contourMorph == null ? 50 : p.contourMorph) / 100 : 0;
    const T = ANIM ? anim.t * morph : 0;
    // Beat zoom about centre: contours breathe in/out on the kick (space, not glow).
    const zoom = ANIM ? 1 - (anim.kickEnv * 0.05 + anim.kickSpring * 0.035) : 1;
    // Slow drift pan of the whole field.
    const driftX = ANIM ? anim.drift * 0.15 * Math.sin(anim.t * 0.2) : 0;
    const driftY = ANIM ? anim.drift * 0.15 * Math.cos(anim.t * 0.17) : 0;

    // Scalar field at normalised (nx,ny) in [0,1] -> ~[-1,1]. Domain-warped sum
    // of sines; advancing T morphs the surface.
    const fieldAt = (nx: number, ny: number): number => {
      let x = (nx - 0.5) * zoom + 0.5 + driftX;
      let y = (ny - 0.5) * zoom + 0.5 + driftY;
      if (warpAmt > 0) {
        const dx = Math.sin((x * wX.ax + y * wX.ay) * wX.w * TAU + wX.ph + T * wX.sp);
        const dy = Math.sin((x * wY.ax + y * wY.ay) * wY.w * TAU + wY.ph + T * wY.sp);
        x += dx * warpAmt;
        y += dy * warpAmt;
      }
      let s = 0;
      for (let i = 0; i < NWAVES; i++) {
        const wv = waves[i];
        s += Math.sin((x * wv.ax + y * wv.ay) * wv.w * TAU + wv.ph + T * wv.sp);
      }
      return s / NWAVES;
    };

    // ── (3) Composition: line count + weight ──────────────────────────────────
    const lv = (p.contourLines == null ? 55 : p.contourLines) / 100;
    const L = 3 + Math.round(lv * 21); // 3..24 iso-levels
    const weight = (0.6 + ((p.contourWeight == null ? 40 : p.contourWeight) / 100) * 3.2) * (S / 880);

    // Marching-squares grid. Resolution-independent of the canvas backing size,
    // so it looks the same in a cheap "draft"/animation frame as in the export.
    const G = 124;
    const cell = S / G;
    const stride = G + 1;
    const grid = new Float32Array(stride * stride);
    for (let j = 0; j <= G; j++) {
      for (let i = 0; i <= G; i++) {
        grid[j * stride + i] = fieldAt(i / G, j / G);
      }
    }

    ctx.save();
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    ctx.lineWidth = weight;

    const colors = cfg.colors.length ? cfg.colors : [cfg.base];
    for (let l = 0; l < L; l++) {
      // Levels spread across the field range, skipping the flat extremes.
      const lev = -0.85 + ((l + 0.5) / L) * 1.7;
      const col = colors[l % colors.length];
      // Alpha is constant per level (deterministic, NEVER time-based -> no flicker).
      ctx.strokeStyle = rgba(col, 0.85);
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
          // Linear edge-crossing coords (only the ones the case uses are drawn).
          const tX = x0 + cell * ((lev - tl) / (tr - tl)); // top edge
          const rY = y0 + cell * ((lev - tr) / (br - tr)); // right edge
          const bX = x0 + cell * ((lev - bl) / (br - bl)); // bottom edge
          const lY = y0 + cell * ((lev - tl) / (bl - tl)); // left edge
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
    { key: "contourWarp", label: "WARP", type: "range", group: "composition", min: 0, max: 100, default: 35 },
    { key: "contourMorph", label: "MORPH SPEED", type: "range", group: "motion", min: 0, max: 100, default: 50 },
  ];
}

registerEngine(contours);

export default contours;
