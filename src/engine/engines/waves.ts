import type { FieldArgs, FieldEngine, ParamDef, RNG } from "../types";
import { registerEngine } from "../registry";
import { prng } from "../prng";
import { rgb } from "../color";

interface Comp {
  f: number;
  a: number;
  ph: number;
  sp: number;
}

// WAVES field — ported from the prototype `fieldWaves`. Motion from AnimState only,
// EASED and SPACE-ONLY (never opacity/brightness/hue):
//   Flow      — traveling wave, advance the x-phase by anim.t * flow.
//   Swell     — slow amplitude breathing LFO scaled by swell.
//   Surge     — bouncy beat amplitude pulse via anim.kickSpring * surge.
//   Churn     — turbulence components animate faster, scaled by churn.
//   Undulate  — vertical baseline cross-drift scaled by undulate.
const waves: FieldEngine = {
  id: "waves",
  label: "Waves",
  kind: "2d",
  params: waveParams(),
  field(args: FieldArgs): void {
    const { ctx, size: S, params: p, cfg, seed, anim } = args;
    const r: RNG = prng(seed ^ 0x2bd1e44f);

    const lines = Math.max(8, Math.round(p.waveCount == null ? 60 : p.waveCount));
    const amp = ((p.waveAmp == null ? 50 : p.waveAmp) / 100) * S * 0.07;
    const det = (p.waveDetail == null ? 45 : p.waveDetail) / 100;
    const turb = (p.waveTurbulence == null ? 25 : p.waveTurbulence) / 100;
    const persp = (p.wavePerspective == null ? 0 : p.wavePerspective) / 100;

    // Motion params (0..1). Defaults chosen so a still render is unaffected
    // (every motion term is gated by ANIM below).
    const flow = (p.waveFlow == null ? 50 : p.waveFlow) / 100;
    const swell = (p.waveSwell == null ? 40 : p.waveSwell) / 100;
    const surge = (p.waveSurge == null ? 55 : p.waveSurge) / 100;
    const churn = (p.waveChurn == null ? 40 : p.waveChurn) / 100;
    const undulate = (p.waveUndulate == null ? 45 : p.waveUndulate) / 100;

    const ANIM = anim.anim;
    const T = ANIM ? anim.t : 0;
    const dr = ANIM ? anim.drift : 0;
    const sw = ANIM ? anim.swirl : 0;
    const spd = ANIM ? 0.5 + anim.speed : 1;
    const kickSpring = ANIM ? anim.kickSpring : 0;
    const pumpEnv = ANIM ? anim.pumpEnv : 0;

    // FLOW — traveling-wave phase that scrolls the crests horizontally.
    // CHURN — faster phase for the high-frequency turbulence layer.
    const flowPh = ANIM ? T * spd * (0.5 + flow * 2.6) : 0;
    const churnPh = ANIM ? T * spd * (0.8 + churn * 4.2) : 0;

    const comps: Comp[] = [];
    const tc: Comp[] = [];
    for (let k = 0; k < 4; k++) {
      comps.push({
        f: ((0.6 + r() * 2.6) * (0.6 + det * 3)) / S * 6.2832,
        a: 0.4 + r() * 1.0,
        ph: r() * 6.28,
        sp: 0.25 + r() * 0.8,
      });
    }
    for (let k2 = 0; k2 < 3; k2++) {
      tc.push({
        f: ((5 + r() * 12) / S) * 6.2832,
        a: 0.3 + r() * 0.6,
        ph: r() * 6.28,
        sp: 0.7 + r() * 1.6,
      });
    }

    // SWELL — slow global amplitude breathing. SURGE — signed, bouncy beat pulse.
    // pumpEnv adds a gentle synchronized breath on top of swell.
    const swellLFO = ANIM ? 1 + 0.35 * swell * Math.sin(T * 0.7) + 0.18 * swell * pumpEnv : 1;
    const surgeA = ANIM ? 1 + surge * kickSpring * 0.9 : 1;
    const beatA = swellLFO * surgeA;
    const step = Math.max(2, S / 240);

    for (let li = 0; li < lines; li++) {
      const t01 = li / lines,
        yp = persp > 0 ? Math.pow(t01, 1 + persp * 1.7) : t01;
      let baseY = S * (0.05 + 0.9 * yp);
      if (ANIM) {
        // UNDULATE — vertical baseline cross-drift; gentle global drift/swirl ride along.
        const und = 0.4 * undulate + 0.5 * dr + 0.25 * sw;
        baseY += Math.sin(T * 0.5 * spd + li * 0.22) * amp * 1.4 * und;
      }
      const col = cfg.colors[Math.floor(r() * cfg.colors.length)];
      const ampSc = persp > 0 ? 0.2 + 1.6 * t01 : 1;
      const ampL = amp * beatA * ampSc;
      ctx.beginPath();
      for (let x = 0; x <= S; x += step) {
        let y = baseY;
        for (let c3 = 0; c3 < comps.length; c3++) {
          const cc = comps[c3];
          // FLOW drives the per-component phase: crests travel along +x over time.
          y += (Math.sin(x * cc.f + cc.ph + flowPh * cc.sp + li * 0.16) * ampL * cc.a) / comps.length * 2.2;
        }
        if (turb > 0) {
          for (let c4 = 0; c4 < tc.length; c4++) {
            const tt = tc[c4];
            // CHURN animates the turbulence layer faster than the body waves.
            y += Math.sin(x * tt.f + tt.ph + churnPh * tt.sp + li * 0.5) * ampL * turb * tt.a * 0.6;
          }
        }
        if (x === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.strokeStyle = rgb(col);
      ctx.globalAlpha = 0.28 + r() * 0.5;
      ctx.lineWidth = Math.max(0.6, S * 0.0016 * (0.6 + r() * 1.3) * (persp > 0 ? 0.5 + t01 : 1));
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  },
};

function waveParams(): ParamDef[] {
  return [
    { key: "waveCount", label: "LINES", type: "int", group: "composition", min: 10, max: 160, default: 60 },
    { key: "waveAmp", label: "AMPLITUDE", type: "range", group: "composition", min: 0, max: 100, default: 50 },
    { key: "waveDetail", label: "DETAIL", type: "range", group: "composition", min: 0, max: 100, default: 45 },
    { key: "waveTurbulence", label: "TURBULENCE", type: "range", group: "composition", min: 0, max: 100, default: 25 },
    { key: "wavePerspective", label: "PERSPECTIVE", type: "range", group: "composition", min: 0, max: 100, default: 0 },
    { key: "waveFlow", label: "FLOW", type: "range", group: "motion", min: 0, max: 100, default: 50 },
    { key: "waveSwell", label: "SWELL", type: "range", group: "motion", min: 0, max: 100, default: 40 },
    { key: "waveSurge", label: "SURGE", type: "range", group: "motion", min: 0, max: 100, default: 55 },
    { key: "waveChurn", label: "CHURN", type: "range", group: "motion", min: 0, max: 100, default: 40 },
    { key: "waveUndulate", label: "UNDULATE", type: "range", group: "motion", min: 0, max: 100, default: 45 },
  ];
}

registerEngine(waves);

export default waves;
