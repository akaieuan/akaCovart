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

    // Offscreen res for the blur+threshold. Modest (perf) — the goo is low-freq
    // and upscales cleanly, and the soft-threshold below keeps the edges crisp.
    const side = Math.max(64, Math.min(S, 560)) | 0;

    // DRAMATIC merge-breathing: one clear cycle whose SPEED + DEPTH both scale with
    // Flow, so the letters visibly MELT into fat gooey blobs and REFORM, with a hard
    // beat punch on top. The threshold rises as it merges so the blob stays crisp +
    // contained (clean, not mush). Shape-only → flicker-free.
    const cyc = ANIM ? Math.sin(T * (0.5 + flow * 0.7)) * 0.5 + 0.5 : 0; // 0..1
    const punch = ANIM ? anim.kickSpring * 0.55 + anim.pumpEnv * 0.32 : 0;
    // At the crest both push toward FATTER, MERGED goo: more blur AND a lower
    // threshold (so the spread-thin alpha is still caught — it grows, never
    // vanishes). Floors/caps keep it from filling the frame or collapsing.
    const radius = Math.max(
      0.5,
      (0.004 + amount * 0.05) * side * (1 + cyc * (0.25 + flow * 1.6) + punch * pulse * 0.7),
    );
    let thrA = 30 + threshP * 180 - cyc * flow * 40 - punch * pulse * 18;
    thrA = Math.max(26, Math.min(225, thrA));

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

    // A bold directional sweep + a breathing zoom synced to the merge cycle so the
    // whole gooey field is alive (space-only).
    const ang = ANIM ? T * 0.5 : 0;
    const dxp = ANIM ? Math.cos(ang) * drift * S * 0.06 : 0;
    const dyp = ANIM ? Math.sin(ang * 0.8) * drift * S * 0.05 : 0;
    const zoom = ANIM ? 1 + cyc * (0.03 + flow * 0.06) + punch * pulse * 0.07 : 1;
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
