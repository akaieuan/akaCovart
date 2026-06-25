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
// Run:  node scripts/gen-share-assets.mjs   (re-run if the logo changes)
import { Resvg } from "@resvg/resvg-js";
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

// Favicon + apple icon: the square tile itself.
writeFileSync("public/favicon.png", png(icon, 512));
writeFileSync("public/apple-icon.png", png(icon, 180));

// OG: the mark centred on the dark tile (1200×630). Nest the icon as a sub-<svg>
// so its filters/ids stay scoped, then rasterize the single composed document.
const inner = icon.replace(
  /<svg\b[^>]*>/,
  '<svg x="324" y="39" width="552" height="552" viewBox="0 0 120 120">',
);
const og = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630"><rect width="1200" height="630" fill="#08090b"/>${inner}</svg>`;
writeFileSync("public/og.png", png(og, 1200));

console.log("share assets written: public/{favicon,apple-icon,og}.png");
