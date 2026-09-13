// Render deterministic cover art for external consumers (e.g. the akaOSS
// research feed) using this repo's own engine, headless.
//
// Why a browser: src/engine is framework-agnostic but NOT DOM-agnostic. It
// calls document.createElement("canvas"), ctx.filter and ImageData, all of
// which a real browser provides and plain Node does not. Rather than shim
// them, we bundle the engine and run it in headless Chrome. The engine is
// used as a library; nothing about the studio UI is automated, so this cannot
// break when the UI changes.
//
// Deterministic by construction: the seed is derived from the slug, so a
// given slug always produces the same artwork on any machine.
//
//   node scripts/gen-covers.mjs --out ../path/to/public/covers --slugs a,b,c
//   node scripts/gen-covers.mjs --out ./out --slugs demo --width 1600 --height 900
import { build } from "esbuild";
import puppeteer from "puppeteer-core";
import sharp from "sharp";
import { mkdirSync, writeFileSync, rmSync } from "node:fs";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";

// ── args ────────────────────────────────────────────────────────────────────
const argv = process.argv.slice(2);
const arg = (k, d) => {
  const i = argv.indexOf(`--${k}`);
  return i >= 0 && argv[i + 1] ? argv[i + 1] : d;
};
const OUT = resolve(arg("out", "./covers"));
const SLUGS = arg("slugs", "").split(",").map((s) => s.trim()).filter(Boolean);
const W = Number(arg("width", "1600"));
const H = Number(arg("height", "900"));
const QUALITY = Number(arg("quality", "86"));

if (!SLUGS.length) {
  console.error("nothing to do: pass --slugs a,b,c");
  process.exit(1);
}

const CHROME =
  process.env.CHROME_PATH ??
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";

// ── seed + look, derived from the slug ──────────────────────────────────────
// FNV-1a. Small, stable across machines, and good enough to scatter slugs.
function hash(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

// A family, not a free-for-all: every cover is the same engine and mood, and
// only the scene, palette and seed move. Covers should look like siblings.
const SCENES = ["ridgeline", "dunes", "coast", "basin", "mesa", "storm"];
// "paper" is a light ground and reads washed out against a dark site;
// dusk and ash keep the family in the same tonal range as akaoss.
const PALETTES = ["dusk", "ash"];

function lookFor(slug) {
  const h = hash(slug);
  return {
    seed: h,
    oilScene: SCENES[h % SCENES.length],
    oilPalette: PALETTES[(h >>> 8) % PALETTES.length],
    // Keep the horizon in a narrow band so a 16:9 crop always has sky above
    // and ground below, whatever the scene.
    oilHorizon: 52 + ((h >>> 16) % 18),
    // Pull the whole field down so type and UI sit comfortably on top.
    oilLight: 34 + ((h >>> 20) % 10),
    oilSat: 42 + ((h >>> 24) % 12),
  };
}

// ── bundle the engine for the browser ───────────────────────────────────────
const tmp = join(tmpdir(), `covart-covers-${process.pid}`);
mkdirSync(tmp, { recursive: true });

const entry = join(tmp, "entry.ts");
writeFileSync(
  entry,
  `import * as E from "${resolve("src/engine/index.ts").replace(/\\/g, "/")}";
   (globalThis as any).__ENGINE__ = E;`,
);

await build({
  entryPoints: [entry],
  bundle: true,
  format: "iife",
  outfile: join(tmp, "engine.js"),
  tsconfig: resolve("tsconfig.json"),
  logLevel: "error",
  target: ["chrome120"],
});

writeFileSync(
  join(tmp, "page.html"),
  `<!doctype html><meta charset="utf-8">
   <body style="margin:0;background:#000">
   <canvas id="c"></canvas>
   <script src="./engine.js"></script>`,
);

// ── render ──────────────────────────────────────────────────────────────────
mkdirSync(OUT, { recursive: true });

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: true,
  args: ["--no-sandbox", "--disable-gpu", "--allow-file-access-from-files"],
});

try {
  const page = await browser.newPage();
  await page.goto(`file://${join(tmp, "page.html")}`, {
    waitUntil: "load",
  });
  await page.waitForFunction("!!globalThis.__ENGINE__", { timeout: 30_000 });

  for (const slug of SLUGS) {
    const look = lookFor(slug);

    const dataUrl = await page.evaluate(
      (w, h, engineId, look) => {
        const E = globalThis.__ENGINE__;

        // Build a complete param bag from the engine's own declared defaults,
        // so this script never has to restate the engine's schema.
        const params = {};
        for (const p of E.sharedParams) params[p.key] = p.default;
        const eng = E.getEngine(engineId);
        if (!eng) throw new Error(`engine not registered: ${engineId}`);
        for (const p of eng.params) params[p.key] = p.default;

        Object.assign(params, look, {
          engine: engineId,
          focus: "art",
          // Album typography is wrong for a research header.
          showText: false,
          mood: "dark",
        });

        const cv = document.getElementById("c");
        cv.width = w;
        cv.height = h;
        E.renderFormatTo(cv, params);
        return cv.toDataURL("image/png");
      },
      W,
      H,
      "oil",
      look,
    );

    const png = Buffer.from(dataUrl.split(",")[1], "base64");
    const out = join(OUT, `${slug}.jpg`);
    const buf = await sharp(png)
      .jpeg({ quality: QUALITY, mozjpeg: true })
      .toBuffer();
    writeFileSync(out, buf);
    console.log(
      `  ${slug}.jpg  ${(buf.length / 1024).toFixed(0)}K  ` +
        `${look.oilScene}/${look.oilPalette} seed=${look.seed}`,
    );
  }
} finally {
  await browser.close();
  rmSync(tmp, { recursive: true, force: true });
}

console.log(`\nwrote ${SLUGS.length} cover(s) to ${OUT}`);
