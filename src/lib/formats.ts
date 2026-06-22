// ── Delivery formats ─────────────────────────────────────────────────────────
// The engine renders SQUARE only (see src/engine/render.ts — one `size` for both
// axes). Rather than rewrite every engine for arbitrary aspect ratios (and risk
// the flicker-free / deterministic guarantees), a "format" is a cover-crop of the
// square render into a target aspect ratio. This data drives both the live edit
// frame, the multi-format bento, and the per-format export.
//
// Pure data + math — NO DOM, NO React. The actual pixel work (render square ->
// cover-crop) lives in src/lib/export.ts (paintFormat / exportFormat).

export interface Format {
  id: string;
  label: string;
  ratio: string; // human label e.g. "9:16"
  hint: string; // where it's used, kept short
  w: number; // export pixel width
  h: number; // export pixel height
}

// Curated set. Square is the canonical cover (and the engine's native shape);
// the rest are the common social / delivery sizes. Add/remove freely — every
// surface is data-driven off this array.
export const FORMATS: Format[] = [
  { id: "square", label: "Square", ratio: "1:1", hint: "Cover", w: 3000, h: 3000 },
  { id: "story", label: "Story", ratio: "9:16", hint: "Reels · TikTok", w: 1688, h: 3000 },
  { id: "portrait", label: "Portrait", ratio: "4:5", hint: "Feed post", w: 2400, h: 3000 },
  { id: "landscape", label: "Landscape", ratio: "16:9", hint: "YouTube", w: 3000, h: 1688 },
  { id: "wide", label: "Banner", ratio: "3:1", hint: "Header", w: 3000, h: 1000 },
];

export const DEFAULT_FORMAT = "square";

const BY_ID = new Map(FORMATS.map((f) => [f.id, f]));

// Resolve an id to a Format, falling back to Square so callers never crash on a
// stale/unknown id.
export function getFormat(id: string | undefined | null): Format {
  return (id && BY_ID.get(id)) || BY_ID.get(DEFAULT_FORMAT) || FORMATS[0];
}

export function formatAspect(f: Format): number {
  return f.w / f.h;
}

// Source crop rect (within a `side`×`side` square) that COVER-fills the format's
// aspect, centred. Used by both preview and export so they match exactly.
export function coverCrop(
  side: number,
  f: Format,
): { sx: number; sy: number; sw: number; sh: number } {
  const a = formatAspect(f);
  let sw: number;
  let sh: number;
  if (a >= 1) {
    // landscape / wide — keep full width, crop top+bottom
    sw = side;
    sh = side / a;
  } else {
    // portrait / story — keep full height, crop left+right
    sh = side;
    sw = side * a;
  }
  return { sx: (side - sw) / 2, sy: (side - sh) / 2, sw, sh };
}

// Scale a format down so its LONGEST edge == maxSide (for cheap previews).
export function fitDims(f: Format, maxSide: number): { w: number; h: number } {
  const longest = Math.max(f.w, f.h);
  const k = maxSide / longest;
  return { w: Math.max(1, Math.round(f.w * k)), h: Math.max(1, Math.round(f.h * k)) };
}
