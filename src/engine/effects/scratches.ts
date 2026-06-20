import type { RNG, Palette } from "../types";

// Surface scratch lines — ported from the prototype (index.html renderTo scratches block).
// Deterministic: driven entirely by the supplied RNG.
export function scratches(
  ctx: CanvasRenderingContext2D,
  size: number,
  count: number,
  rng: RNG,
  cfg: Palette,
): void {
  if (count <= 0) return;
  ctx.save();
  ctx.lineWidth = Math.max(1, size * 0.0011);
  for (let sc = 0; sc < count; sc++) {
    let sx = size * (0.08 + rng() * 0.84),
      sy = size * (rng() * 0.08);
    ctx.beginPath();
    ctx.moveTo(sx, sy);
    const steps = 26,
      len = size * (0.6 + rng() * 0.38),
      dyy = len / steps;
    for (let st = 0; st < steps; st++) {
      sx += (rng() - 0.5) * size * 0.004;
      sy += dyy;
      ctx.lineTo(sx, sy);
    }
    ctx.strokeStyle = cfg.scratch;
    ctx.globalAlpha = 0.1 + rng() * 0.16;
    ctx.stroke();
  }
  ctx.restore();
  ctx.globalAlpha = 1;
}
