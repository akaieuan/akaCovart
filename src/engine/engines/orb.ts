import type { FieldArgs, FieldEngine, ParamDef, RNG } from "../types";
import { registerEngine } from "../registry";
import { prng } from "../prng";
import { rgb } from "../color";

// ORB field — ported from the prototype `fieldOrb`. Halftone is STATIC (the
// per-frame dot shimmer is dropped). Motion from AnimState only: drift drifts /
// breathes the orb, kickEnv + pumpEnv pulse the radius (never opacity/brightness).
const orb: FieldEngine = {
  id: "orb",
  label: "Orb",
  kind: "2d",
  params: orbParams(),
  field(args: FieldArgs): void {
    const { ctx, size: S, params: p, mood, cfg, seed, anim } = args;
    const r: RNG = prng(seed ^ 0x7a2b91c3);

    const sz = (p.orbSize == null ? 55 : p.orbSize) / 100;
    const soft = (p.orbSoft == null ? 55 : p.orbSoft) / 100;
    const half = (p.orbHalftone == null ? 40 : p.orbHalftone) / 100;
    const melt = (p.orbMelt == null ? 30 : p.orbMelt) / 100;
    const shade = (p.orbShade == null ? 55 : p.orbShade) / 100;

    // Motion params (space-only; defaults keep still render unaffected).
    const spin = (p.orbSpin == null ? 25 : p.orbSpin) / 100;
    const wobble = (p.orbWobble == null ? 40 : p.orbWobble) / 100;
    const bounce = (p.orbBounce == null ? 50 : p.orbBounce) / 100;
    const breath = (p.orbBreath == null ? 35 : p.orbBreath) / 100;
    const churn = (p.orbChurn == null ? 45 : p.orbChurn) / 100;

    const ANIM = anim.anim;
    const T = ANIM ? anim.t : 0;
    const dr = ANIM ? anim.drift : 0;
    const kickEnv = anim.kickEnv;
    const kickSpring = anim.kickSpring;
    const pumpEnv = anim.pumpEnv;

    // SPIN — slow rotation of the melt-warp angle phases + halftone sampling.
    const spinPhase = ANIM ? T * (0.18 + 0.9 * spin) : 0;
    // CHURN — speed of the warp sin terms scales with churn.
    const churnW = ANIM ? 0.5 + 1.6 * churn : 0;

    let R = S * (0.18 + sz * 0.32);
    // Position orbit still uses anim.drift.
    const cx = S * 0.5 + (ANIM ? Math.sin(T * 0.4) * S * (0.03 + 0.06 * dr) : 0);
    const cy = S * 0.46 + (ANIM ? Math.cos(T * 0.32) * S * (0.03 + 0.05 * dr) : 0);
    if (ANIM) {
      // BREATH — radius LFO (sin(t*0.8)) + pumpEnv, scaled by breath.
      R *= 1 + 0.05 * Math.sin(T * 0.8) * (0.4 + breath) + kickEnv * 0.12 + pumpEnv * 0.14 * (0.4 + breath);
    }
    // BOUNCE — squash-and-stretch on the kick: stretch X / squash Y (volume-ish).
    const sq = ANIM ? bounce * kickSpring * 0.22 : 0;
    const RW = R * (1 + sq);
    const RH = R * (1 - sq * 0.85);
    // WOBBLE — jelly surface: LFO + kickSpring drives the melt-warp amplitude.
    const wobAmp = ANIM ? 1 + wobble * (0.12 * Math.sin(T * 1.7 + 0.6) + 0.5 * kickSpring) : 1;

    const c1 = cfg.colors[Math.floor(r() * cfg.colors.length)];
    const c2 = cfg.accentColors[Math.floor(r() * cfg.accentColors.length)];

    const lite = (c: number[], s: number): number[] => [
      Math.min(255, c[0] + 105 * s),
      Math.min(255, c[1] + 105 * s),
      Math.min(255, c[2] + 105 * s),
    ];
    const drk = (c: number[], s: number): number[] => [
      c[0] * (1 - 0.65 * s),
      c[1] * (1 - 0.65 * s),
      c[2] * (1 - 0.65 * s),
    ];
    const hp = [r() * 6.28, r() * 6.28, r() * 6.28];

    ctx.save();
    if (soft > 0) ctx.filter = "blur(" + R * 0.035 * (0.3 + soft) + "px)";
    ctx.beginPath();
    const N = 150;
    for (let i = 0; i <= N; i++) {
      // SPIN rotates the warp angle phases; CHURN scales the sin-term speed;
      // WOBBLE modulates the warp amplitude (jelly surface).
      const ang = (i / N) * 6.2832,
        sa = ang + spinPhase,
        warp =
          melt *
          wobAmp *
          (0.3 * Math.sin(sa * 3 + hp[0] + T * 0.5 * churnW) +
            0.2 * Math.sin(sa * 5 + hp[1] - T * 0.35 * churnW) +
            0.14 * Math.sin(sa * 2 + hp[2])),
        // squash-and-stretch: separate width/height radii, volume-ish.
        px = cx + Math.cos(ang) * RW * (1 + warp),
        drip = Math.sin(ang) > 0 ? 1 + melt * 0.6 * Math.sin(ang) : 1,
        py = cy + Math.sin(ang) * RH * (1 + warp) * drip;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.clip();
    ctx.filter = "none";

    const hx = cx - R * 0.3 * (0.4 + shade),
      hy = cy - R * 0.32 * (0.4 + shade);
    const g = ctx.createRadialGradient(hx, hy, R * 0.04, cx, cy, R * 1.5);
    g.addColorStop(0, rgb(lite(c1, shade * 0.9)));
    g.addColorStop(0.4, rgb(c1));
    g.addColorStop(0.8, rgb(c2));
    g.addColorStop(1, rgb(drk(c2, shade)));
    ctx.fillStyle = g;
    ctx.fillRect(cx - R * 2, cy - R * 2, R * 4, R * 4);

    if (shade > 0) {
      const sg = ctx.createRadialGradient(cx + R * 0.34, cy + R * 0.4, R * 0.06, cx, cy, R * 1.3);
      sg.addColorStop(0, "rgba(0,0,0,0)");
      sg.addColorStop(0.65, "rgba(0,0,0,0)");
      sg.addColorStop(1, "rgba(0,0,0," + (0.6 * shade).toFixed(3) + ")");
      ctx.fillStyle = sg;
      ctx.fillRect(cx - R * 2, cy - R * 2, R * 4, R * 4);
    }

    if (half > 0) {
      const dot = Math.max(3, S * 0.014 * (1.5 - half));
      ctx.fillStyle = mood === "dark" ? rgb(cfg.base) : "rgba(18,18,22,0.9)";
      // SPIN — rotate the halftone sampling so the dot field spins with the orb.
      const cs = Math.cos(spinPhase),
        sn = Math.sin(spinPhase);
      for (let yy = cy - R * 1.6; yy < cy + R * 1.8; yy += dot) {
        for (let xx = cx - R * 1.6; xx < cx + R * 1.6; xx += dot) {
          const rdx = xx - cx,
            rdy = yy - cy,
            // sampled position in the orb's spinning frame
            ddx = rdx * cs - rdy * sn,
            ddy = rdx * sn + rdy * cs,
            dist = Math.hypot(ddx, ddy);
          if (dist > R * 1.5) continue;
          // STATIC halftone — no per-frame shimmer (sh fixed to 1).
          const rad = dot * 0.5 * Math.min(1, dist / R) * half * 1.5;
          if (rad > 0.4) {
            ctx.beginPath();
            ctx.arc(xx, yy, rad, 0, 6.2832);
            ctx.fill();
          }
        }
      }
    }
    ctx.restore();
  },
};

function orbParams(): ParamDef[] {
  return [
    { key: "orbSize", label: "ORB SIZE", type: "range", group: "composition", min: 0, max: 100, default: 55 },
    { key: "orbSoft", label: "SOFTNESS", type: "range", group: "composition", min: 0, max: 100, default: 55 },
    { key: "orbHalftone", label: "HALFTONE", type: "range", group: "composition", min: 0, max: 100, default: 40 },
    { key: "orbMelt", label: "MELT", type: "range", group: "composition", min: 0, max: 100, default: 30 },
    { key: "orbShade", label: "3D SHADE", type: "range", group: "composition", min: 0, max: 100, default: 55 },
    { key: "orbSpin", label: "SPIN", type: "range", group: "motion", min: 0, max: 100, default: 25 },
    { key: "orbWobble", label: "WOBBLE", type: "range", group: "motion", min: 0, max: 100, default: 40 },
    { key: "orbBounce", label: "BOUNCE", type: "range", group: "motion", min: 0, max: 100, default: 50 },
    { key: "orbBreath", label: "BREATH", type: "range", group: "motion", min: 0, max: 100, default: 35 },
    { key: "orbChurn", label: "CHURN", type: "range", group: "motion", min: 0, max: 100, default: 45 },
  ];
}

registerEngine(orb);

export default orb;
