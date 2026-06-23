import type { Mood, RNG, TextBox } from "../types";

// Title / artist type overlay — ported from the prototype (index.html `text`).
// Handles case, distort/glitch + chromatic split, alignment, position.
// Returns the normalized bounding box (TextBox) for hit-testing / drag.
//
// FORMAT-AWARE: takes explicit width + height (not a single square size) so the
// type can be placed correctly in ANY delivery format. textX/textY are fractions
// of the frame (so the type sits at the same relative spot — e.g. bottom-left —
// in square, story, banner, etc., and is never cropped off). Type SIZE scales
// with the shorter edge so it always fits the frame. For a square (w === h) the
// output is byte-identical to the original.
export function drawText(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  params: Record<string, any>,
  mood: Mood,
  rng: RNG,
): TextBox {
  const W = w;
  const H = h;
  // Type metric reference — shorter edge keeps the type readable AND inside the
  // frame for tall (9:16) and wide (3:1) crops alike. == S for a square.
  const REF = Math.min(W, H);
  const base = REF * 0.019;
  // Cover typeface — a curated, browser-loaded font (canvas-safe family name).
  // Falls back to Space Grotesk / system if the chosen font is unavailable.
  const fam = "'" + (params.textFont || "Space Grotesk") + "', system-ui, sans-serif";
  let col: string, sh: string;
  if (params.textColor === "auto") {
    if (mood === "dark") {
      col = "rgba(233,233,236,0.95)";
      sh = "rgba(0,0,0,0.40)";
    } else {
      col = "rgba(22,22,24,0.92)";
      sh = "rgba(255,255,255,0.35)";
    }
  } else if (params.textColor === "light") {
    col = "rgba(244,244,246,0.96)";
    sh = "rgba(0,0,0,0.40)";
  } else {
    col = "rgba(18,18,20,0.94)";
    sh = "rgba(255,255,255,0.35)";
  }

  const caseFn = (t: string | undefined): string => {
    const s = (t || "") + "";
    if (params.textCase === "lower") return s.toLowerCase();
    if (params.textCase === "upper") return s.toUpperCase();
    if (params.textCase === "manic") {
      let o = "";
      for (let i = 0; i < s.length; i++) {
        o += rng() < 0.5 ? s[i].toLowerCase() : s[i].toUpperCase();
      }
      return o;
    }
    return s;
  };

  const title = caseFn(params.title),
    artist = caseFn(params.artist);
  const d = Math.max(0, Math.min(1, (params.distort || 0) / 100));
  const align = params.textAlign || "left";
  const ax = (params.textX == null ? 0.05 : params.textX) * W,
    ay = (params.textY == null ? 0.85 : params.textY) * H;
  const gap = base * 1.5,
    ls = base * 0.18;

  const tc = document.createElement("canvas");
  tc.width = W;
  tc.height = H;
  const g = tc.getContext("2d")!;
  g.fillStyle = col;
  g.textAlign = "left";
  g.textBaseline = "alphabetic";
  const box = { minX: 1e9, maxX: -1e9, minY: 1e9, maxY: -1e9 };

  const line = (
    str: string,
    baseY: number,
    weight: string,
    sizePx: number,
    alpha: number,
  ): void => {
    g.font = weight + " " + sizePx + "px " + fam;
    const chs = (str + "").split("");
    const widths: number[] = [];
    let total = 0;
    for (let i = 0; i < chs.length; i++) {
      const cw = g.measureText(chs[i]).width;
      widths.push(cw);
      total += cw + ls;
    }
    total -= ls;
    if (total < 0) total = 0;
    let cxp = align === "center" ? ax - total / 2 : align === "right" ? ax - total : ax;
    box.minX = Math.min(box.minX, cxp);
    box.maxX = Math.max(box.maxX, cxp + total);
    box.minY = Math.min(box.minY, baseY - sizePx);
    box.maxY = Math.max(box.maxY, baseY + sizePx * 0.18);
    for (let i = 0; i < chs.length; i++) {
      const jx = (rng() - 0.5) * d * sizePx * 0.45,
        jy = (rng() - 0.5) * d * sizePx * 0.55,
        jr = (rng() - 0.5) * d * 0.4;
      let ca = alpha;
      if (rng() < d * 0.18) {
        ca *= 0.18 + rng() * 0.4;
      }
      g.save();
      g.translate(cxp + jx, baseY + jy);
      g.rotate(jr);
      g.globalAlpha = ca;
      g.fillText(chs[i], 0, 0);
      if (rng() < d * 0.12) {
        g.globalAlpha = ca * 0.5;
        g.fillText(chs[i], (rng() - 0.5) * sizePx * 0.45, (rng() - 0.5) * sizePx * 0.3);
      }
      g.restore();
      cxp += widths[i] + ls;
    }
  };

  const ty1 = ay + base,
    ty2 = ty1 + gap;
  line(title, ty1, "600", base, 1);
  line(artist, ty2, "400", base * 0.82, 0.68);

  const textBox: TextBox = {
    x: box.minX / W,
    y: box.minY / H,
    w: (box.maxX - box.minX) / W,
    h: (box.maxY - box.minY) / H,
  };

  let src: HTMLCanvasElement = tc;
  if (d > 0.01) {
    const o = document.createElement("canvas");
    o.width = W;
    o.height = H;
    const og = o.getContext("2d")!;
    const slices = Math.floor(8 + d * 22),
      sh2 = H / slices;
    for (let s2 = 0; s2 < slices; s2++) {
      const ox = rng() < 0.45 ? (rng() - 0.5) * d * W * 0.05 : 0;
      og.drawImage(tc, 0, s2 * sh2, W, sh2, ox, s2 * sh2, W, sh2);
    }
    src = o;
  }

  ctx.save();
  ctx.shadowColor = sh;
  ctx.shadowBlur = REF * 0.004;
  if (d > 0.02) {
    const off = d * W * 0.01;
    const tint = (s3: HTMLCanvasElement, color: string): HTMLCanvasElement => {
      const t = document.createElement("canvas");
      t.width = W;
      t.height = H;
      const tg = t.getContext("2d")!;
      tg.drawImage(s3, 0, 0);
      tg.globalCompositeOperation = "source-in";
      tg.fillStyle = color;
      tg.fillRect(0, 0, W, H);
      return t;
    };
    ctx.globalAlpha = 0.45 * d;
    ctx.drawImage(tint(src, "rgb(255,40,70)"), -off, 0);
    ctx.drawImage(tint(src, "rgb(0,210,255)"), off, 0);
    ctx.globalAlpha = 1;
  }
  ctx.drawImage(src, 0, 0);
  ctx.restore();

  return textBox;
}
