import { prng } from "../prng";
import { parseHex } from "../palettes";

// ─────────────────────────────────────────────────────────────────────────────
// Shared TEXT COVERAGE MASK for the TxT engines.
//
// Rasterizes the display text (headline `txtText` + optional subline `txtSub`)
// ONCE into a module-level offscreen canvas — centred and auto-fit to the frame
// (the px size is solved from a width target so any word length fits) — using the
// shared `textFont` / `textCase`. Exposes:
//   • `canvas` — white text on transparent (for the drawImage/blur-based engine)
//   • `sample(u,v)` — fast bilinear coverage in [0,1] at normalized coords
//
// Cached by the text params (words / size / font / case / seed) so it only
// re-rasterizes when those change. Engines drive MOTION by transforming the
// (u,v) they sample — NEVER by re-rasterizing — so motion stays cheap, the still
// is a fixed frame, and the colour at a glyph point is time-independent. The
// engine is a singleton and every field() call is synchronous + self-contained,
// so the module-level buffer never races (same pattern as flux/signal).
// ─────────────────────────────────────────────────────────────────────────────

const MR = 512; // mask resolution — crisp glyph edges; engines sample it down

let mcanvas: HTMLCanvasElement | null = null;
let cov: Float32Array | null = null;
let maskObj: TextMask | null = null;
let cacheKey = "";

export interface TextMask {
  canvas: HTMLCanvasElement; // white text on transparent
  res: number;
  /** Bilinear coverage 0..1 at normalized coords (0..1). Outside the frame => 0. */
  sample(u: number, v: number): number;
}

function applyCase(s: string, mode: string | undefined, rnd: () => number): string {
  const t = (s || "") + "";
  if (mode === "lower") return t.toLowerCase();
  if (mode === "upper") return t.toUpperCase();
  if (mode === "manic") {
    let o = "";
    for (let i = 0; i < t.length; i++) o += rnd() < 0.5 ? t[i].toLowerCase() : t[i].toUpperCase();
    return o;
  }
  return t; // "asis"
}

export function getTextMask(params: Record<string, any>, seed: number): TextMask {
  const family = params.textFont || "Space Grotesk";
  const fam = "'" + family + "', system-ui, sans-serif";
  const rawTitle = (params.txtText == null ? "AKA" : params.txtText) + "";
  const rawSub = (params.txtSub == null ? "" : params.txtSub) + "";
  const sizeP = (params.txtSize == null ? 55 : params.txtSize) / 100;
  const caseMode = params.textCase || "upper";
  // Whether the chosen face is actually downloaded. The canvas only paints with a
  // loaded font, so rasterizing before load bakes the FALLBACK glyphs. Fold the
  // ready-state into the cache key so the mask rebuilds once the real face loads
  // (CanvasStage repaints on `document.fonts.ready` / font change). Without this,
  // a fallback-rendered mask would stick because the font NAME never changed.
  const ready =
    typeof document !== "undefined" && document.fonts
      ? document.fonts.check(`700 64px "${family}"`)
      : true;
  const align = (params.txtAlign as string) || "center";
  const valign = (params.txtVAlign as string) || "middle";
  const key = [fam, rawTitle, rawSub, sizeP.toFixed(3), caseMode, align, valign, seed, ready].join("|");

  if (maskObj && key === cacheKey) return maskObj;

  if (!mcanvas) mcanvas = document.createElement("canvas");
  if (mcanvas.width !== MR || mcanvas.height !== MR) {
    mcanvas.width = MR;
    mcanvas.height = MR;
  }
  const g = mcanvas.getContext("2d")!;
  g.clearRect(0, 0, MR, MR);

  const rnd = prng(seed ^ 0x51ed270b);
  const title = applyCase(rawTitle, caseMode, rnd);
  const sub = applyCase(rawSub, caseMode, rnd);

  g.fillStyle = "#fff";
  g.textBaseline = "middle";
  // Horizontal anchor from the align option.
  g.textAlign = align === "left" ? "left" : align === "right" ? "right" : "center";
  const hMargin = 0.06 * MR;
  const ax = align === "left" ? hMargin : align === "right" ? MR - hMargin : MR / 2;

  const hasSub = sub.trim().length > 0;
  const targetW = (0.3 + sizeP * 0.62) * MR; // headline width target (auto-fit)
  const maxLineH = (hasSub ? 0.42 : 0.6) * MR;

  // Solve the px size that hits the width target (capped by a max line height).
  const fit = (text: string, tW: number, maxH: number, weight: string): number => {
    if (!text) return 0;
    const base = 200;
    g.font = `${weight} ${base}px ${fam}`;
    const w = Math.max(1, g.measureText(text).width);
    let px = (base * tW) / w;
    if (px > maxH) px = maxH;
    return px;
  };

  const titlePx = fit(title, targetW, maxLineH, "700");
  const subPx = hasSub ? fit(sub, targetW * 0.66, maxLineH * 0.5, "500") : 0;
  const gap = hasSub ? titlePx * 0.16 : 0;
  const totalH = titlePx + (hasSub ? gap + subPx : 0);
  // Vertical anchor from the valign option — position the whole block as a unit.
  const vMargin = 0.08 * MR;
  const blockTop =
    valign === "top"
      ? vMargin
      : valign === "bottom"
        ? MR - totalH - vMargin
        : MR / 2 - totalH / 2;
  const cyTitle = blockTop + titlePx / 2;
  g.font = `700 ${titlePx}px ${fam}`;
  g.fillText(title, ax, cyTitle);
  if (hasSub) {
    const cySub = blockTop + titlePx + gap + subPx / 2;
    g.font = `500 ${subPx}px ${fam}`;
    g.fillText(sub, ax, cySub);
  }

  const img = g.getImageData(0, 0, MR, MR).data;
  const c = new Float32Array(MR * MR);
  for (let i = 0; i < MR * MR; i++) c[i] = img[i * 4 + 3] / 255;
  cov = c;
  cacheKey = key;
  maskObj = makeMask(mcanvas, cov);
  return maskObj;
}

// Two-tone ink: the palette colour that contrasts the background (cfg.base) most,
// so the stark TxT engines always read against the mood. Falls back to the base's
// inverse when the palette has no colours.
export function pickInk(base: number[], colors: number[][]): number[] {
  const lum = (c: number[]): number => 0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2];
  const cols = colors && colors.length ? colors : [[255 - base[0], 255 - base[1], 255 - base[2]]];
  const bl = lum(base);
  let best = cols[0];
  let bd = -1;
  for (const c of cols) {
    const d = Math.abs(lum(c) - bl);
    if (d > bd) {
      bd = d;
      best = c;
    }
  }
  return best;
}

// Resolve the two-tone colours for a TxT engine: direct `txtBg`/`txtInk` hex
// overrides when set, else derived from the mood (bg = base, ink = pickInk).
export function txtTones(
  params: Record<string, any>,
  cfg: { base: number[]; colors: number[][] },
): { bg: number[]; ink: number[] } {
  const bgHex = typeof params.txtBg === "string" ? parseHex(params.txtBg) : null;
  const inkHex = typeof params.txtInk === "string" ? parseHex(params.txtInk) : null;
  return {
    bg: bgHex ?? cfg.base,
    ink: inkHex ?? pickInk(cfg.base, cfg.colors),
  };
}

function makeMask(canvas: HTMLCanvasElement, c: Float32Array): TextMask {
  return {
    canvas,
    res: MR,
    sample(u: number, v: number): number {
      if (u < 0 || u > 1 || v < 0 || v > 1) return 0;
      const x = u * (MR - 1);
      const y = v * (MR - 1);
      const x0 = x | 0;
      const y0 = y | 0;
      const x1 = x0 + 1 < MR ? x0 + 1 : x0;
      const y1 = y0 + 1 < MR ? y0 + 1 : y0;
      const fx = x - x0;
      const fy = y - y0;
      const a = c[y0 * MR + x0];
      const b = c[y0 * MR + x1];
      const d = c[y1 * MR + x0];
      const e = c[y1 * MR + x1];
      const top = a + (b - a) * fx;
      const bot = d + (e - d) * fx;
      return top + (bot - top) * fy;
    },
  };
}
