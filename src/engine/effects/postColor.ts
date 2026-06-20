// Contrast / saturation grading — ported from the prototype (index.html `postColor`).
export function postColor(
  ctx: CanvasRenderingContext2D,
  size: number,
  contrast: number,
  sat: number,
): void {
  if (contrast === 50 && sat === 50) return;
  const cc = 1 + ((contrast - 50) / 50) * 0.7;
  const sf = sat / 50;
  const img = ctx.getImageData(0, 0, size, size);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    let r = d[i],
      g = d[i + 1],
      b = d[i + 2];
    r = (r - 128) * cc + 128;
    g = (g - 128) * cc + 128;
    b = (b - 128) * cc + 128;
    const gray = 0.299 * r + 0.587 * g + 0.114 * b;
    r = gray + (r - gray) * sf;
    g = gray + (g - gray) * sf;
    b = gray + (b - gray) * sf;
    d[i] = r < 0 ? 0 : r > 255 ? 255 : r;
    d[i + 1] = g < 0 ? 0 : g > 255 ? 255 : g;
    d[i + 2] = b < 0 ? 0 : b > 255 ? 255 : b;
  }
  ctx.putImageData(img, 0, 0);
}
