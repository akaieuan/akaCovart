import type { FieldArgs, FieldEngine, ParamDef } from "../types";
import { registerEngine } from "../registry";
import { rgb } from "../color";
import { getTextMask, txtTones, resolveEnv } from "./txtMask";

// LINES — the display text hatched with PARALLEL ROUND-CAPPED STROKES that BREAK
// wherever they leave the glyph, so each line becomes a string of oval segments of
// varying length tracing the letterforms. Faithful to type-tools' "line" tool
// (parallel strokes marched + broken on the text mask). Bold two-tone: one palette
// ink on the mood background.
//
// REAL-TIME TRANSFORMATION:
//  • Angle  — hatch direction. Rotate — the angle spins over time (the ref motion).
//  • Scroll — the hatching travels ⟂ to its direction. Wave — sinusoidal sway.
//  • Pulse  — stroke thickness pops on the beat.
//
// Deterministic + flicker-free: everything is a pure function of anim.t; the ink
// colour is constant, motion is purely spatial. Sizes are fractions of S so still
// and export look identical.

const lines: FieldEngine = {
  id: "lines",
  label: "Lines",
  kind: "2d",
  focus: "txt",
  params: lineParams(),
  field(args: FieldArgs): void {
    const { ctx, size: S, params: p, cfg, seed, anim } = args;
    const mask = getTextMask(p, seed);

    const sizeP = (p.lineSize == null ? 42 : p.lineSize) / 100;
    const gapP = (p.lineGap == null ? 20 : p.lineGap) / 100;
    const angP = (p.lineAngle == null ? 26 : p.lineAngle) / 100;
    const invert = !!p.lineInvert;

    const ANIM = anim.anim;
    const rotate = (p.lineRotate == null ? 45 : p.lineRotate) / 100;
    const scroll = (p.lineScroll == null ? 40 : p.lineScroll) / 100;
    const pulse = (p.linePulse == null ? 45 : p.linePulse) / 100;
    const waveP = (p.lineWave == null ? 30 : p.lineWave) / 100;

    // RESOLVE LOOP: at D=0 the hatch is the readable base-angle still; as D rises the
    // angle SWEEPS away, the lines travel + wave, then it all returns to the base on
    // the beat. Keyed off loopPhase → seamless. D=0 ⇒ the still.
    const D = ANIM ? resolveEnv(anim.loopPhase) : 0;
    const punch = anim.kickSpring * 0.36 + anim.pumpEnv * 0.2;
    const beat = ANIM ? 1 + D * punch * pulse * 1.3 : 1;
    const weight = Math.max(1, (0.004 + sizeP * 0.03) * S * beat);
    const spacing = (0.006 + gapP * 0.04) * S + weight;
    const stepPx = Math.max(2, weight * 0.5);

    // angle sweeps out + back from the base; travel + wave grow then resolve.
    const angle = angP * Math.PI + D * (0.18 + rotate * 0.95) * Math.PI;
    const dx = Math.cos(angle);
    const dy = Math.sin(angle);
    const perpX = -dy;
    const perpY = dx;

    const lp = anim.loopPhase * Math.PI * 2;
    const waveAmp = ANIM ? D * waveP * spacing * 1.7 : 0;
    const waveK = (2 * Math.PI) / (S * (0.18 + 0.5 * (1 - sizeP)));
    const scrollOff = ANIM ? Math.sin(lp) * D * (0.4 + scroll * 1.4) * spacing : 0;

    // Two-tone: direct bg/ink (txtBg/txtInk) or derived from the mood.
    const { bg, ink } = txtTones(p, cfg);
    ctx.save();
    ctx.fillStyle = rgb(bg);
    ctx.fillRect(0, 0, S, S);
    ctx.strokeStyle = rgb(ink);
    ctx.lineWidth = weight;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    const cx = S * 0.5;
    const cy = S * 0.5;
    const diag = S * Math.SQRT2 * 0.62; // half-extent that covers the square
    // start offset wraps within one spacing so the hatch travels smoothly
    const startShift = ((scrollOff % spacing) + spacing) % spacing;

    for (let d = -diag + startShift; d <= diag; d += spacing) {
      let inRun = false;
      let count = 0;
      let sx = 0;
      let sy = 0;
      for (let m = -diag; m <= diag; m += stepPx) {
        const wave = waveAmp ? waveAmp * Math.sin(m * waveK + lp + d * 0.01) : 0;
        const dp = d + wave;
        const x = cx + dp * perpX + m * dx;
        const y = cy + dp * perpY + m * dy;
        let draw = false;
        if (x >= 0 && x < S && y >= 0 && y < S) {
          const on = mask.sample(x / S, y / S) > 0.5;
          draw = invert ? !on : on;
        }
        if (draw) {
          if (!inRun) {
            ctx.beginPath();
            ctx.moveTo(x, y);
            inRun = true;
            count = 1;
            sx = x;
            sy = y;
          } else {
            ctx.lineTo(x, y);
            count++;
          }
        } else if (inRun) {
          if (count === 1) ctx.lineTo(sx, sy); // single hit → round dot
          ctx.stroke();
          inRun = false;
        }
      }
      if (inRun) {
        if (count === 1) ctx.lineTo(sx, sy);
        ctx.stroke();
      }
    }
    ctx.restore();
  },
};

function lineParams(): ParamDef[] {
  return [
    { key: "lineSize", label: "THICKNESS", type: "range", group: "composition", min: 0, max: 100, default: 42 },
    { key: "lineGap", label: "SPACING", type: "range", group: "composition", min: 0, max: 100, default: 20 },
    { key: "lineAngle", label: "ANGLE", type: "range", group: "composition", min: 0, max: 100, default: 26 },
    { key: "lineInvert", label: "INVERT", type: "toggle", group: "composition", default: false },
    { key: "lineRotate", label: "ROTATE", type: "range", group: "motion", min: 0, max: 100, default: 45 },
    { key: "lineScroll", label: "SCROLL", type: "range", group: "motion", min: 0, max: 100, default: 40 },
    { key: "linePulse", label: "PULSE", type: "range", group: "motion", min: 0, max: 100, default: 45 },
    { key: "lineWave", label: "WAVE", type: "range", group: "motion", min: 0, max: 100, default: 30 },
  ];
}

registerEngine(lines);

export default lines;
