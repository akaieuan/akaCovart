// Vignette pass — ported from the prototype (index.html `vignette`).
export function vignette(ctx: CanvasRenderingContext2D, size: number, amount: number): void {
  if (amount <= 0) return;
  const v = amount / 100;
  const g = ctx.createRadialGradient(
    size / 2,
    size * 0.46,
    size * 0.2,
    size / 2,
    size / 2,
    size * 0.74,
  );
  g.addColorStop(0, "rgba(0,0,0,0)");
  g.addColorStop(1, "rgba(0,0,0," + 0.7 * v + ")");
  ctx.save();
  ctx.globalCompositeOperation = "multiply";
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  ctx.restore();
}
