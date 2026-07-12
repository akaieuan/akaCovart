import type { RNG } from "../types";

// STATIC film grain — ported from the prototype (index.html `grain`).
// The prototype had an optional per-frame `boil` reseed using Math.random();
// that is intentionally DROPPED here. Grain is fully deterministic from `rng`.
export function grain(
  ctx: CanvasRenderingContext2D,
  size: number,
  amount: number,
  gsize: number,
  rng: RNG,
): void {
  if (amount > 0) {
    const gw = Math.max(48, Math.round(size / 1.2 / (0.7 + (gsize / 100) * 3.2)));
    const nz = document.createElement("canvas");
    nz.width = gw;
    nz.height = gw;
    const nc = nz.getContext("2d")!;
    const img = nc.createImageData(gw, gw);
    const d = img.data;
    const amp = amount / 100;
    for (let i = 0; i < d.length; i += 4) {
      const v = 128 + (rng() - 0.5) * amp * 185;
      d[i] = v;
      d[i + 1] = v;
      d[i + 2] = v;
      d[i + 3] = 255;
    }
    nc.putImageData(img, 0, 0);
    ctx.save();
    ctx.globalCompositeOperation = "overlay";
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(nz, 0, 0, size, size);
    ctx.restore();
  }
}
