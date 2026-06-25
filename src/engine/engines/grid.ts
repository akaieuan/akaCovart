import type { FieldArgs, FieldEngine, ParamDef, RNG } from "../types";
import { registerEngine } from "../registry";
import { prng } from "../prng";
import { rgb } from "../color";

// GRID field — ported from the prototype `fieldGrid`. Motion from AnimState only:
// all motion is EASED + SPACE-ONLY (cell scale / position / displacement). Never
// touches opacity/brightness/hue. The prototype's beat-driven alpha modulation is
// intentionally dropped (no flicker). PHYSICAL motion model (TouchDesigner-style):
//   Ripple  — a wave propagating outward from center, displacing cell scale + radial pos
//   Bob     — per-cell positional oscillation
//   Pop     — springy beat scale pop (kickSpring, signed overshoot)
//   Orbit   — the magnet attractor orbits and its pull pulses with pumpEnv
//   Flow    — a directional traveling shear across columns/rows
const grid: FieldEngine = {
  id: "grid",
  label: "Grid",
  kind: "2d",
  focus: "art",
  params: gridParams(),
  field(args: FieldArgs): void {
    const { ctx, size: S, params: p, cfg, seed, anim } = args;
    const r: RNG = prng(seed ^ 0x51a3c9d7);
    const pick = (a: number[][]): number[] => a[Math.floor(r() * a.length)];

    const cols = Math.max(3, Math.round(p.gridCols == null ? 9 : p.gridCols));
    const dens = (p.gridDensity == null ? 55 : p.gridDensity) / 100;
    const persp = (p.gridPerspective == null ? 0 : p.gridPerspective) / 100;
    const mag = (p.gridMagnet == null ? 0 : p.gridMagnet) / 100;
    const pad = S * 0.06,
      gw = S - pad * 2,
      cell = gw / cols;

    const ANIM = anim.anim;
    const T = ANIM ? anim.t : 0;
    const dr = ANIM ? anim.drift : 0;
    const sw = ANIM ? anim.swirl : 0;
    const kickEnv = anim.kickEnv;

    // motion params (group "motion") — defaults keep still render identical when ANIM off.
    const ripple = ANIM ? (p.gridRipple == null ? 45 : p.gridRipple) / 100 : 0;
    const bob = ANIM ? (p.gridBob == null ? 40 : p.gridBob) / 100 : 0;
    const pop = ANIM ? (p.gridPop == null ? 55 : p.gridPop) / 100 : 0;
    const orbit = ANIM ? (p.gridOrbit == null ? 35 : p.gridOrbit) / 100 : 0;
    const flow = ANIM ? (p.gridFlow == null ? 30 : p.gridFlow) / 100 : 0;

    const kickSpring = anim.kickSpring;
    const pumpEnv = anim.pumpEnv;
    const beat = anim.beat;
    const cx0 = S * 0.5,
      cy0 = S * 0.5;
    // Orbit: the magnet attractor orbits the centre; radius pulses with pumpEnv.
    const orbR = S * (0.16 + 0.1 * orbit) * (1 + pumpEnv * 0.5 * orbit);
    const ax = cx0 + Math.sin(T * 0.5) * orbR * orbit + (ANIM ? Math.sin(T * 0.5) * S * 0.22 * dr : 0);
    const ay = cy0 + Math.cos(T * 0.42) * orbR * orbit + (ANIM ? Math.cos(T * 0.42) * S * 0.2 * dr : 0);
    // Orbit also pulses the effective magnet strength on the beat (breathing pull).
    const magPulse = mag * (1 + pumpEnv * 0.8 * orbit);
    // Ripple wave: radial frequency + outward-traveling phase. Normalised by grid size.
    const ripK = (6.0 + 4.0 * ripple) / Math.max(1, gw); // spatial frequency
    const ripPhase = T * (1.6 + 1.2 * ripple); // outward travel speed
    // Flow: traveling shear direction (gently steered by global swirl).
    const flowAng = T * 0.18 + sw * 1.4;
    const flowDx = Math.cos(flowAng),
      flowDy = Math.sin(flowAng);

    const blob = (
      g: CanvasRenderingContext2D,
      bx: number,
      by: number,
      rad: number,
      rr: RNG,
    ): void => {
      const n = 5 + Math.floor(rr() * 4),
        pts: number[][] = [];
      for (let i = 0; i < n; i++) {
        const a = (i / n) * 6.2832,
          rd = rad * (0.55 + rr() * 0.75);
        pts.push([bx + Math.cos(a) * rd, by + Math.sin(a) * rd]);
      }
      g.beginPath();
      for (let i = 0; i <= n; i++) {
        const p0 = pts[i % n],
          p1 = pts[(i + 1) % n],
          mx = (p0[0] + p1[0]) / 2,
          my = (p0[1] + p1[1]) / 2;
        if (i === 0) g.moveTo(mx, my);
        else g.quadraticCurveTo(p0[0], p0[1], mx, my);
      }
      g.closePath();
      g.fill();
    };

    for (let gy = 0; gy < cols; gy++) {
      for (let gx = 0; gx < cols; gx++) {
        if (r() > dens) continue;
        const u = (gx + 0.5) / cols;
        const v = (gy + 0.5) / cols;
        let depth = 1,
          vv = v;
        if (persp > 0) {
          vv = Math.pow(v, 1 + persp * 1.8);
          depth = 0.4 + 0.6 * vv;
        }
        let cxr = pad + u * gw,
          cyr = pad + vv * gw;
        if (persp > 0) {
          cxr = S * 0.5 + (cxr - S * 0.5) * (0.5 + 0.5 * depth);
        }
        let sb = cell * 0.42 * depth;
        if (mag > 0) {
          const ddx = cxr - ax,
            ddy = cyr - ay,
            dist = Math.hypot(ddx, ddy) + 0.001,
            pull = magPulse / (1 + dist / (S * 0.16)),
            sgn = (gx + gy) % 2 ? 1 : -1;
          cxr -= (ddx / dist) * pull * S * 0.16 * sgn;
          cyr -= (ddy / dist) * pull * S * 0.16 * sgn;
          cxr += (r() - 0.5) * mag * cell * 1.6;
          cyr += (r() - 0.5) * mag * cell * 1.6;
        }
        const ph = gx * 0.7 + gy * 0.9;
        if (ANIM) {
          // --- RIPPLE: wave propagating outward from centre. Drives cell scale and a
          // small radial position offset. Distance taken from the cell's pre-displaced
          // rest position so the wavefront stays coherent across the field.
          const rx = pad + u * gw - cx0,
            ry = pad + vv * gw - cy0,
            rdist = Math.hypot(rx, ry) + 0.001;
          const rWave = Math.sin(ripPhase - rdist * ripK);
          const rAmt = rWave * ripple;
          // radial push (outward on crest, inward on trough) — eased, subtle.
          const rnx = rx / rdist,
            rny = ry / rdist;
          cxr += rnx * rAmt * cell * 0.55;
          cyr += rny * rAmt * cell * 0.55;

          // --- BOB: per-cell positional oscillation (phase scattered per cell).
          cxr += Math.sin(T * (0.7 + (((gx * 7 + gy * 13) % 5) * 0.16)) + ph) * cell * 0.26 * bob;
          cyr += Math.cos(T * 0.85 + ph * 1.3) * cell * 0.26 * bob;
          // gentle global drift wander on top (shared modifier).
          cxr += Math.sin(T * 0.6 + ph * 0.5) * cell * 0.14 * dr;
          cyr += Math.cos(T * 0.55 + ph * 0.7) * cell * 0.14 * dr;

          // --- FLOW: directional traveling shear. Cells lag/lead along the flow axis
          // as a wave sweeps across the field — like a banner rippling in wind.
          const proj = (rx * flowDx + ry * flowDy) / Math.max(1, gw);
          const flowWave = Math.sin(T * 1.3 - proj * 5.0);
          // displace perpendicular to the flow direction (shear).
          cxr += -flowDy * flowWave * cell * 0.5 * flow;
          cyr += flowDx * flowWave * cell * 0.5 * flow;

          // --- size: ripple scale + breath, plus springy beat POP (kickSpring is
          // signed → overshoot/settle). All SPACE-ONLY, never opacity.
          const ripScale = 1 + rAmt * 0.28;
          const breath = 1 + 0.08 * Math.sin(T * 1.5 + ph) + kickEnv * 0.16;
          const popScale = 1 + kickSpring * pop * 0.5 * (0.7 + 0.3 * Math.sin(beat * 6.2832 + ph));
          sb *= ripScale * breath * popScale;
        }
        const wave = ANIM ? 0.4 + 0.6 * (0.5 + 0.5 * Math.sin(T * 1.25 + (gx + gy) * 0.6)) : 1;
        const col = pick(cfg.colors);
        const al = (0.55 + r() * 0.45) * wave;
        ctx.save();
        ctx.globalAlpha = Math.max(0, Math.min(1, al));
        ctx.fillStyle = rgb(col);
        blob(ctx, cxr, cyr, sb * (0.8 + r() * 0.5), r);
        if (r() < 0.3) {
          const ox = (r() - 0.5) * sb * 2.2,
            oy = (r() - 0.5) * sb * 2.2;
          blob(ctx, cxr + ox, cyr + oy, sb * (0.3 + r() * 0.3), r);
        }
        ctx.restore();
      }
    }
    ctx.globalAlpha = 1;
  },
};

function gridParams(): ParamDef[] {
  return [
    { key: "gridCols", label: "COLUMNS", type: "int", group: "composition", min: 3, max: 18, default: 9 },
    { key: "gridDensity", label: "FILL DENSITY", type: "range", group: "composition", min: 0, max: 100, default: 55 },
    { key: "gridPerspective", label: "3D PLANE", type: "range", group: "composition", min: 0, max: 100, default: 0 },
    { key: "gridMagnet", label: "MAGNET · SCATTER", type: "range", group: "composition", min: 0, max: 100, default: 0 },
    // motion (group "motion") — eased + space-only; zero effect when not animating.
    { key: "gridRipple", label: "RIPPLE", type: "range", group: "motion", min: 0, max: 100, default: 45 },
    { key: "gridBob", label: "BOB", type: "range", group: "motion", min: 0, max: 100, default: 40 },
    { key: "gridPop", label: "POP", type: "range", group: "motion", min: 0, max: 100, default: 55 },
    { key: "gridOrbit", label: "ORBIT", type: "range", group: "motion", min: 0, max: 100, default: 35 },
    { key: "gridFlow", label: "FLOW", type: "range", group: "motion", min: 0, max: 100, default: 30 },
  ];
}

registerEngine(grid);

export default grid;
