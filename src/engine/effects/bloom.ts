import { drawBlurred } from "../blur";

// Additive bloom pass — ported from the prototype (index.html `bloom`).
export function bloom(ctx: CanvasRenderingContext2D, size: number, amount: number): void {
  if (amount <= 0) return;
  const b = amount / 100;
  const t = document.createElement("canvas");
  t.width = size;
  t.height = size;
  t.getContext("2d")!.drawImage(ctx.canvas, 0, 0);
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  ctx.globalAlpha = 0.42 * b;
  drawBlurred(ctx, t, size, size * 0.018);
  ctx.restore();
  ctx.globalAlpha = 1;
}
