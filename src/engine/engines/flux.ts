import type { FieldArgs, FieldEngine, ParamDef } from "../types";
import { registerEngine } from "../registry";
import { prng } from "../prng";

// FLUX — a liquid-marble / aurora COLOUR FIELD. A domain-warped fbm value-noise
// field is mapped through the palette so the whole frame is large, smooth, flowing
// regions of colour (a paint-pour / agate look) — bold and blur-friendly. Rendered
// at a small offscreen resolution and upscaled with smoothing so it stays cheap and
// silky; the soften blur melts it further.
//
// THE TWO HARD RULES:
//  • Deterministic — the noise hash + offsets derive from the seed; same
//    (seed, params, t) => same frame.
//  • Flicker-free — motion only churns/flows/zooms the field in SPACE (sample
//    offsets + domain warp + a beat zoom). The colour at a given warped value is
//    time-independent, so nothing ever strobes. All motion gated by anim.anim, so
//    the still render is a calm, fixed pour.

function fade(t: number): number {
  return t * t * t * (t * (t * 6 - 15) + 10);
}
function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

// Reusable offscreen field buffer (the engine is a singleton and every field()
// call is synchronous + self-contained, so a module-level buffer never races).
let buf: HTMLCanvasElement | null = null;
let bufImg: ImageData | null = null;
const NX = 160; // field resolution; upscaled to the frame + softened

const flux: FieldEngine = {
  id: "flux",
  label: "Flux",
  kind: "2d",
  params: fluxParams(),
  field(args: FieldArgs): void {
    const { ctx, size: S, params: p, cfg, seed, anim } = args;

    // ── Deterministic seed stream ─────────────────────────────────────────────
    const r = prng(seed ^ 0x3f1a77c5);
    const seedHash = (Math.floor(r() * 0xffffffff) ^ (seed * 0x9e3779b1)) | 0;
    const ox = r() * 64;
    const oy = r() * 64;
    const wphx = r() * 6.2832;
    const wphy = r() * 6.2832;

    const hash2 = (x: number, y: number): number => {
      let h = (Math.imul(x, 374761393) + Math.imul(y, 668265263) + seedHash) | 0;
      h = Math.imul(h ^ (h >>> 13), 1274126177);
      return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
    };
    const vnoise = (x: number, y: number): number => {
      const xi = Math.floor(x), yi = Math.floor(y);
      const xf = x - xi, yf = y - yi;
      const u = fade(xf), v = fade(yf);
      const c00 = hash2(xi, yi), c10 = hash2(xi + 1, yi);
      const c01 = hash2(xi, yi + 1), c11 = hash2(xi + 1, yi + 1);
      return lerp(lerp(c00, c10, u), lerp(c01, c11, u), v);
    };
    const fbm = (x: number, y: number, oct: number): number => {
      let a = 0.5, f = 1, s = 0, n = 0;
      for (let i = 0; i < oct; i++) {
        s += a * vnoise(x * f, y * f);
        n += a;
        f *= 2;
        a *= 0.5;
      }
      return s / n;
    };

    // ── Shaping params ────────────────────────────────────────────────────────
    const scale = (p.fluxScale == null ? 50 : p.fluxScale) / 100;
    const warp = (p.fluxWarp == null ? 55 : p.fluxWarp) / 100;
    const veins = (p.fluxBands == null ? 45 : p.fluxBands) / 100;
    const depth = (p.fluxDepth == null ? 50 : p.fluxDepth) / 100;
    const baseFreq = 1.4 + scale * 4.2;

    // ── Motion (gated, SPACE only) ────────────────────────────────────────────
    const ANIM = anim.anim;
    const flow = (p.fluxFlow == null ? 50 : p.fluxFlow) / 100;
    const dft = (p.fluxDrift == null ? 45 : p.fluxDrift) / 100;
    const swl = (p.fluxSwirl == null ? 40 : p.fluxSwirl) / 100;
    const pulse = (p.fluxPulse == null ? 50 : p.fluxPulse) / 100;
    const spd = ANIM ? 0.5 + anim.speed : 1;
    const T = ANIM ? anim.t * spd : 0;
    // time-driven offsets churn the field; drift slides it; swirl rotates samples.
    const tx = ANIM ? T * (0.04 + flow * 0.22) + dft * 0.5 * Math.sin(T * 0.12) : 0;
    const ty = ANIM ? T * (0.03 + flow * 0.16) : 0;
    const rot = ANIM ? (0.15 * swl + anim.swirl * 0.2) * Math.sin(T * 0.1) : 0;
    const cosR = Math.cos(rot), sinR = Math.sin(rot);

    // ── Colour ramp = the palette, cycled into smooth marble veins ────────────
    const cols = cfg.colors.length ? cfg.colors : [cfg.base];
    const NC = cols.length;
    const cycles = 1 + veins * 2.4; // colour repetitions => more veins
    const rgbOut = [0, 0, 0];
    const rampCol = (v: number): void => {
      // triangle-wave cycle so the veins are seamless (no hard ramp seam).
      let f = (v * cycles) % 1;
      if (f < 0) f += 1;
      const tri = f < 0.5 ? f * 2 : (1 - f) * 2;
      const pos = tri * (NC - 1);
      const i0 = Math.floor(pos), i1 = Math.min(i0 + 1, NC - 1);
      const fr = pos - i0;
      const c0 = cols[i0], c1 = cols[i1];
      rgbOut[0] = c0[0] + (c1[0] - c0[0]) * fr;
      rgbOut[1] = c0[1] + (c1[1] - c0[1]) * fr;
      rgbOut[2] = c0[2] + (c1[2] - c0[2]) * fr;
    };

    // ── Render the field into the offscreen buffer ────────────────────────────
    if (!buf) buf = document.createElement("canvas");
    if (buf.width !== NX || buf.height !== NX) {
      buf.width = NX;
      buf.height = NX;
    }
    const bctx = buf.getContext("2d");
    if (!bctx) return;
    if (!bufImg) bufImg = bctx.createImageData(NX, NX);
    const data = bufImg.data;
    const inv = 1 / (NX - 1);
    const gamma = 0.7 + (1 - depth) * 0.9;
    const sinT2 = Math.sin(T * 0.2 + wphx);
    const cosT2 = Math.cos(T * 0.17 + wphy);
    for (let yy = 0; yy < NX; yy++) {
      const nyc = yy * inv - 0.5;
      for (let xx = 0; xx < NX; xx++) {
        const nxc = xx * inv - 0.5;
        // rotate sample coords about centre for the swirl
        const sx = nxc * cosR - nyc * sinR + 0.5;
        const sy = nxc * sinR + nyc * cosR + 0.5;
        const bx = sx * baseFreq + ox + tx;
        const by = sy * baseFreq + oy + ty;
        // domain warp (the source of the liquid marbling)
        const wx = fbm(bx * 0.5 + 11.3 + sinT2, by * 0.5 + 4.1, 2) - 0.5;
        const wy = fbm(bx * 0.5 + 7.7, by * 0.5 + 9.2 + cosT2, 2) - 0.5;
        let v = fbm(bx + wx * warp * 2.2, by + wy * warp * 2.2, 4);
        v = Math.pow(v, gamma);
        rampCol(v);
        // sink low-value troughs toward the base colour for depth/contrast
        const dk = (1 - v) * depth * 0.6;
        const idx = (yy * NX + xx) * 4;
        data[idx] = rgbOut[0] + (cfg.base[0] - rgbOut[0]) * dk;
        data[idx + 1] = rgbOut[1] + (cfg.base[1] - rgbOut[1]) * dk;
        data[idx + 2] = rgbOut[2] + (cfg.base[2] - rgbOut[2]) * dk;
        data[idx + 3] = 255;
      }
    }
    bctx.putImageData(bufImg, 0, 0);

    // ── Upscale (smoothed) with a beat zoom — silky liquid, SPACE-only motion ──
    const sc = 1 + (anim.pumpEnv * 0.05 + anim.kickSpring * 0.03) * (0.4 + pulse);
    ctx.save();
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    if (ANIM && sc !== 1) {
      ctx.translate(S * 0.5, S * 0.5);
      ctx.scale(sc, sc);
      ctx.translate(-S * 0.5, -S * 0.5);
    }
    ctx.drawImage(buf, 0, 0, NX, NX, 0, 0, S, S);
    ctx.restore();
  },
};

function fluxParams(): ParamDef[] {
  return [
    { key: "fluxScale", label: "SCALE", type: "range", group: "composition", min: 0, max: 100, default: 50 },
    { key: "fluxWarp", label: "WARP", type: "range", group: "composition", min: 0, max: 100, default: 55 },
    { key: "fluxBands", label: "VEINS", type: "range", group: "composition", min: 0, max: 100, default: 45 },
    { key: "fluxDepth", label: "DEPTH", type: "range", group: "composition", min: 0, max: 100, default: 50 },
    { key: "fluxFlow", label: "FLOW", type: "range", group: "motion", min: 0, max: 100, default: 50 },
    { key: "fluxDrift", label: "DRIFT", type: "range", group: "motion", min: 0, max: 100, default: 45 },
    { key: "fluxSwirl", label: "SWIRL", type: "range", group: "motion", min: 0, max: 100, default: 40 },
    { key: "fluxPulse", label: "PULSE", type: "range", group: "motion", min: 0, max: 100, default: 50 },
  ];
}

registerEngine(flux);

export default flux;
