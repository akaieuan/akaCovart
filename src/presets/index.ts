export interface Preset {
  name: string;
  engine?: string;
  params: Record<string, any>;
  seed?: number;
}

// Curated presets — ported verbatim from the prototype (index.html `presets()`).
// All eight use the BLOB engine (the prototype's default field). The `params`
// object carries mood + composition/finish/texture/sigil values exactly as the
// prototype defined them.
export const presets: Preset[] = [
  {
    name: "VOID",
    params: {
      mood: "dark", density: 36, smear: 64, blobSize: 64, glow: 72, contrast: 55, saturation: 42,
      vignette: 48, bloom: 42, diamonds: true, diamondCount: 1, accent: 32, accentCount: 1,
      grain: 54, grainSize: 46, dust: 14, scratches: true, scratchCount: 4, sigilMarks: true,
      sigilMarkCount: 4, sigilMarkSize: 46, sigilMarkScatter: 52, sigilFrame: false, sigilFrameDensity: 46,
    },
  },
  {
    name: "RITUAL",
    params: {
      mood: "dark", density: 54, smear: 40, blobSize: 50, glow: 60, contrast: 52, saturation: 56,
      vignette: 34, bloom: 28, diamonds: true, diamondCount: 2, accent: 58, accentCount: 2,
      grain: 58, grainSize: 50, dust: 18, scratches: true, scratchCount: 6, sigilMarks: true,
      sigilMarkCount: 7, sigilMarkSize: 42, sigilMarkScatter: 64, sigilFrame: false, sigilFrameDensity: 62,
    },
  },
  {
    name: "ASH",
    params: {
      mood: "grey", density: 62, smear: 34, blobSize: 44, glow: 48, contrast: 54, saturation: 46,
      vignette: 30, bloom: 14, diamonds: true, diamondCount: 2, accent: 40, accentCount: 1,
      grain: 72, grainSize: 58, dust: 28, scratches: true, scratchCount: 9, sigilMarks: true,
      sigilMarkCount: 6, sigilMarkSize: 40, sigilMarkScatter: 58, sigilFrame: false, sigilFrameDensity: 56,
    },
  },
  {
    name: "BLEACH",
    params: {
      mood: "cream", density: 30, smear: 52, blobSize: 66, glow: 50, contrast: 48, saturation: 50,
      vignette: 22, bloom: 18, diamonds: true, diamondCount: 2, accent: 30, accentCount: 1,
      grain: 52, grainSize: 48, dust: 12, scratches: true, scratchCount: 5, sigilMarks: true,
      sigilMarkCount: 4, sigilMarkSize: 46, sigilMarkScatter: 50, sigilFrame: false, sigilFrameDensity: 34,
    },
  },
  {
    name: "TOXIC",
    params: {
      mood: "dark", density: 50, smear: 30, blobSize: 46, glow: 82, contrast: 58, saturation: 80,
      vignette: 30, bloom: 48, diamonds: true, diamondCount: 2, accent: 92, accentCount: 3,
      grain: 50, grainSize: 44, dust: 16, scratches: true, scratchCount: 6, sigilMarks: true,
      sigilMarkCount: 6, sigilMarkSize: 42, sigilMarkScatter: 60, sigilFrame: false, sigilFrameDensity: 50,
    },
  },
  {
    name: "STATIC",
    params: {
      mood: "grey", density: 40, smear: 26, blobSize: 40, glow: 50, contrast: 62, saturation: 38,
      vignette: 34, bloom: 12, diamonds: false, diamondCount: 1, accent: 30, accentCount: 1,
      grain: 94, grainSize: 64, dust: 42, scratches: true, scratchCount: 13, sigilMarks: true,
      sigilMarkCount: 9, sigilMarkSize: 38, sigilMarkScatter: 66, sigilFrame: true, sigilFrameDensity: 60,
    },
  },
  {
    name: "OBSIDIAN",
    params: {
      mood: "dark", density: 28, smear: 72, blobSize: 72, glow: 64, contrast: 60, saturation: 46,
      vignette: 56, bloom: 34, diamonds: true, diamondCount: 1, accent: 24, accentCount: 1,
      grain: 46, grainSize: 52, dust: 10, scratches: false, scratchCount: 3, sigilMarks: true,
      sigilMarkCount: 3, sigilMarkSize: 52, sigilMarkScatter: 40, sigilFrame: false, sigilFrameDensity: 54,
    },
  },
  {
    name: "HAZE",
    params: {
      mood: "cream", density: 44, smear: 58, blobSize: 58, glow: 52, contrast: 46, saturation: 54,
      vignette: 26, bloom: 22, diamonds: true, diamondCount: 3, accent: 48, accentCount: 2,
      grain: 54, grainSize: 50, dust: 14, scratches: true, scratchCount: 6, sigilMarks: true,
      sigilMarkCount: 5, sigilMarkSize: 44, sigilMarkScatter: 55, sigilFrame: false, sigilFrameDensity: 50,
    },
  },
];

export function getPresets(): Preset[] {
  return presets;
}
