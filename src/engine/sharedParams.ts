import type { ParamDef } from "./types";

// Shared (non-engine, non-seed) parameters — mood + finish + texture + type.
// Min/max/defaults match the prototype UI exactly (index.html panel + default state).
export const sharedParams: ParamDef[] = [
  // ----- palette / mood -----
  {
    key: "mood",
    label: "MOOD",
    type: "select",
    group: "palette",
    default: "random",
    options: [
      { value: "dark", label: "DARK" },
      { value: "cream", label: "CREAM" },
      { value: "grey", label: "GREY" },
      { value: "random", label: "RANDOM" },
    ],
  },

  // ----- finish -----
  { key: "contrast", label: "CONTRAST", type: "range", group: "finish", min: 0, max: 100, default: 50 },
  { key: "saturation", label: "SATURATION", type: "range", group: "finish", min: 0, max: 100, default: 50 },
  { key: "vignette", label: "VIGNETTE", type: "range", group: "finish", min: 0, max: 100, default: 28 },
  { key: "bloom", label: "BLOOM", type: "range", group: "finish", min: 0, max: 100, default: 22 },
  { key: "soften", label: "SOFTEN · BLUR", type: "range", group: "finish", min: 0, max: 100, default: 0 },

  // ----- texture -----
  { key: "grain", label: "FILM GRAIN", type: "range", group: "texture", min: 0, max: 100, default: 60 },
  { key: "grainSize", label: "GRAIN SIZE", type: "range", group: "texture", min: 0, max: 100, default: 50 },
  { key: "scratches", label: "SCRATCH LINES", type: "toggle", group: "texture", default: true },
  { key: "scratchCount", label: "COUNT", type: "int", group: "texture", min: 0, max: 16, default: 6 },

  // ----- type overlay -----
  { key: "showText", label: "RENDER TEXT", type: "toggle", group: "type", default: true },
  { key: "title", label: "TITLE", type: "text", group: "type", default: "UNTITLED" },
  { key: "artist", label: "ARTIST", type: "text", group: "type", default: "V/A" },
  {
    key: "textCase",
    label: "CASE",
    type: "select",
    group: "type",
    default: "upper",
    options: [
      { value: "upper", label: "UPPER" },
      { value: "lower", label: "lower" },
      { value: "asis", label: "As-Is" },
      { value: "manic", label: "ManIC" },
    ],
  },
  { key: "distort", label: "DISTORT / GLITCH", type: "range", group: "type", min: 0, max: 100, default: 0 },
  {
    key: "textColor",
    label: "COLOR",
    type: "select",
    group: "type",
    default: "auto",
    options: [
      { value: "auto", label: "AUTO" },
      { value: "light", label: "LIGHT" },
      { value: "dark", label: "DARK" },
    ],
  },
];
