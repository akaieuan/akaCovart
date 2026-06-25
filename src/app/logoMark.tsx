import fs from "node:fs";
import path from "node:path";

// The brand mark is the engine-style grid render in `icon.svg` (organic soft
// blobs + film grain + soft-focus — generated from the dark palette). It's the
// favicon directly; here we load it once and expose a data-URI so the apple-icon
// and OG-image routes rasterise the SAME art through next/og (resvg). One source.
const svg = fs.readFileSync(
  path.join(process.cwd(), "src/app/icon.svg"),
  "utf8",
);

export const LOGO_DATA_URI = `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;
export const LOGO_BG = "#08090b";
