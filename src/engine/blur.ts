// Cross-browser canvas blur.
//
// WebKit / iOS Safari accepts `ctx.filter = "blur(Npx)"` — the property even
// reflects the string back — but DOES NOT apply it when compositing. So every
// blur pass (soften, bloom, blob smear) silently no-ops on iPhone, leaving raw
// hard-edged geometry. Feature-detecting by reading `ctx.filter` is useless
// because the property lies; we have to probe the actual pixels.
//
// Strategy: use native `ctx.filter` where it genuinely blurs (Chromium/Firefox —
// true Gaussian, unchanged look), else fall back to a downscale→upscale blur
// (bilinear smoothing spreads each pixel; cheap and works everywhere).

let _nativeBlur: boolean | null = null;

function nativeBlurWorks(): boolean {
  if (_nativeBlur !== null) return _nativeBlur;
  try {
    const src = document.createElement("canvas");
    src.width = src.height = 16;
    const sg = src.getContext("2d")!;
    sg.fillStyle = "#fff";
    sg.fillRect(0, 0, 8, 16); // hard vertical edge at x=8 (white | transparent)

    const dst = document.createElement("canvas");
    dst.width = dst.height = 16;
    const dg = dst.getContext("2d")!;
    dg.filter = "blur(3px)";
    dg.drawImage(src, 0, 0);
    dg.filter = "none";

    // At the edge column a real blur bleeds white across (partial alpha);
    // an ignored filter leaves it fully transparent (0) or fully opaque (255).
    const a = dg.getImageData(8, 8, 1, 1).data[3];
    _nativeBlur = a > 20 && a < 235;
  } catch {
    _nativeBlur = false;
  }
  return _nativeBlur;
}

// Draw `src` onto `ctx` blurred by ~radiusPx, honoring the ctx's current alpha
// and composite op. `size` is the destination square edge. Callers should wrap
// in ctx.save()/restore() (they set alpha/blend around it already).
export function drawBlurred(
  ctx: CanvasRenderingContext2D,
  src: CanvasImageSource,
  size: number,
  radiusPx: number,
): void {
  if (radiusPx <= 0.5) {
    ctx.drawImage(src, 0, 0, size, size);
    return;
  }

  if (nativeBlurWorks()) {
    ctx.filter = "blur(" + radiusPx + "px)";
    ctx.drawImage(src, 0, 0, size, size);
    ctx.filter = "none";
    return;
  }

  // Fallback — downscale then upscale. Downscaling to size/factor and stretching
  // back spreads each source texel over ~factor dest px (tent kernel ≈ factor/2
  // wide), approximating a blur of radius ≈ radiusPx. Clamp so we never go below
  // a 1px buffer or shrink so hard the frame turns to mush.
  const factor = Math.max(2, Math.min(size / 3, radiusPx * 2));
  const w = Math.max(1, Math.round(size / factor));
  const tmp = document.createElement("canvas");
  tmp.width = w;
  tmp.height = w;
  const tg = tmp.getContext("2d")!;
  tg.imageSmoothingEnabled = true;
  tg.imageSmoothingQuality = "high";
  tg.drawImage(src, 0, 0, w, w);

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(tmp, 0, 0, w, w, 0, 0, size, size);
}
