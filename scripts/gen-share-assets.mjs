// Rasterize the brand mark (public/icon.svg) into the STATIC share assets that a
// static export needs with real .png extensions + image/png content-type:
//   public/favicon.png      512×512  PNG favicon (link-preview crawlers that
//                                    ignore SVG favicons use this)
//   public/apple-icon.png   180×180  apple-touch-icon (iMessage / Safari cards)
//   public/og.png          1200×630  Open Graph / Twitter share image
//
// We previously generated these via next/og route handlers (opengraph-image.tsx,
// apple-icon.tsx). Under `output: export` those emit EXTENSIONLESS files that the
// static host serves as application/octet-stream, so every link-preview consumer
// rejected them. Shipping real .png files fixes the content-type for good.
//
// Run:  pnpm gen:share   (re-run if the logo changes)
import { Resvg } from "@resvg/resvg-js";
import sharp from "sharp";
import { readFileSync, writeFileSync } from "node:fs";

const icon = readFileSync("public/icon.svg", "utf8");

function png(svg, width) {
  const r = new Resvg(svg, {
    fitTo: { mode: "width", value: width },
    // Keep whatever the SVG paints (the mark has its own opaque dark bg rect).
    background: "rgba(0,0,0,0)",
    font: { loadSystemFonts: false },
  });
  return r.render().asPng();
}

// resvg emits full 8-bit RGBA. For a flat dark mark with a couple of soft
// gradients that is ~2.5x larger than it needs to be (favicon.png shipped at
// 444K), and the favicon is fetched on every cold visit. Quantize to a palette
// before writing: measured error is <=12/255 on any channel (mean 0.75) — not
// visible on this artwork — for ~60% off the shipped bytes.
async function writePng(path, buf) {
  const out = await sharp(buf)
    .png({ palette: true, quality: 100, compressionLevel: 9, effort: 10 })
    .toBuffer();
  writeFileSync(path, out);
  console.log(`  ${path}  ${(out.length / 1024).toFixed(0)}K`);
}

// Favicon + apple icon: the square tile itself.
await writePng("public/favicon.png", png(icon, 512));
await writePng("public/apple-icon.png", png(icon, 180));

// OG: the mark centred on the dark tile (1200×630). Nest the icon as a sub-<svg>
// so its filters/ids stay scoped, then rasterize the single composed document.
const inner = icon.replace(
  /<svg\b[^>]*>/,
  '<svg x="324" y="39" width="552" height="552" viewBox="0 0 120 120">',
);
const og = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630"><rect width="1200" height="630" fill="#08090b"/>${inner}</svg>`;
await writePng("public/og.png", png(og, 1200));

console.log("share assets written: public/{favicon,apple-icon,og}.png");
