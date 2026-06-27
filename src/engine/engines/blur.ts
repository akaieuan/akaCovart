import type { FieldArgs, FieldEngine, ParamDef } from "../types";
import { registerEngine } from "../registry";
import { rgb } from "../color";
import { drawBlurred } from "../blur";
import { getTextMask, txtTones, resolveEnv } from "./txtMask";

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

    // Offscreen res for the blur+threshold. Modest (perf) — the goo is low-freq
    // and upscales cleanly, and the soft-threshold below keeps the edges crisp.
    const side = Math.max(64, Math.min(S, 560)) | 0;

    // RESOLVE LOOP: A is the distort amount — 0 at each resolve (so the blur == its
    // readable STILL), rising mid-cycle and back to 0 by the next beat. The beat
    // kick modulates it WITHIN the cycle (suppressed at the resolve so the word
    // stays clean). At the crest: more blur + LOWER threshold so the letters MELT /
    // merge into fat goo, then REFORM. Everything keys off loopPhase → cycle-
    // periodic → seamless loop; D=0 ⇒ byte-identical to the still.
    const D = ANIM ? resolveEnv(anim.loopPhase) : 0;
    const punch = anim.kickSpring * 0.55 + anim.pumpEnv * 0.32;
    const A = ANIM ? D * (1 + punch * pulse * 0.6) : 0;
    // Lower BASE blur so the still (the resolve) reads as letters; the melt (A·flow)
    // drives the merging during the cycle, then it reforms.
    const radius = Math.max(0.5, (0.0028 + amount * 0.035) * side * (1 + A * (0.5 + flow * 2.6)));
    let thrA = 30 + threshP * 180 - A * flow * 44;
    thrA = Math.max(26, Math.min(225, thrA));

    // Two-tone: direct bg/ink (txtBg/txtInk) or derived from the mood.
    const { bg, ink } = txtTones(p, cfg);
    ctx.save();
    // Stack overlay: skip the bg fill so the goo composites over the art layer.
    if (!p._stackOverlay) {
      ctx.fillStyle = rgb(bg);
      ctx.fillRect(0, 0, S, S);
    }

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

    // SOFT-threshold the blurred ALPHA over a narrow band → clean anti-aliased
    // gooey edges (crisper-looking than a hard 1-bit cut), ink over the base.
    const img = bctx.getImageData(0, 0, side, side);
    const data = img.data;
    const ir = ink[0], ig = ink[1], ib = ink[2];
    const lo = thrA - 5;
    for (let i = 0; i < data.length; i += 4) {
      let m = (data[i + 3] - lo) / 10;
      if (m < 0) m = 0;
      else if (m > 1) m = 1;
      if (invert) m = 1 - m;
      if (m > 0) {
        data[i] = ir;
        data[i + 1] = ig;
        data[i + 2] = ib;
        data[i + 3] = (m * 255) | 0;
      } else {
        data[i + 3] = 0;
      }
    }
    bctx.putImageData(img, 0, 0);

    // A circular drift + breathing zoom over the cycle, gated by A so it returns to
    // dead-centre at the resolve (cycle-periodic → seamless).
    const ang = anim.loopPhase * Math.PI * 2;
    const dxp = ANIM ? Math.cos(ang) * A * drift * S * 0.05 : 0;
    const dyp = ANIM ? Math.sin(ang) * A * drift * S * 0.05 : 0;
    const zoom = ANIM ? 1 + A * (0.03 + flow * 0.06) : 1;
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
