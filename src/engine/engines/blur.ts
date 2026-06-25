import type { FieldArgs, FieldEngine, ParamDef } from "../types";
import { registerEngine } from "../registry";
import { rgb } from "../color";
import { drawBlurred } from "../blur";
import { getTextMask, txtTones } from "./txtMask";

// BLUR — the display text BLURRED then HARD-THRESHOLDED into gooey, merged
// metaball letterforms (the letters fuse as the blur rises). Faithful to
// type-tools' "blur" tool (render text → gaussian blur → threshold at 128). Bold
// two-tone: one palette ink on the mood background.
//
// REAL-TIME TRANSFORMATION:
//  • Blur      — how fat / merged the goo is. Threshold — the merge cut.
//  • Flow      — blur + threshold morph over time → the goo breathes and the
//                letters merge / separate in real time.
//  • Pulse / Drift — beat fatten, slow spatial drift.
//
// Deterministic + flicker-free: the morph is a pure function of anim.t (a SHAPE
// change, never a colour/brightness strobe); the ink colour is constant. The goo
// is computed in a capped offscreen and upscaled, so it is cheap and resolution-
// independent (still 880 and export 3000 match).

let bbuf: HTMLCanvasElement | null = null;

const blur: FieldEngine = {
  id: "blur",
  label: "Blur",
  kind: "2d",
  focus: "txt",
  params: blurParams(),
  field(args: FieldArgs): void {
    const { ctx, size: S, params: p, cfg, seed, anim } = args;
    const mask = getTextMask(p, seed);

    const amount = (p.blurAmount == null ? 50 : p.blurAmount) / 100;
    const threshP = (p.blurThreshold == null ? 50 : p.blurThreshold) / 100;
    const invert = !!p.blurInvert;

    const ANIM = anim.anim;
    const flow = (p.blurFlow == null ? 50 : p.blurFlow) / 100;
    const pulse = (p.blurPulse == null ? 45 : p.blurPulse) / 100;
    const drift = (p.blurDrift == null ? 35 : p.blurDrift) / 100;
    const spd = ANIM ? 0.5 + anim.speed : 1;
    const T = ANIM ? anim.t * spd : 0;

    // Offscreen res for the blur+threshold (low-freq goo upscales cleanly).
    const side = Math.max(64, Math.min(S, 720)) | 0;

    // Motion DRAMATICALLY morphs the blur radius + threshold so the goo melts,
    // merges and reforms — a two-rate organic morph (not a plain sine) + a beat
    // punch. Space/shape only (never a brightness strobe), so it stays flicker-free.
    const morph = ANIM ? Math.sin(T * 0.55) * 0.62 + Math.sin(T * 0.23 + 1.7) * 0.34 : 0; // ~[-0.96,0.96]
    const flowR = 1 + morph * flow * 0.9;
    const beatR = ANIM ? 1 + (anim.kickSpring * 0.32 + anim.pumpEnv * 0.2) * pulse : 1;
    const radius = Math.max(0.5, (0.004 + amount * 0.06) * side * flowR * beatR);
    let thrA = 30 + threshP * 180; // 30..210
    // the threshold swings hard so blobs visibly merge ↔ split as it flows
    if (ANIM) thrA -= morph * flow * 50 + anim.pumpEnv * pulse * 40;
    thrA = Math.max(8, Math.min(247, thrA));

    // Two-tone: direct bg/ink (txtBg/txtInk) or derived from the mood.
    const { bg, ink } = txtTones(p, cfg);
    ctx.save();
    ctx.fillStyle = rgb(bg);
    ctx.fillRect(0, 0, S, S);

    if (!bbuf) bbuf = document.createElement("canvas");
    if (bbuf.width !== side || bbuf.height !== side) {
      bbuf.width = side;
      bbuf.height = side;
    }
    const bctx = bbuf.getContext("2d", { willReadFrequently: true });
    if (!bctx) {
      ctx.restore();
      return;
    }
    bctx.clearRect(0, 0, side, side);
    drawBlurred(bctx, mask.canvas, side, radius);

    // Threshold the blurred ALPHA → ink where goo, transparent elsewhere.
    const img = bctx.getImageData(0, 0, side, side);
    const data = img.data;
    const ir = ink[0], ig = ink[1], ib = ink[2];
    for (let i = 0; i < data.length; i += 4) {
      const goo = data[i + 3] > thrA;
      const lit = invert ? !goo : goo;
      if (lit) {
        data[i] = ir;
        data[i + 1] = ig;
        data[i + 2] = ib;
        data[i + 3] = 255;
      } else {
        data[i + 3] = 0;
      }
    }
    bctx.putImageData(img, 0, 0);

    // Upscale (smoothed) onto the base with a wandering drift + a breathing zoom
    // so the whole gooey field is alive (space-only).
    const dxp = ANIM ? (Math.sin(T * 0.4) * 0.6 + Math.sin(T * 0.93 + 2) * 0.34) * drift * S * 0.04 : 0;
    const dyp = ANIM ? (Math.cos(T * 0.33) * 0.6 + Math.cos(T * 0.71) * 0.34) * drift * S * 0.035 : 0;
    const zoom = ANIM ? 1 + Math.sin(T * 0.45 + 0.5) * flow * 0.06 + anim.pumpEnv * pulse * 0.05 : 1;
    const dw = S * zoom;
    const dh = S * zoom;
    const ox = dxp - (dw - S) / 2;
    const oy = dyp - (dh - S) / 2;
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(bbuf, 0, 0, side, side, ox, oy, dw, dh);
    ctx.restore();
  },
};

function blurParams(): ParamDef[] {
  return [
    { key: "blurAmount", label: "BLUR", type: "range", group: "composition", min: 0, max: 100, default: 50 },
    { key: "blurThreshold", label: "THRESHOLD", type: "range", group: "composition", min: 0, max: 100, default: 50 },
    { key: "blurInvert", label: "INVERT", type: "toggle", group: "composition", default: false },
    { key: "blurFlow", label: "FLOW", type: "range", group: "motion", min: 0, max: 100, default: 70 },
    { key: "blurPulse", label: "PULSE", type: "range", group: "motion", min: 0, max: 100, default: 60 },
    { key: "blurDrift", label: "DRIFT", type: "range", group: "motion", min: 0, max: 100, default: 45 },
  ];
}

registerEngine(blur);

export default blur;
