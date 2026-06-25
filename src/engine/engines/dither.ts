import type { FieldArgs, FieldEngine, ParamDef } from "../types";
import { registerEngine } from "../registry";
import { rgb } from "../color";
import { getTextMask, txtTones, resolveEnv } from "./txtMask";

// DITHER — the display text PIXELATED into a coarse grid of square (or round)
// pixels, then BROKEN: each pixel is only drawn if a per-cell dropout passes.
// Faithful to type-tools' "dither" tool (render text → grid → point-sample →
// draw pixel only when random() < distortion). Bold two-tone: one palette ink on
// the mood background.
//
// REAL-TIME TRANSFORMATION:
//  • Break  — dropout density (100 = solid, lower = sparser / more broken).
//  • Shuffle — the broken dropout reshuffles over time → the pixels sparkle.
//  • Jitter / Pulse / Breathe — positional shimmer, beat pop, breathing scale.
//
// Determinism: the dropout is HASHED from (seed, cellIndex, timeStep), so the
// reshuffle is reproducible for a given (seed, t) and identical at any fps / on
// export. The broken-pixel sparkle is the intended aesthetic (a deliberate,
// scoped exception to no-per-pixel-flicker); the ink colour never strobes.

// Small deterministic 0..1 hash of three integers.
function hash3(a: number, b: number, c: number): number {
  let h = (Math.imul(a, 374761393) + Math.imul(b, 668265263) + Math.imul(c, 2246822519)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

const dither: FieldEngine = {
  id: "dither",
  label: "Dither",
  kind: "2d",
  focus: "txt",
  params: ditherParams(),
  field(args: FieldArgs): void {
    const { ctx, size: S, params: p, cfg, seed, anim } = args;
    const mask = getTextMask(p, seed);

    const sizeP = (p.ditherSize == null ? 45 : p.ditherSize) / 100;
    const breakP = (p.ditherBreak == null ? 78 : p.ditherBreak) / 100;
    const gapP = (p.ditherGap == null ? 12 : p.ditherGap) / 100;
    const round = !!p.ditherRound;
    const invert = !!p.ditherInvert;

    const ANIM = anim.anim;
    const shuffle = (p.ditherShuffle == null ? 55 : p.ditherShuffle) / 100;
    const jitterP = (p.ditherJitter == null ? 35 : p.ditherJitter) / 100;
    const pulse = (p.ditherPulse == null ? 55 : p.ditherPulse) / 100;
    const swell = (p.ditherSwell == null ? 40 : p.ditherSwell) / 100;
    const D = ANIM ? resolveEnv(anim.loopPhase) : 0;

    // Sizes as fractions of S so still (880) and export (3000) look identical.
    const cell = Math.max(2, (0.012 + sizeP * 0.05) * S); // pixel size
    const gap = gapP * cell * 0.9; // gap between pixels
    const stepPx = cell + gap;

    // Two-tone: direct bg/ink (txtBg/txtInk) or derived from the mood.
    const { bg, ink } = txtTones(p, cfg);
    ctx.save();
    ctx.fillStyle = rgb(bg);
    ctx.fillRect(0, 0, S, S);
    ctx.fillStyle = rgb(ink);
    ctx.imageSmoothingEnabled = false;

    // RESOLVE LOOP: at D=0 the word is the SOLID clean pixelated still; as D rises
    // mid-cycle the pixels break MORE, SCATTER and reshuffle, then snap back to the
    // word on the beat. The beat kick spikes the scatter WITHIN the cycle (gated by
    // D so the resolve stays clean). All keyed off loopPhase → seamless loop.
    const punch = anim.kickSpring * 0.45 + anim.pumpEnv * 0.18;
    const breath = ANIM ? 1 + D * (0.05 + swell * 0.12) : 1;
    const pixScale = ANIM ? 1 + D * (0.12 + anim.kickSpring * 0.28) * pulse : 1;
    const jitterAmp = ANIM ? D * (jitterP * 1.0 + punch * 0.7) * cell : 0;
    const breakEff = breakP * (1 - D * (0.18 + shuffle * 0.5)); // sparser/broken mid-cycle
    const timeStep = ANIM && D > 0.001 ? Math.floor(anim.loopPhase * (1 + shuffle * 16)) : 0;

    const cols = Math.ceil(S / stepPx) + 1;
    const rows = Math.ceil(S / stepPx) + 1;
    let idx = 0;
    for (let gy = 0; gy < rows; gy++) {
      for (let gx = 0; gx < cols; gx++) {
        idx++;
        // cell centre in screen space, breathing about the middle
        let cxp = (gx + 0.5) * stepPx;
        let cyp = (gy + 0.5) * stepPx;
        cxp = S * 0.5 + (cxp - S * 0.5) * breath;
        cyp = S * 0.5 + (cyp - S * 0.5) * breath;
        // point-sample the glyph coverage at the cell centre
        const cov = mask.sample(cxp / S, cyp / S);
        const on = cov > 0.5;
        if ((invert ? on : !on)) continue; // outside the drawn region
        // per-cell broken dropout (reshuffles with timeStep; more drops mid-cycle)
        if (hash3(gx, gy, timeStep + (seed | 0)) > breakEff) continue;
        // scatter the pixel position (cycle-periodic → seamless; 0 at the resolve)
        let px = cxp;
        let py = cyp;
        if (jitterAmp > 0) {
          const lp = anim.loopPhase * 6.2831853;
          px += Math.sin(lp + idx * 12.9898) * jitterAmp;
          py += Math.cos(lp + idx * 78.233) * jitterAmp;
        }
        const d = cell * pixScale;
        if (round) {
          ctx.beginPath();
          ctx.arc(Math.round(px), Math.round(py), d / 2, 0, Math.PI * 2);
          ctx.fill();
        } else {
          ctx.fillRect(Math.round(px - d / 2), Math.round(py - d / 2), Math.ceil(d), Math.ceil(d));
        }
      }
    }
    ctx.restore();
  },
};

function ditherParams(): ParamDef[] {
  return [
    { key: "ditherSize", label: "PIXEL SIZE", type: "range", group: "composition", min: 0, max: 100, default: 45 },
    { key: "ditherBreak", label: "BREAK", type: "range", group: "composition", min: 0, max: 100, default: 78 },
    { key: "ditherGap", label: "SPACING", type: "range", group: "composition", min: 0, max: 100, default: 12 },
    { key: "ditherRound", label: "ROUND PIXELS", type: "toggle", group: "composition", default: false },
    { key: "ditherInvert", label: "INVERT", type: "toggle", group: "composition", default: false },
    { key: "ditherShuffle", label: "SHUFFLE", type: "range", group: "motion", min: 0, max: 100, default: 55 },
    { key: "ditherJitter", label: "JITTER", type: "range", group: "motion", min: 0, max: 100, default: 35 },
    { key: "ditherPulse", label: "PULSE", type: "range", group: "motion", min: 0, max: 100, default: 55 },
    { key: "ditherSwell", label: "BREATHE", type: "range", group: "motion", min: 0, max: 100, default: 40 },
  ];
}

registerEngine(dither);

export default dither;
