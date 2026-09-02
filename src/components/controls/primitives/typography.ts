// ── Type roles (the ONLY place a UI text size is declared) ───────────────────
// Every component imports a role instead of typing `text-[Npx]`. Sizes, line
// heights and tracking live here so the studio reads as one instrument: 400 by
// default, 500 only for headings + primary CTAs, tracking 0 at ≤13px (DISPLAY
// and TITLE are the two tracked roles), no caps, no letter-spaced labels.
// Colours are applied at the call site (see the colour tiers in the design
// spec): grey-100 primary / 150 strong / 200 heading + data / 250 label /
// 300 hint — the floor for any text. grey-350 and below are non-text only.

/** Landing wordmark only. Weight per span (300 "aka" / 600 "COVART"). */
export const DISPLAY =
  "font-sans text-[34px]/[36px] tracking-[-0.03em] sm:text-[46px]/[48px]";
/** Header wordmark size, StartPicker title, Formats / Preview overlay titles. */
export const TITLE = "font-sans text-[15px]/[20px] font-medium tracking-[-0.01em]";
/** Accordion triggers, Style-menu item names, landing Start label. */
export const SECTION = "font-sans text-[13px]/[20px] font-medium";
/** GroupLabel — the only in-panel heading — and Preview section heads. */
export const GROUP = "font-sans text-[12px]/[16px] font-medium";
/** Labels, buttons, pills, tabs, segments, inputs, short prose. */
export const CONTROL = "font-sans text-[12px]/[16px] font-normal";
/** Hints, status lines, caption words, footer, tile hints. */
export const MICRO = "font-sans text-[11px]/[16px] font-normal";
/** NUMERALS ONLY (Geist Mono): seed, slider values, dims, ratios, BPM, %, times, hex.
 *  Words are always sans — wrap only the figure in a DATA span. */
export const DATA = "font-mono text-[12px]/[16px] font-normal";
/** DATA inside dense chrome: tile ratios, waveform readout, landing counter,
 *  export-button dims, the caption on phones. Colour inherits from context. */
export const DATA_SM = "font-mono text-[11px]/[16px] font-normal";
/** Fixed slider-value slot. The largest slider max is 160 (BPM) and every step
 *  is an integer, so values are ≤3 characters — 5ch (padding-inclusive) never clips or reflows as a value
 *  ticks. Widen here, and only here, if a param ever needs 4+ characters. */
export const SLOT = "inline-block w-[5ch] text-right";
/** Focus outline 2px outside the element — every interactive element with room
 *  for the offset (buttons, pills, tiles, chips). Defined in globals.css. */
export const FOCUS = "focus-ring";
/** Focus outline drawn on the border edge (−1px) — text / number inputs and
 *  full-bleed rows (accordion trigger). Defined in globals.css. */
export const FOCUS_FIELD = "focus-field";
/** Landing hero paragraph — the one run of prose in the app (13px, 14px ≥ sm). */
export const COPY = "font-sans text-[13px]/[20px] font-normal sm:text-[14px]/[22px]";

// ── The tray (segmented / toggle recipe, shared) ─────────────────────────────
// One edge, grey-880 fill, 4px inset. Items are sized by their LABEL (10px
// interior padding, never narrower than the text) and the row WRAPS when the
// labels don't fit — a label must never spill past its own fill. Fill carries
// the active state; weight never changes, so nothing jitters on select.
export const TRAY = "flex flex-wrap items-center gap-1 rounded-control border border-edge bg-grey-880 p-1";
export const TRAY_ITEM =
  "inline-flex h-8 max-sm:h-10 min-w-fit flex-auto items-center justify-center whitespace-nowrap rounded-[2px] px-2.5 transition-colors";
export const TRAY_IDLE = "text-grey-250 hover:bg-wash-active hover:text-grey-100 active:bg-wash-active";
export const TRAY_ACTIVE = "bg-grey-100 text-bg";
/** TRAY_ACTIVE for base-ui Toggle items, keyed on data-pressed. */
export const TRAY_PRESSED = "data-pressed:bg-grey-100 data-pressed:text-bg data-pressed:hover:bg-grey-100";
