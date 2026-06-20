import type { Palette } from "../types";
import { rgb } from "../color";

// Soften / blur pass — ported from the prototype (index.html renderTo soften block).
// Re-floors the base color before re-blitting so edges fade into the base, not black.
export function soften(
  ctx: CanvasRenderingContext2D,
  size: number,
  amount: number,
  cfg: Palette,
): void {
  if (amount <= 0) return;
  const sof = amount / 100;
  const tb = document.createElement("canvas");
  tb.width = size;
  tb.height = size;
  tb.getContext("2d")!.drawImage(ctx.canvas, 0, 0);
  ctx.clearRect(0, 0, size, size);
  ctx.fillStyle = rgb(cfg.base);
  ctx.fillRect(0, 0, size, size);
  ctx.save();
  ctx.filter = "blur(" + sof * size * 0.05 + "px)";
  ctx.drawImage(tb, 0, 0);
  ctx.restore();
  ctx.filter = "none";
}
