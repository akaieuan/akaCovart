import type { Mood, RNG, TextBox } from "../types";

// Title / artist type overlay — ported from the prototype (index.html `text`).
// Handles case, distort/glitch + chromatic split, alignment, position.
// Returns the normalized bounding box (TextBox) for hit-testing / drag.
export function drawText(
  ctx: CanvasRenderingContext2D,
  size: number,
  params: Record<string, any>,
  mood: Mood,
  rng: RNG,
): TextBox {
  const S = size;
  const base = S * 0.019;
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
  const ax = (params.textX == null ? 0.05 : params.textX) * S,
    ay = (params.textY == null ? 0.85 : params.textY) * S;
  const gap = base * 1.5,
    ls = base * 0.18;

  const tc = document.createElement("canvas");
  tc.width = S;
  tc.height = S;
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
    g.font = weight + " " + sizePx + "px 'IBM Plex Mono'";
    const chs = (str + "").split("");
    const widths: number[] = [];
    let total = 0;
    for (let i = 0; i < chs.length; i++) {
      const w = g.measureText(chs[i]).width;
      widths.push(w);
      total += w + ls;
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
    x: box.minX / S,
    y: box.minY / S,
    w: (box.maxX - box.minX) / S,
    h: (box.maxY - box.minY) / S,
  };

  let src: HTMLCanvasElement = tc;
  if (d > 0.01) {
    const o = document.createElement("canvas");
    o.width = S;
    o.height = S;
    const og = o.getContext("2d")!;
    const slices = Math.floor(8 + d * 22),
      sh2 = S / slices;
    for (let s2 = 0; s2 < slices; s2++) {
      const ox = rng() < 0.45 ? (rng() - 0.5) * d * S * 0.05 : 0;
      og.drawImage(tc, 0, s2 * sh2, S, sh2, ox, s2 * sh2, S, sh2);
    }
    src = o;
  }

  ctx.save();
  ctx.shadowColor = sh;
  ctx.shadowBlur = S * 0.004;
  if (d > 0.02) {
    const off = d * S * 0.01;
    const tint = (s3: HTMLCanvasElement, color: string): HTMLCanvasElement => {
      const t = document.createElement("canvas");
      t.width = S;
      t.height = S;
      const tg = t.getContext("2d")!;
      tg.drawImage(s3, 0, 0);
      tg.globalCompositeOperation = "source-in";
      tg.fillStyle = color;
      tg.fillRect(0, 0, S, S);
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
