import type { FieldArgs, FieldEngine, ParamDef, RNG } from "../types";
import { registerEngine } from "../registry";
import { prng } from "../prng";
import { rgba } from "../color";

// BLOB field — ported from the else-branch of the prototype `renderTo`
// (paint / diamonds / accents / blur). Motion comes from AnimState only:
// drift/swirl wander on SPACE, kickEnv pulses blob radius. No hue/flicker/strobe.
const blob: FieldEngine = {
  id: "blob",
  label: "Blob",
  kind: "2d",
  params: blobParams(),
  field(args: FieldArgs): void {
    const { ctx, size: S, params: p, mood, cfg, seed, anim } = args;

    // Dedicated RNG streams keyed off the seed (deterministic).
    const rB: RNG = prng(seed ^ 0x9e3779b1);
    const rD: RNG = prng(seed ^ 0x1b56c4e9);
    const rA: RNG = prng(seed ^ 0x7f4a7c15);

    const pick = (rng: RNG, arr: number[][]): number[] => arr[Math.floor(rng() * arr.length)];
    const hsh = (n: number): number => {
      const x = Math.sin(n * 12.9898) * 43758.5453;
      return x - Math.floor(x);
    };
    const smudge = (
      g: CanvasRenderingContext2D,
      x: number,
      y: number,
      r: number,
      sx: number,
      sy: number,
      rot: number,
      col: number[],
      a: number,
    ): void => {
      g.save();
      g.translate(x, y);
      g.rotate(rot);
      g.scale(sx, sy);
      const gr = g.createRadialGradient(0, 0, 0, 0, 0, r);
      gr.addColorStop(0, rgba(col, a));
      gr.addColorStop(0.65, rgba(col, a * 0.5));
      gr.addColorStop(1, rgba(col, 0));
      g.fillStyle = gr;
      g.beginPath();
      g.arc(0, 0, r, 0, 6.2832);
      g.fill();
      g.restore();
    };

    const ANIM = anim.anim;
    const T = ANIM ? anim.t : 0;
    const kickEnv = anim.kickEnv; // pre-eased beat envelope (0..~slider)
    const driftAmt = ANIM ? anim.drift : 0;
    const swirlAmt = ANIM ? anim.swirl : 0;

    const paint = document.createElement("canvas");
    paint.width = S;
    paint.height = S;
    const pc = paint.getContext("2d")!;
    const paintD = document.createElement("canvas");
    paintD.width = S;
    paintD.height = S;
    const pcd = paintD.getContext("2d")!;

    const samplePos = (): { x: number; y: number } => {
      let x: number, y: number;
      if (mood === "dark") {
        if (rB() < 0.16) {
          x = S * rB();
        } else {
          x = S * (0.16 + rB() * 0.52);
        }
        y = S * rB();
      } else if (mood === "cream") {
        const e = rB();
        if (e < 0.55) {
          x = S * rB();
          y = S * (0.56 + rB() * 0.48);
        } else if (e < 0.8) {
          x = rB() < 0.5 ? S * rB() * 0.2 : S * (0.8 + rB() * 0.2);
          y = S * rB();
        } else {
          x = S * rB();
          y = S * (rB() * 0.22);
        }
      } else {
        x = S * rB();
        y = S * rB();
      }
      return { x, y };
    };

    const bsz = 0.55 + ((p.blobSize == null ? 50 : p.blobSize) / 100) * 1.25;
    const glowF = 0.6 + ((p.glow == null ? 55 : p.glow) / 100) * 0.95;
    const nFree = Math.round(cfg.blobCount * (0.4 + (p.density / 100) * 1.3));
    const aDr = ANIM ? S * 0.055 * driftAmt : 0;
    const aSw = ANIM ? swirlAmt : 0;

    for (let i = 0; i < nFree; i++) {
      const pos = samplePos();
      const col = pick(rB, cfg.colors);
      const r = S * (cfg.rMin + rB() * (cfg.rMax - cfg.rMin)) * bsz;
      const a = Math.min(1.1, (cfg.aMin + rB() * (cfg.aMax - cfg.aMin)) * glowF);
      let bx = pos.x,
        by = pos.y,
        br = 1;
      if (ANIM) {
        const ph = i * 1.27;
        if (aSw > 0) {
          const rx = bx - S / 2,
            ry = by - S / 2,
            ang = T * 0.18 * aSw * (0.5 + Math.hypot(rx, ry) / S),
            ca = Math.cos(ang),
            sa = Math.sin(ang);
          bx = S / 2 + rx * ca - ry * sa;
          by = S / 2 + rx * sa + ry * ca;
        }
        const f1 = 0.35 + hsh(i) * 1.05,
          f2 = 0.22 + hsh(i + 5.3) * 0.75,
          dir = hsh(i + 2.1) * 6.2832,
          amp = aDr * (0.45 + hsh(i + 3.7) * 1.7),
          roam = aDr * 1.5 * (0.4 + hsh(i + 8.2) * 1.2),
          rf = 0.1 + hsh(i + 1.1) * 0.22;
        const wx =
          Math.sin(T * f1 + ph) + 0.6 * Math.sin(T * f2 * 1.7 + ph * 1.6) + 0.4 * Math.cos(T * 0.23 + i);
        const wy =
          Math.cos(T * f1 * 0.9 + ph * 1.1) +
          0.6 * Math.cos(T * f2 * 1.5 + ph * 0.7) +
          0.4 * Math.sin(T * 0.19 + i * 1.3);
        bx += wx * amp * 0.55 + Math.cos(dir) * Math.sin(T * rf) * roam;
        by += wy * amp * 0.55 + Math.sin(dir) * Math.sin(T * rf * 1.13 + 1.7) * roam;
        // kickEnv only displaces / scales — never brightness.
        br = (1 + kickEnv * 0.3) * (1 + 0.06 * Math.sin(T * f1 * 1.4 + ph));
        if (kickEnv > 0) {
          bx += (bx - S / 2) * kickEnv * 0.1;
          by += (by - S / 2) * kickEnv * 0.1;
        }
      }
      smudge(pc, bx, by, r * br, 0.55 + rB() * 0.9, 0.55 + rB() * 0.9, rB() * 6.28, col, a);
    }

    if (cfg.topSmudge) {
      for (let t = 0; t < 5; t++) {
        smudge(
          pc,
          S * rB(),
          S * (rB() * 0.16),
          S * (0.1 + rB() * 0.14),
          0.8 + rB(),
          0.6 + rB() * 0.6,
          rB() * 6.28,
          cfg.smoke,
          0.16 + rB() * 0.16,
        );
      }
    }
    if (cfg.clearCenter) {
      smudge(pc, S * (0.45 + rB() * 0.1), S * (0.38 + rB() * 0.1), S * 0.52, 1.25, 1.05, 0, cfg.base, 0.92);
    }

    if (p.diamonds) {
      const dSize = (p.diamondSize == null ? 50 : p.diamondSize) / 100,
        dShape = (p.diamondShape == null ? 50 : p.diamondShape) / 100,
        aH = 1.5 - dShape,
        aV = 0.5 + dShape;
      for (let k = 0; k < p.diamondCount; k++) {
        const cx = S * (0.26 + rD() * 0.46),
          cy = S * (0.1 + rD() * 0.7),
          Rb = S * (0.1 + dSize * 0.26) * (0.85 + rD() * 0.3);
        const RW = Rb * aH,
          RH = Rb * aV,
          Rm = Math.min(RW, RH);
        pcd.save();
        pcd.beginPath();
        pcd.moveTo(cx, cy - RH);
        pcd.lineTo(cx + RW, cy);
        pcd.lineTo(cx, cy + RH);
        pcd.lineTo(cx - RW, cy);
        pcd.closePath();
        pcd.clip();
        const n = 16 + Math.floor(rD() * 18);
        for (let j = 0; j < n; j++) {
          const dx = cx + (rD() - 0.5) * 2 * RW,
            dy = cy + (rD() - 0.5) * 2 * RH;
          const dcol = pick(rD, cfg.diamondColors);
          const dr = Rm * (0.2 + rD() * 0.55);
          const da = cfg.diamondAlpha * (0.4 + rD() * 0.6);
          smudge(pcd, dx, dy, dr, 0.5 + rD() * 0.9, 0.5 + rD() * 0.9, rD() * 6.28, dcol, da);
        }
        const sp = 12 + Math.floor(rD() * 18);
        for (let f = 0; f < sp; f++) {
          const fx = cx + (rD() - 0.5) * 2 * RW,
            fy = cy + (rD() - 0.5) * 2 * RH;
          smudge(
            pcd,
            fx,
            fy,
            Rm * (0.025 + rD() * 0.06),
            1,
            1,
            0,
            cfg.fleck,
            Math.min(0.9, (0.25 + rD() * 0.5) * cfg.diamondAlpha * 1.8),
          );
        }
        pcd.restore();
      }
    }

    for (let ac = 0; ac < p.accentCount; ac++) {
      const acol = pick(rA, cfg.accentColors);
      const edge = Math.floor(rA() * 4);
      const inten = p.accent / 100;
      let aa = 0.2 + 0.6 * inten;
      let ax: number, ay: number, asx: number, asy: number;
      const AR = S * (0.12 + rA() * 0.16);
      if (ANIM) {
        // kickEnv pulses accent intensity slightly via optical scale, not brightness flash.
        aa *= 1 + kickEnv * 0.9;
      }
      if (edge === 0) {
        ax = S * (0.9 + rA() * 0.08);
        ay = S * (0.15 + rA() * 0.6);
        asx = 0.18 + rA() * 0.12;
        asy = 1.6 + rA() * 1.2;
      } else if (edge === 1) {
        ax = S * (0.02 + rA() * 0.08);
        ay = S * (0.15 + rA() * 0.6);
        asx = 0.18 + rA() * 0.12;
        asy = 1.6 + rA() * 1.2;
      } else if (edge === 2) {
        ay = S * (0.9 + rA() * 0.08);
        ax = S * (0.15 + rA() * 0.6);
        asx = 1.6 + rA() * 1.2;
        asy = 0.18 + rA() * 0.12;
      } else {
        ay = S * (0.02 + rA() * 0.08);
        ax = S * (0.15 + rA() * 0.6);
        asx = 1.6 + rA() * 1.2;
        asy = 0.18 + rA() * 0.12;
      }
      smudge(pc, ax, ay, AR, asx, asy, 0, acol, aa);
    }

    const blurPx = S * (0.012 + (p.smear / 100) * 0.055);
    ctx.save();
    ctx.filter = "blur(" + blurPx + "px)";
    ctx.drawImage(paint, 0, 0);
    ctx.restore();
    ctx.filter = "none";

    if (p.diamonds) {
      const dBlur = Math.max(0.5, blurPx * 0.42);
      ctx.save();
      ctx.filter = "blur(" + dBlur + "px)";
      ctx.drawImage(paintD, 0, 0);
      ctx.restore();
      ctx.filter = "none";
    }
  },
};

function blobParams(): ParamDef[] {
  return [
    { key: "density", label: "BLOB DENSITY", type: "range", group: "composition", min: 0, max: 100, default: 60 },
    { key: "smear", label: "SMEAR / BLUR", type: "range", group: "composition", min: 0, max: 100, default: 45 },
    { key: "blobSize", label: "BLOB SIZE", type: "range", group: "composition", min: 0, max: 100, default: 50 },
    { key: "glow", label: "GLOW", type: "range", group: "composition", min: 0, max: 100, default: 55 },
    { key: "diamonds", label: "DIAMOND ZONES", type: "toggle", group: "composition", default: true },
    { key: "diamondCount", label: "COUNT", type: "int", group: "composition", min: 0, max: 4, default: 2 },
    { key: "diamondSize", label: "SIZE", type: "range", group: "composition", min: 0, max: 100, default: 50 },
    { key: "diamondShape", label: "SHAPE WIDE–TALL", type: "range", group: "composition", min: 0, max: 100, default: 50 },
    { key: "accent", label: "INTENSITY", type: "range", group: "composition", min: 0, max: 100, default: 60 },
    { key: "accentCount", label: "COUNT", type: "int", group: "composition", min: 0, max: 4, default: 2 },
  ];
}

registerEngine(blob);

export default blob;
