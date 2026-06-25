import type { FieldArgs, FieldEngine, ParamDef, RNG } from "../types";
import { registerEngine } from "../registry";
import { prng } from "../prng";
import { rgba } from "../color";
import { drawBlurred } from "../blur";

// BLOB field — ported from the else-branch of the prototype `renderTo`
// (paint / diamonds / accents / blur).
//
// MOTION MODEL (eased, SPACE-ONLY, flicker-free — never modulates hue/alpha/
// brightness with time or beat). All motion is gated by anim.anim; when off the
// still render is byte-identical. Randomness is derived from the seed (prng /
// hsh); time (anim.t) drives the motion, so a given (seed, t) is deterministic.
//
//   Flow   — a SHARED low-frequency, curl-like flow field advects every blob,
//            diamond and accent TOGETHER so the whole field drifts cohesively.
//   Wander — per-blob individual roam with a distinct per-blob phase.
//   Swirl  — slow rotation of the entire field around the centre.
//   Pulse  — springy, visible beat response on blob radius via kickEnv +
//            kickSpring (signed overshoot/settle).
//   Morph  — each blob's radius breathes over time on a per-blob phase.
// Diamond zones drift with the flow, slowly rotate, and pulse with the beat.
// Accent streaks slide along their edge over time with a gentle beat scale.
const blob: FieldEngine = {
  id: "blob",
  label: "Blob",
  kind: "2d",
  focus: "art",
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
    const kickSpring = anim.kickSpring; // signed damped bounce
    const driftAmt = ANIM ? anim.drift : 0;
    // Global swirl (Drift > Swirl slider / audio high-band) rides along with the
    // dedicated Swirl control as a shared baseline rotation of the field.
    const gSwirl = ANIM ? anim.swirl : 0;

    // Dedicated BLOB motion params (group "motion"). 0..1; defaults match the
    // store. Gated by ANIM so the still render is unaffected by them entirely.
    const flowM = ANIM ? (p.blobFlow == null ? 55 : p.blobFlow) / 100 : 0;
    const swirlM = ANIM ? (p.blobSwirl == null ? 35 : p.blobSwirl) / 100 : 0;
    const pulseM = ANIM ? (p.blobPulse == null ? 55 : p.blobPulse) / 100 : 0;
    const wanderM = ANIM ? (p.blobWander == null ? 50 : p.blobWander) / 100 : 0;
    const morphM = ANIM ? (p.blobMorph == null ? 45 : p.blobMorph) / 100 : 0;

    // Seed-derived constant phase offsets for the shared flow field so the field
    // pattern differs per seed yet stays deterministic. (prng stream consumed up
    // front, before the blob loop, so blob sampling RNG is unaffected.)
    const rF: RNG = prng(seed ^ 0x2f6b1d3f);
    const fpx = rF() * 6.2832,
      fpy = rF() * 6.2832,
      fpz = rF() * 6.2832;

    // Shared, smooth, curl-like flow field. Sum of low-frequency sin/cos terms
    // over normalised position + time. Returns a displacement in PIXELS so every
    // element advects TOGETHER (cohesive drift). amp scales the overall strength.
    const flowAt = (px: number, py: number, amp: number): { fx: number; fy: number } => {
      if (amp <= 0) return { fx: 0, fy: 0 };
      const nx = px / S,
        ny = py / S;
      // Curl of a scalar potential ~ (∂/∂y, -∂/∂x) of layered sines → smooth,
      // divergence-light swirling advection (no sources/sinks, reads as fluid).
      const a = Math.sin(nx * 2.4 + T * 0.31 + fpx) + Math.cos(ny * 2.0 - T * 0.24 + fpy);
      const b = Math.sin((nx + ny) * 1.7 - T * 0.19 + fpz) + Math.cos(nx * 1.3 - ny * 1.9 + T * 0.27);
      const fx = Math.cos(ny * 3.1 + T * 0.23 + fpy) * 0.7 + a * 0.5;
      const fy = -Math.sin(nx * 3.3 - T * 0.21 + fpx) * 0.7 - b * 0.5;
      return { fx: fx * amp, fy: fy * amp };
    };
    // Slow whole-field rotation around centre. swirlT folds the global swirl
    // baseline (gSwirl) in with the dedicated Swirl control so both ride along
    // together as a shared rotation of the field.
    const swirlT = swirlM + gSwirl;
    const fieldAng = swirlT > 0 ? T * 0.12 * swirlT : 0;
    const fCos = Math.cos(fieldAng),
      fSin = Math.sin(fieldAng);
    const rotateField = (x: number, y: number): { x: number; y: number } => {
      if (swirlT <= 0) return { x, y };
      const rx = x - S / 2,
        ry = y - S / 2;
      return { x: S / 2 + rx * fCos - ry * fSin, y: S / 2 + rx * fSin + ry * fCos };
    };
    // Master flow amplitude in pixels (clearly visible yet smooth).
    const flowPx = S * 0.06 * flowM;

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
    // Legacy global drift still rides along (Wander control above scales the
    // dedicated per-blob roam; animDrift adds the shared global wander baseline).
    const aDr = ANIM ? S * 0.04 * (driftAmt + wanderM * 1.1) : 0;

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
        // SWIRL — rotate this blob's rest position around the centre with the
        // whole field (shared angle), plus a tiny radius-dependent lead so the
        // field reads as a slow cohesive turn rather than a rigid spin.
        if (swirlT > 0) {
          const rot = rotateField(bx, by);
          bx = rot.x;
          by = rot.y;
        }
        // FLOW — advect by the SHARED curl-like field so all blobs drift TOGETHER.
        if (flowPx > 0) {
          const fl = flowAt(bx, by, flowPx);
          bx += fl.fx;
          by += fl.fy;
        }
        // WANDER — per-blob individual roam (distinct per-blob phase). Eased sum
        // of a few low-freq terms; amplitude scaled by Wander (via aDr).
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
        // PULSE — springy, visible beat response on radius/scale. kickSpring is
        // signed (overshoot/settle); kickEnv is the calm attack-decay. SPACE only.
        const pulse = 1 + (kickEnv * 0.34 + kickSpring * 0.26) * (0.5 + pulseM);
        // MORPH — per-blob radius breathing on its own phase (eased LFO).
        const morph = 1 + morphM * (0.16 * Math.sin(T * (0.7 + f1 * 0.6) + ph * 1.4));
        br = pulse * morph;
        // Beat also gently expands the field outward from centre (space, not glow).
        if (kickEnv > 0) {
          const ek = kickEnv * (0.06 + 0.08 * pulseM);
          bx += (bx - S / 2) * ek;
          by += (by - S / 2) * ek;
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
        // Rest position/size (same rD() draws as the still render — determinism).
        let cx = S * (0.26 + rD() * 0.46),
          cy = S * (0.1 + rD() * 0.7);
        const Rb = S * (0.1 + dSize * 0.26) * (0.85 + rD() * 0.3);
        // ANIMATE the diamond zone: drift centre with the SHARED flow, pulse its
        // size with the beat, and slowly rotate the diamond shape. All eased,
        // space-only. The clip path + contents rotate together via a transform
        // about the (drifted) centre, so the marks stay inside the diamond.
        let dPulse = 1,
          dAng = 0;
        if (ANIM) {
          const dph = k * 2.39;
          if (swirlT > 0) {
            const rot = rotateField(cx, cy);
            cx = rot.x;
            cy = rot.y;
          }
          if (flowPx > 0) {
            const fl = flowAt(cx, cy, flowPx);
            cx += fl.fx;
            cy += fl.fy;
          }
          // gentle individual sway so the two zones don't move in lock-step.
          cx += Math.sin(T * 0.33 + dph) * S * 0.012 * (wanderM + 0.4);
          cy += Math.cos(T * 0.29 + dph * 1.3) * S * 0.012 * (wanderM + 0.4);
          dPulse = 1 + (kickEnv * 0.16 + kickSpring * 0.1) * (0.5 + pulseM) + morphM * 0.05 * Math.sin(T * 0.8 + dph);
          dAng = T * 0.1 * swirlT + 0.18 * swirlT * Math.sin(T * 0.5 + dph);
        }
        const RW = Rb * aH * dPulse,
          RH = Rb * aV * dPulse,
          Rm = Math.min(RW, RH);
        pcd.save();
        // Rotate the whole diamond (clip + contents) about its centre.
        pcd.translate(cx, cy);
        pcd.rotate(dAng);
        pcd.translate(-cx, -cy);
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
      // Alpha is TIME-INDEPENDENT (no brightness flash → no flicker). The beat
      // reads through optical SCALE only (aScale below).
      const aa = 0.2 + 0.6 * inten;
      let ax: number, ay: number, asx: number, asy: number;
      const AR = S * (0.12 + rA() * 0.16);
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
      // ANIMATE the accent streak: slide it ALONG its edge over time, ride the
      // shared flow a touch, and a gentle beat SCALE. Move/scale only — no
      // brightness change, so it never flashes.
      let aScale = 1;
      if (ANIM) {
        const aph = ac * 1.93;
        const vertical = edge === 0 || edge === 1; // streak runs vertically
        const slide = S * 0.08 * (0.5 + wanderM) * Math.sin(T * 0.45 + aph);
        if (vertical) ay += slide;
        else ax += slide;
        if (flowPx > 0) {
          const fl = flowAt(ax, ay, flowPx * 0.5);
          ax += fl.fx;
          ay += fl.fy;
        }
        aScale = 1 + (kickEnv * 0.22 + kickSpring * 0.16) * (0.5 + pulseM);
      }
      smudge(pc, ax, ay, AR * aScale, asx, asy, 0, acol, aa);
    }

    const blurPx = S * (0.012 + (p.smear / 100) * 0.055);
    ctx.save();
    drawBlurred(ctx, paint, S, blurPx);
    ctx.restore();

    if (p.diamonds) {
      const dBlur = Math.max(0.5, blurPx * 0.42);
      ctx.save();
      drawBlurred(ctx, paintD, S, dBlur);
      ctx.restore();
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
