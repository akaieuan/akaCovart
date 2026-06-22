// Cover text is drawn on a <canvas>, which can only paint with a web font the
// browser has actually DOWNLOADED. A CSS @import registers the @font-face rules,
// but the font file is fetched lazily — only when a rendered DOM node uses that
// family. Nothing in the DOM renders the cover faces (Anton / Instrument Serif /
// Syne / Space Grotesk), so without an explicit request the canvas silently
// falls back to system-ui and switching fonts appears to do nothing.
//
// `ensureCoverFont` requests the chosen family at the two weights the type
// overlay uses (title 600, artist 400) and resolves once they're ready, so the
// caller can repaint with the real face. Safe to call repeatedly — the browser
// caches loaded faces, so a second call for an already-loaded family is instant.
export function ensureCoverFont(family: string | undefined): Promise<void> {
  if (typeof document === "undefined" || !document.fonts) return Promise.resolve();
  const fam = family || "Space Grotesk";
  return Promise.all([
    document.fonts.load(`600 64px "${fam}"`),
    document.fonts.load(`400 64px "${fam}"`),
  ])
    .then(() => undefined)
    .catch(() => undefined);
}
