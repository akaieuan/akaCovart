import type { FieldArgs, FieldEngine, ParamDef } from "../types";
import { registerEngine } from "../registry";
import { prng } from "../prng";

// SIGNAL — overlapping wave gratings whose crests ADD into shimmering interference
// fringes + moiré colour bands. Each grating carries a palette colour and only
// contributes where it crests, so the frame is bold colour interference on the
// base — slightly different grating frequencies/angles produce the moiré beats.
// Rendered small + upscaled (smoothed), and the soften blur melts the fringes into
// silky bands.
//
// THE TWO HARD RULES:
//  • Deterministic — grating freqs / angles / phases / colours all derive from the
//    seed; same (seed, params, t) => same frame.
//  • Flicker-free — only the grating PHASES advance over time, so the fringes
//    TRAVEL in space; the colour at a crest is constant => no strobe. Gated by
//    anim.anim so the still is a fixed interference pattern.

interface Grating {
  ang: number; // base angle (drifted over time for evolving moiré)
  f: number;
  ph: number;
  sp: number;
  col: number[];
  fRate: number; // slow, distinct frequency-drift rate
  fPh: number;
  aRate: number; // slow, distinct angle-drift rate
  aPh: number;
}

// Reusable offscreen buffer (singleton engine, synchronous self-contained calls).
let sbuf: HTMLCanvasElement | null = null;
let sbufImg: ImageData | null = null;
const SNX = 150; // field resolution; upscaled to the frame + softened

const signal: FieldEngine = {
  id: "signal",
  label: "Signal",
  kind: "2d",
  focus: "art",
  params: signalParams(),
  field(args: FieldArgs): void {
    const { ctx, size: S, params: p, cfg, seed, anim } = args;
    const r = prng(seed ^ 0x6c4be19d);

    const freqP = (p.signalFreq == null ? 50 : p.signalFreq) / 100;
    const layers = 2 + Math.round(((p.signalLayers == null ? 50 : p.signalLayers) / 100) * 4); // 2..6
    const spread = (p.signalSpread == null ? 50 : p.signalSpread) / 100;
    const sharp = (p.signalSharp == null ? 50 : p.signalSharp) / 100;

    const ANIM = anim.anim;
    const drift = (p.signalDrift == null ? 60 : p.signalDrift) / 100;
    const swl = (p.signalSwirl == null ? 48 : p.signalSwirl) / 100;
    const pulse = (p.signalPulse == null ? 58 : p.signalPulse) / 100;
    const shimmer = (p.signalFlow == null ? 55 : p.signalFlow) / 100;
    const spd = ANIM ? 0.5 + anim.speed : 1;
    const T = ANIM ? anim.t * spd : 0;

    // ── Build the gratings deterministically ──────────────────────────────────
    const baseAng = r() * Math.PI;
    const baseFreq = 6 + freqP * 26; // grating density
    const cols = cfg.colors.length ? cfg.colors : [cfg.base];
    const gratings: Grating[] = [];
    for (let k = 0; k < layers; k++) {
      const ang = baseAng + (k / layers) * Math.PI * (0.4 + spread * 1.2) + (r() - 0.5) * 0.3;
      gratings.push({
        ang,
        f: baseFreq * (0.82 + r() * 0.4), // close-but-different => moiré
        ph: r() * 6.2832,
        sp: 0.6 + r() * 1.0,
        col: cols[k % cols.length],
        fRate: 0.018 + r() * 0.05, // slow + distinct so the drift never repeats
        fPh: r() * 6.2832,
        aRate: 0.013 + r() * 0.045,
        aPh: r() * 6.2832,
      });
    }

    // beat breathing of grating frequency + slow whole-field roll (SPACE only).
    const freqBeat = 1 + (anim.pumpEnv * 0.08 + anim.kickSpring * 0.055) * (0.4 + pulse);
    const rotT = ANIM ? (anim.swirl * 0.3 + swl * 0.4) * Math.sin(T * 0.12) : 0;
    const cosR = Math.cos(rotT), sinR = Math.sin(rotT);
    // per-grating travelling phase (fringes sweep across the frame over time).
    // Tuned lively so the interference visibly flows + shimmers (gated by ANIM).
    const phs = gratings.map((G) =>
      ANIM ? T * G.sp * (0.6 + drift * 3.4) + shimmer * 1.6 * Math.sin(T * 0.5 + G.ph) : 0,
    );

    // EVOLVING moiré — slowly drift each grating's FREQUENCY and ANGLE over time at
    // distinct slow rates. Because the moiré beats depend on the DIFFERENCES between
    // gratings, even small drift makes the interference nodes continuously migrate +
    // reform, so the pattern keeps reorganizing instead of just sliding. Computed
    // ONCE per grating per frame (no per-pixel cost). 0 when still => still unchanged.
    const fDrift = ANIM ? 0.05 + drift * 0.13 : 0;
    const aDrift = ANIM ? 0.06 + swl * 0.18 : 0;
    const axk = new Float32Array(layers);
    const ayk = new Float32Array(layers);
    const fk = new Float32Array(layers);
    for (let k = 0; k < layers; k++) {
      const G = gratings[k];
      const ang = G.ang + aDrift * Math.sin(T * G.aRate + G.aPh);
      axk[k] = Math.cos(ang);
      ayk[k] = Math.sin(ang);
      fk[k] = G.f * (1 + fDrift * Math.sin(T * G.fRate + G.fPh)) * freqBeat;
    }

    // ── Render into the offscreen buffer ──────────────────────────────────────
    if (!sbuf) sbuf = document.createElement("canvas");
    if (sbuf.width !== SNX || sbuf.height !== SNX) {
      sbuf.width = SNX;
      sbuf.height = SNX;
    }
    const bctx = sbuf.getContext("2d");
    if (!bctx) return;
    if (!sbufImg) sbufImg = bctx.createImageData(SNX, SNX);
    const data = sbufImg.data;
    const inv = 1 / (SNX - 1);
    const sharpPow = 1 + sharp * 3;
    const intScale = 0.7 + sharp * 0.7; // how readily fringes reach full strength
    // Fringes sit on a DARKENED version of the base so they read on ANY palette
    // (additive-on-a-light-base would just blow out to white).
    const gdark = 0.26;
    const gr = cfg.base[0] * gdark, gg0 = cfg.base[1] * gdark, gb = cfg.base[2] * gdark;

    for (let yy = 0; yy < SNX; yy++) {
      const ny0 = yy * inv - 0.5;
      for (let xx = 0; xx < SNX; xx++) {
        const nx0 = xx * inv - 0.5;
        const nx = nx0 * cosR - ny0 * sinR;
        const ny = nx0 * sinR + ny0 * cosR;
        let rr = 0, gg = 0, bb = 0, tot = 0;
        for (let k = 0; k < layers; k++) {
          const G = gratings[k];
          const w = Math.sin((nx * axk[k] + ny * ayk[k]) * fk[k] + G.ph + phs[k]);
          if (w > 0) {
            const m = Math.pow(w, sharpPow); // only crests, sharpened into fringes
            const c = G.col;
            rr += c[0] * m;
            gg += c[1] * m;
            bb += c[2] * m;
            tot += m;
          }
        }
        // colour = AVERAGE of the cresting gratings' colours (never blown out);
        // intensity = how strongly they constructively interfere (the moiré nodes
        // glow where multiple gratings align).
        const winv = tot > 1e-4 ? 1 / tot : 0;
        const inten = tot < 1 ? tot * intScale : intScale + (1 - intScale) * Math.min(1, tot - 1);
        const fr = rr * winv, fg = gg * winv, fb = bb * winv;
        const idx = (yy * SNX + xx) * 4;
        data[idx] = gr + (fr - gr) * inten;
        data[idx + 1] = gg0 + (fg - gg0) * inten;
        data[idx + 2] = gb + (fb - gb) * inten;
        data[idx + 3] = 255;
      }
    }
    bctx.putImageData(sbufImg, 0, 0);

    ctx.save();
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(sbuf, 0, 0, SNX, SNX, 0, 0, S, S);
    ctx.restore();
  },
};

function signalParams(): ParamDef[] {
  return [
    { key: "signalFreq", label: "FREQUENCY", type: "range", group: "composition", min: 0, max: 100, default: 50 },
    { key: "signalLayers", label: "LAYERS", type: "range", group: "composition", min: 0, max: 100, default: 50 },
    { key: "signalSpread", label: "ANGLE SPREAD", type: "range", group: "composition", min: 0, max: 100, default: 50 },
    { key: "signalSharp", label: "SHARPNESS", type: "range", group: "composition", min: 0, max: 100, default: 50 },
    { key: "signalDrift", label: "DRIFT", type: "range", group: "motion", min: 0, max: 100, default: 60 },
    { key: "signalSwirl", label: "SWIRL", type: "range", group: "motion", min: 0, max: 100, default: 48 },
    { key: "signalPulse", label: "PULSE", type: "range", group: "motion", min: 0, max: 100, default: 58 },
    { key: "signalFlow", label: "SHIMMER", type: "range", group: "motion", min: 0, max: 100, default: 55 },
  ];
}

registerEngine(signal);

export default signal;
