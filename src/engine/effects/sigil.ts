import type { Mood, RNG } from "../types";
import { rgb } from "../color";

interface Pt {
  x: number;
  y: number;
}
interface SpineOpts {
  depth?: number;
  taperPow?: number;
  wobble?: number;
  barbs?: number;
  side?: number;
}

// Full ribbon / thorn / spine / barb / frame / marks sigil renderer —
// ported from the prototype (index.html `drawSigil`). Deterministic from `rng`.
export function drawSigil(
  ctx: CanvasRenderingContext2D,
  size: number,
  params: Record<string, any>,
  mood: Mood,
  rng: RNG,
): void {
  if (!params.sigilMarks && !params.sigilEmblem && !params.sigilFrame) return;

  const S = size;
  const dark = mood === "dark";
  const main: number[] = dark ? [231, 233, 231] : [24, 24, 26];
  const ghost: number[] = dark ? [120, 124, 124] : [104, 102, 100];

  const mk = (): HTMLCanvasElement => {
    const c = document.createElement("canvas");
    c.width = S;
    c.height = S;
    return c;
  };

  function ribbonW(g: CanvasRenderingContext2D, pts: Pt[], ws: number[]): void {
    const n = pts.length;
    if (n < 2) return;
    const L: number[][] = [],
      Rr: number[][] = [];
    for (let i = 0; i < n; i++) {
      const pp = pts[i],
        a = pts[i > 0 ? i - 1 : 0],
        b = pts[i < n - 1 ? i + 1 : n - 1];
      const dx = b.x - a.x,
        dy = b.y - a.y,
        d = Math.hypot(dx, dy) || 1,
        nx = -dy / d,
        ny = dx / d,
        w = ws[i] / 2;
      L.push([pp.x + nx * w, pp.y + ny * w]);
      Rr.push([pp.x - nx * w, pp.y - ny * w]);
    }
    g.beginPath();
    g.moveTo(L[0][0], L[0][1]);
    for (let i = 1; i < n; i++) g.lineTo(L[i][0], L[i][1]);
    for (let i = n - 1; i >= 0; i--) g.lineTo(Rr[i][0], Rr[i][1]);
    g.closePath();
    g.fill();
  }

  function thorn(
    g: CanvasRenderingContext2D,
    x: number,
    y: number,
    ang: number,
    len: number,
    w: number,
    r: RNG,
  ): void {
    const steps = 7,
      pts: Pt[] = [],
      ws: number[] = [];
    let cx = x,
      cy = y,
      a = ang;
    const cv = (r() - 0.5) * 1.3;
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      pts.push({ x: cx, y: cy });
      ws.push(Math.max(0.3, w * Math.pow(1 - t, 1.4)));
      a += cv / steps;
      cx += (Math.cos(a) * len) / steps;
      cy += (Math.sin(a) * len) / steps;
    }
    ribbonW(g, pts, ws);
  }

  function spine(
    g: CanvasRenderingContext2D,
    x: number,
    y: number,
    ang: number,
    len: number,
    w: number,
    curve: number,
    r: RNG,
    opts?: SpineOpts,
  ): void {
    const o: SpineOpts = opts || {};
    const depth = o.depth || 0;
    const steps = Math.max(7, Math.min(60, Math.round(len / (w * 0.6 + S * 0.0035))));
    const pts: Pt[] = [],
      ws: number[] = [];
    let cx = x,
      cy = y,
      a = ang;
    const dC = curve / steps,
      tp = o.taperPow || 1.5;
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      pts.push({ x: cx, y: cy });
      ws.push(Math.max(0.3, w * Math.pow(1 - t, tp)));
      a += dC + (r() - 0.5) * (o.wobble || 0);
      cx += (Math.cos(a) * len) / steps;
      cy += (Math.sin(a) * len) / steps;
    }
    ribbonW(g, pts, ws);
    const nb = o.barbs == null ? Math.round(steps * 0.5) : o.barbs;
    for (let b = 0; b < nb; b++) {
      const i2 = Math.floor((0.1 + 0.84 * r()) * steps);
      const pp = pts[i2];
      if (!pp) continue;
      const pa = pts[Math.max(0, i2 - 1)],
        pb = pts[Math.min(steps, i2 + 1)];
      const tang = Math.atan2(pb.y - pa.y, pb.x - pa.x);
      const sideSel = o.side ? o.side : r() < 0.5 ? 1 : -1;
      const bang = tang + sideSel * (Math.PI * 0.3 + r() * 0.36);
      const frac = 1 - i2 / steps;
      const blen = len * (0.13 + r() * 0.22) * (0.4 + frac);
      const bw = ws[i2] * (0.6 + r() * 0.4);
      if (depth > 0 && blen > S * 0.025 && r() < 0.45) {
        spine(g, pp.x, pp.y, bang, blen, bw, (r() - 0.5) * 1.5, r, {
          taperPow: 1.7,
          barbs: Math.floor(r() * 3),
          wobble: 0.05,
          depth: depth - 1,
          side: o.side ? sideSel : 0,
        });
      } else {
        thorn(g, pp.x, pp.y, bang, blen, Math.max(0.4, bw), r);
      }
    }
  }

  const mirror = (src: HTMLCanvasElement, alpha: number, axes: number): void => {
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.drawImage(src, 0, 0);
    ctx.save();
    ctx.translate(S, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(src, 0, 0);
    ctx.restore();
    if (axes === 4) {
      ctx.save();
      ctx.translate(0, S);
      ctx.scale(1, -1);
      ctx.drawImage(src, 0, 0);
      ctx.restore();
      ctx.save();
      ctx.translate(S, S);
      ctx.scale(-1, -1);
      ctx.drawImage(src, 0, 0);
      ctx.restore();
    }
    ctx.restore();
  };

  // ----- barbed frame (4-way mirror, recessive ghost) -----
  if (params.sigilFrame) {
    const fd = params.sigilFrameDensity / 100;
    const inset = S * 0.06;
    const tf = mk(),
      fg = tf.getContext("2d")!;
    fg.fillStyle = rgb(ghost);
    fg.strokeStyle = rgb(main);
    spine(fg, S * 0.5, inset, 0, S * 0.45, S * 0.011, 0.05, rng, {
      barbs: Math.round(9 + fd * 16),
      taperPow: 1.15,
      depth: 1,
      wobble: 0.07,
      side: 1,
    });
    spine(fg, inset, S * 0.5, Math.PI * 0.5, S * 0.4, S * 0.011, 0.05, rng, {
      barbs: Math.round(9 + fd * 14),
      taperPow: 1.15,
      depth: 1,
      wobble: 0.07,
      side: 1,
    });
    spine(fg, inset + S * 0.02, inset + S * 0.02, Math.PI * 0.25, S * 0.17, S * 0.015, 0.5, rng, {
      barbs: Math.round(6 + fd * 8),
      taperPow: 1.35,
      depth: 1,
      wobble: 0.06,
    });
    spine(fg, inset + S * 0.02, inset + S * 0.02, Math.PI * 0.18, S * 0.13, S * 0.012, -0.5, rng, {
      barbs: 6,
      depth: 1,
      wobble: 0.06,
    });
    mirror(tf, 0.8, 4);
  }

  // ----- small scattered sigil marks (default; keeps it simple) -----
  if (params.sigilMarks) {
    const sparkle = (
      g: CanvasRenderingContext2D,
      x: number,
      y: number,
      R: number,
    ): void => {
      const nn = R * 0.16,
        pts = [
          [0, -R],
          [nn, -nn],
          [R, 0],
          [nn, nn],
          [0, R],
          [-nn, nn],
          [-R, 0],
          [-nn, -nn],
        ];
      g.beginPath();
      for (let q = 0; q < 8; q++) {
        const px = x + pts[q][0],
          py = y + pts[q][1];
        if (q) g.lineTo(px, py);
        else g.moveTo(px, py);
      }
      g.closePath();
      g.fill();
    };
    const mark = (
      g: CanvasRenderingContext2D,
      x: number,
      y: number,
      R: number,
      r: RNG,
    ): void => {
      const ty = Math.floor(r() * 5),
        rt = (r() - 0.5) * 0.8;
      g.save();
      g.translate(x, y);
      g.rotate(rt);
      if (ty === 0) {
        sparkle(g, 0, 0, R * 0.85);
      } else if (ty === 1) {
        spine(g, 0, R * 1.0, -Math.PI / 2, R * 2.2, R * 0.1, 0, r, {
          barbs: Math.round(3 + r() * 4),
          taperPow: 1.85,
          depth: 0,
          wobble: 0.03,
          side: 0,
        });
      } else if (ty === 2) {
        spine(g, -R * 0.5, R * 0.4, -Math.PI * 0.42, R * 1.9, R * 0.085, 0.5, r, {
          barbs: Math.round(3 + r() * 4),
          taperPow: 1.6,
          depth: 0,
          wobble: 0.05,
        });
      } else if (ty === 3) {
        const a = -Math.PI / 2 - 0.5;
        spine(g, 0, R * 0.2, a, R * 1.4, R * 0.075, 0.4, r, {
          barbs: Math.round(2 + r() * 3),
          taperPow: 1.7,
          depth: 0,
          wobble: 0.04,
        });
        spine(g, 0, R * 0.2, Math.PI * -0.5 + 0.5, R * 1.4, R * 0.075, -0.4, r, {
          barbs: Math.round(2 + r() * 3),
          taperPow: 1.7,
          depth: 0,
          wobble: 0.04,
        });
      } else {
        spine(g, 0, R, -Math.PI / 2, R * 1.6, R * 0.08, 0, r, {
          barbs: 2,
          taperPow: 1.85,
          depth: 0,
          wobble: 0.02,
          side: 0,
        });
        spine(g, 0, 0, -Math.PI * 0.62, R * 1.05, R * 0.06, 0.2, r, {
          barbs: 1,
          taperPow: 1.85,
          depth: 0,
        });
        spine(g, 0, 0, -Math.PI * 0.38, R * 1.05, R * 0.06, -0.2, r, {
          barbs: 1,
          taperPow: 1.85,
          depth: 0,
        });
      }
      g.restore();
    };
    const n = Math.max(0, Math.round(params.sigilMarkCount));
    const scat = params.sigilMarkScatter / 100;
    const ms = params.sigilMarkSize / 100;
    for (let i = 0; i < n; i++) {
      let mx: number, my: number;
      if (rng() < 0.15 + scat * 0.7) {
        mx = S * (0.1 + rng() * 0.8);
        my = S * (0.1 + rng() * 0.8);
      } else {
        const band = 0.05 + (1 - scat) * 0.08;
        const side = Math.floor(rng() * 4);
        if (side === 0) {
          mx = S * (0.04 + rng() * band * 2);
          my = S * (0.1 + rng() * 0.8);
        } else if (side === 1) {
          mx = S * (1 - 0.04 - rng() * band * 2);
          my = S * (0.1 + rng() * 0.8);
        } else if (side === 2) {
          my = S * (0.04 + rng() * band * 2);
          mx = S * (0.1 + rng() * 0.8);
        } else {
          my = S * (1 - 0.04 - rng() * band * 2);
          mx = S * (0.1 + rng() * 0.8);
        }
      }
      const R = S * (0.014 + ms * 0.04);
      const col = rng() < 0.5 ? main : ghost;
      ctx.save();
      ctx.globalAlpha = 0.55 + rng() * 0.4;
      ctx.fillStyle = rgb(col);
      ctx.strokeStyle = rgb(col);
      mark(ctx, mx, my, R, rng);
      ctx.restore();
    }
  }
}
