export const meta = {
  name: 'akatool-destyle',
  description: 'Switch font to Geist + drop ALL-CAPS/letter-spacing -> minimal normal-case UI across all panels',
  phases: [
    { title: 'Restyle', detail: 'parallel: font+chrome // control/audio content — to one shared minimal style spec' },
    { title: 'Verify', detail: 'typecheck + next build + fix' },
  ],
}

const ROOT = '/Users/ieuanking/Desktop/nuu/aka-covart'

const STYLE = [
  'SHARED STYLE SPEC — apply identically so the whole UI is consistent. Goal: minimal, plain, "not styled". This is UI CHROME ONLY.',
  'FONT: Geist (a clean neutral sans). Use font-sans everywhere. Remove font-mono usage from UI labels/values (Geist sans for everything; the --font-mono token already maps to the app font).',
  'CASE: NORMAL / sentence case for ALL UI text. Convert literal uppercase strings to sentence case and REMOVE every .toUpperCase() and every "uppercase" utility class. Examples:',
  '  "GENERATE"->"Generate", "RESET"->"Reset", "DOWNLOAD PNG · 3000²"->"Download PNG · 3000\\u00b2", "EXPORT VIDEO LOOP"->"Export video loop", "RENDERING…"->"Rendering…", "RECORDING…"->"Recording…",',
  '  "STILL/ANIMATE/AUDIO"->"Still/Animate/Audio", engines "BLOB/GRID/WAVE/ORB"->"Blob/Grid/Wave/Orb", moods "DARK/CREAM/GREY/RANDOM"->"Dark/Cream/Grey/Random",',
  '  section titles "STARTING POINTS"->"Starting points", "PALETTE · MOOD"->"Palette · mood", "COMPOSITION"->"Composition", "TEXTURE"->"Texture", "SIGIL"->"Sigil", "TYPE OVERLAY"->"Type overlay",',
  '  group/control labels "BLOB DENSITY"->"Blob density", "SMEAR / BLUR"->"Smear / blur", "FILM GRAIN"->"Film grain", "DIAMOND ZONES"->"Diamond zones", "SIGIL MARKS"->"Sigil marks", "BARB FRAME"->"Barb frame", "RENDER TEXT"->"Render text", "PRESETS"->"Presets", "VARIATIONS"->"Variations", "BEAT/DRIFT/MOTION"->"Beat/Drift/Motion", "POSITION"->"Position", etc. Preset NAMES (VOID, RITUAL, ASH, BLEACH, TOXIC, STATIC, OBSIDIAN, HAZE) MAY stay uppercase (they are brand-ish tokens) — your call, but if unsure make them sentence case too for consistency.',
  'LETTER-SPACING: remove all wide tracking-[...] / tracking-wide on labels (use default tracking). No letter-spacing.',
  'SIZES/WEIGHT: drop the tiny 8-9px micro-type; use ~11-12px for labels/values and ~12-13px for section titles. Weight: font-medium for section titles/emphasis, font-normal elsewhere. Keep it quiet and readable.',
  'KEEP: the dark theme colors, radii, spacing, layout, and all functionality. Only typography/case/tracking change.',
  'DO NOT TOUCH: src/engine/** (the canvas text overlay / textCase is ARTWORK, not UI) — only change the studio UI components. Do not change behavior/props/logic.',
].join('\n')

phase('Restyle')
const restyle = await parallel([
  // A — font + chrome
  () => agent([
    'Apply the minimal restyle to the FONT + app chrome of akaCOVART at ' + ROOT + '. Edit ONLY: src/app/layout.tsx, src/app/globals.css, src/components/Studio.tsx, src/components/EngineSelector.tsx, src/components/TopBar.tsx.',
    'FONT first: set the app font to GEIST. In layout.tsx import Geist from "next/font/google" (const geist = Geist({ variable: "--font-app", subsets: ["latin"] }); body className includes geist.variable + font-sans). If "Geist" is not available in next/font/google in this version, add the "geist" npm package and use GeistSans (geist/font/sans) instead. In globals.css point --font-sans, --font-mono, and --font-heading at var(--font-app), system-ui, sans-serif (currently they are a raw system stack — replace with the Geist var).',
    'Then de-style the chrome per the spec: Studio.tsx (SeedRow GENERATE, ModeToggle Still/Animate/Audio, ResetButton Reset, ExportButton labels, the mobile sheet "ENGINE"/CONTROLS labels), EngineSelector.tsx (Blob/Grid/Wave/Orb, drop tracking/uppercase, keep the white-selected pill fix intact), TopBar.tsx (the akaCOVART wordmark — keep it as the brand, but you may drop heavy tracking; the wordmark itself can stay as-is if it reads as the logo).',
    '',
    STYLE,
    '',
    'Run cd ' + ROOT + ' && pnpm exec tsc --noEmit and fix errors in your files. Report changes + the font method used.',
  ].join('\n'), { label: 'font+chrome', phase: 'Restyle', effort: 'high' }),

  // B — control + audio content
  () => agent([
    'Apply the minimal restyle to the CONTROL PANEL + audio UI of akaCOVART at ' + ROOT + '. Edit ONLY: src/components/Controls.tsx, src/components/controls-config.ts, src/components/primitives.tsx, src/components/AudioPanel.tsx, src/components/Waveform.tsx, src/components/Gallery.tsx. Do NOT edit layout/globals/Studio/EngineSelector/TopBar (another agent owns those) or src/engine.',
    'Convert every label/section title/group label/value to normal case, remove uppercase classes + .toUpperCase(), remove wide letter-spacing, and bump the tiny micro-type to ~11-12px per the spec. Drive it from controls-config.ts where the labels live (so it stays DRY) plus the primitives that render them. Keep all controls working (sliders, toggles, segmented, accordion, click-to-edit values, presets grid, gallery, audio panel upload/waveform/transport/intensity).',
    '',
    STYLE,
    '',
    'Run cd ' + ROOT + ' && pnpm exec tsc --noEmit and fix errors in your files. Report changes.',
  ].join('\n'), { label: 'controls+audio', phase: 'Restyle', effort: 'high' }),
])
log('restyle: ' + restyle.filter(Boolean).length + '/2')

phase('Verify')
const verify = await agent([
  'Verify the restyle + the audio feature in akaCOVART at ' + ROOT + '. You may edit any file in src/ to fix issues.',
  '1) Consistency check: across ALL studio UI components the font is Geist, text is normal/sentence case (no stray ALL-CAPS or .toUpperCase or wide tracking left in the chrome/controls/audio panels — preset NAMES may remain uppercase if intentional), and label sizes are the ~11-12px range (no leftover 8-9px micro-type). Fix any inconsistencies between the two agents.',
  '2) Run cd ' + ROOT + ' && pnpm exec tsc --noEmit and pnpm exec next build (static export) — FIX ALL errors/warnings until both pass.',
  '3) Confirm nothing functional broke: STILL/ANIMATE/AUDIO modes, engine selector (selected = white pill), all params, presets, gallery, audio upload/waveform/clip/transport/intensity, export. The engine canvas text overlay (artwork) is unchanged.',
  'Report: files changed, any inconsistencies fixed, and whether tsc + next build pass.',
].join('\n'), { label: 'verify', phase: 'Verify', effort: 'high' })

return { restyle: restyle.filter(Boolean).length, verify }
