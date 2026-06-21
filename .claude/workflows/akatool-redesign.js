export const meta = {
  name: 'akatool-redesign',
  description: 'Redesign the studio UI: shadcn components, responsive Canva-style layout, big engine selector, transparent header, DRY controls',
  phases: [
    { title: 'Setup', detail: 'integrate shadcn/ui into the Tailwind v4 app, map theme to akaCOVART dark palette' },
    { title: 'Redesign', detail: 'parallel: responsive app shell + engine selector, and DRY shadcn control panel' },
    { title: 'Integrate', detail: 'harmonize, remove orphans, responsive + build verify' },
  ],
}

const ROOT = '/Users/ieuanking/Desktop/nuu/aka-covart'

const THEME = [
  'akaCOVART THEME (always dark, minimal, monochrome, gallery-grade negative space):',
  '- Canvas/background near-black #0a0a0b. Surfaces/cards #0c0c0e and #121215. Borders very dark #1f1f23 / #161619 (hairline).',
  '- Foreground/ink #e8e8ea. Muted text #8a8a8e and #6a6a6e. Primary action near-white #ececef with #0a0a0b text.',
  '- Fonts: IBM Plex Mono for ALL UI micro-labels, values, buttons, tabs (uppercase, letter-spacing ~0.12-0.22em, tiny 8-10px). IBM Plex Sans for any body copy. (Both already loaded via next/font in layout.tsx.)',
  '- Small radius (~4-6px). No heavy shadows except a soft drop shadow under the canvas. Restrained, modern, lots of breathing room. Think a clean, simple Canva-like album-art studio — the canvas is the hero, controls are quiet and out of the way.',
].join('\n')

const RULES = [
  'CRITICAL: preserve ALL existing functionality. Every engine (blob/grid/waves/orb), seed + GENERATE, presets, the 9-up variations gallery, palette/mood, engine-specific composition params, FINISH, TEXTURE, SIGIL, TYPE overlay (incl. drag-to-place text on the canvas), STILL/ANIMATE, the per-engine MOTION params (orb/wave/grid), BEAT + DRIFT groups, PNG (3000x3000) export, video export, and RESET must all still work. Nothing is lost in the redesign.',
  'Do NOT touch src/engine/** or src/presets/** (the generative core/data is final). State lives in the existing Zustand store (src/lib/store.ts) — read/write it directly; do not change its shape (you may read defaults/actions).',
  'Use the shadcn components added in Setup (import from "@/components/ui/*") and the cn() helper from "@/lib/utils". DRY: drive repetitive controls from a config/array + a generic renderer, not copy-pasted JSX.',
  'TypeScript strict. Keep everything client-safe (output:export; no window/document at module scope). Match the theme exactly.',
  THEME,
].join('\n')

// ---------------- SETUP ----------------
phase('Setup')
const setup = await agent([
  'Integrate shadcn/ui into the existing Next.js (App Router) + Tailwind v4 app at ' + ROOT + ' and theme it to akaCOVART. This app uses Tailwind v4 (globals.css has @import "tailwindcss" + an @theme block of akaCOVART tokens) and static export (output:export).',
  '',
  'Steps:',
  '1) Initialize shadcn non-interactively: run "npx shadcn@latest init" with non-interactive flags (e.g. --defaults --yes, or -d -y; pick the New York style, base color neutral, CSS variables yes). If a flag is unsupported, adapt so it does NOT hang on prompts. This creates components.json, src/lib/utils.ts (cn), installs deps (class-variance-authority, clsx, tailwind-merge, lucide-react, tw-animate-css or equivalent), and adds shadcn CSS variables.',
  '2) Add components: run "npx shadcn@latest add -y button slider switch tabs accordion sheet scroll-area separator toggle-group tooltip input label" (split into multiple calls if needed). They should land in src/components/ui/.',
  '3) RECONCILE globals.css (this is the delicate part): KEEP the existing akaCOVART @theme tokens (the current components still use grey-* / bg / panel / border / ink utilities) AND keep shadcn variables. Map shadcn CSS variables (--background, --card, --popover, --foreground, --muted, --muted-foreground, --border, --input, --primary, --primary-foreground, --secondary, --accent, --ring, --radius) to the akaCOVART dark palette (see theme below). Make the app DARK BY DEFAULT — either set the dark values on :root, or add className="dark" to <html> in src/app/layout.tsx and define the .dark variables. Ensure shadcn components render in the dark theme with IBM Plex fonts (set --font-sans/--font-mono or ensure body uses them).',
  '4) Smoke test: temporarily render a shadcn <Button> somewhere harmless (or a throwaway) to confirm imports resolve, then run "pnpm exec next build" and ensure it passes (static export). Remove the throwaway. Fix any Tailwind v4 / shadcn integration issues.',
  '',
  THEME,
  '',
  'Report: shadcn version, which components were added (paths), how you mapped the theme variables, the layout.tsx dark-mode change, and confirm next build passes. Do NOT redesign any screens yet — only set up shadcn + theme so the Redesign phase can build on it.',
].join('\n'), { label: 'shadcn-setup', phase: 'Setup', effort: 'high' })
log('shadcn setup done')

// ---------------- REDESIGN (2 parallel) ----------------
phase('Redesign')
const redesign = await parallel([
  // A — app shell + engine selector + responsive layout
  () => agent([
    'Rebuild the APP SHELL of the akaCOVART studio at ' + ROOT + ' to be modern, responsive, and Canva-style (canvas-centric). shadcn is already set up (import from "@/components/ui/*", cn from "@/lib/utils").',
    'You OWN: src/app/page.tsx, src/components/Studio.tsx, src/components/CanvasStage.tsx (responsive container only — keep ALL its render/animate/drag/export logic intact), and you may CREATE src/components/EngineSelector.tsx and src/components/TopBar.tsx. Render the control panel by importing <Controls/> from src/components/Controls.tsx (built in parallel by another agent — assume it exists and takes no required props; it reads the store and renders all parameter sections incl. still/animate). Do NOT create/edit Controls.tsx or the control primitives.',
    '',
    'Build:',
    '1) HEADER: transparent, NO border, no background — the akaCOVART wordmark (aka in light weight + COVART bold, mono, tracked) floating at top-left. Optional minimal right-side actions are fine but keep it clean. It should sit over the canvas backdrop.',
    '2) LAYOUT (responsive, Canva-like): the canvas is the hero — centered, large, with a soft drop shadow, scaling to the viewport (e.g. width min(82vh, 760px) on desktop, full-width with sensible max on small screens; never overflow; keep it square via aspect-square). ',
    '   - Desktop (lg and up): canvas centered in the main area + a controls SIDEBAR on the right (a fixed-ish width column, ~360-400px, its own scroll). ',
    '   - Mobile/tablet (below lg): canvas dominant and centered; controls live in a shadcn <Sheet> (slide-in drawer) opened by a clearly-visible floating "CONTROLS" / sliders button. The engine selector and the primary export action should remain reachable without opening the sheet (e.g. a compact bottom bar or floating controls).',
    '3) ENGINE SELECTOR (this is a priority — the current one is too small/bad): a prominent, large, easily-tappable selector for BLOB / GRID / WAVE / ORB. Use shadcn Tabs or ToggleGroup styled big (generous height ~40-48px, clear active state in the theme, readable mono labels, optional small lucide icons). Place it prominently (e.g. top of the controls column on desktop, and visible on mobile). Wire to store.engine.',
    '4) Seed + GENERATE: keep accessible (can live at the top of the controls). STILL/ANIMATE mode toggle + the primary EXPORT button (DOWNLOAD PNG 3000 / EXPORT VIDEO LOOP, with the busy spinner) should be prominent and always reachable (e.g. a sticky footer/action bar in the sidebar and a visible action on mobile). Keep the existing export wiring (exportPng/exportVideo from src/lib/export via the store flags) — preserve the handleExport logic that currently lives in Studio.tsx.',
    '5) CanvasStage: keep the canvas element + its ref + all pointer/drag handlers + the render/animate effects EXACTLY; only adjust the wrapper/container styling for responsiveness (the canvas must resize cleanly and stay square). Keep the "3000 x 3000 PX . SEED n" caption (style it subtly).',
    '',
    RULES,
    'Run "pnpm exec tsc --noEmit" for your files (Controls may not exist yet during your edit — if its import errors, keep the import as "@/components/Controls" and proceed; the integrate phase resolves cross-file). Report the layout structure + responsive breakpoints used.',
  ].join('\n'), { label: 'shell', phase: 'Redesign', effort: 'high' }),

  // B — DRY shadcn control panel
  () => agent([
    'Rebuild the CONTROL PANEL of the akaCOVART studio at ' + ROOT + ' as a clean, DRY, shadcn-based component. shadcn is set up (import from "@/components/ui/*", cn from "@/lib/utils").',
    'You OWN: src/components/Controls.tsx (CREATE — the new panel, default export, no required props; reads/writes the Zustand store directly), src/components/controls-config.ts (CREATE — the data-driven param config), and src/components/primitives.tsx (REWRITE to thin shadcn-based control rows). You may also keep using src/components/Gallery.tsx (import it; only edit it if needed for styling). Do NOT edit Studio.tsx, CanvasStage.tsx, EngineSelector.tsx, page.tsx, src/engine, src/presets, or src/lib/store.ts shape.',
    '',
    'DRY APPROACH (important): define the parameter sections as DATA in controls-config.ts — e.g. arrays describing each control { key, label, kind: "slider"|"toggle"|"segmented"|"text", min, max, step, options }, grouped by section and (for composition/motion) by engine. Then Controls.tsx maps over the config to render rows generically. No copy-pasted slider JSX.',
    '',
    'Sections to render (read store.mode):',
    'STILL mode, as a shadcn <Accordion> (multiple open allowed) of sections:',
    '- STARTING POINTS: presets (the 8 from getPresets() as a tidy grid of buttons) + the 9-up <Gallery/> with a reroll ("MORE") action.',
    '- PALETTE / MOOD: a segmented control (shadcn ToggleGroup) dark/cream/grey/random -> store.mood.',
    '- COMPOSITION: engine-specific params for the CURRENT engine (blob: density,smear,blobSize,glow, DIAMOND ZONES toggle + diamondCount/Size/Shape, ACCENT intensity/count; grid: gridCols,gridDensity,gridPerspective,gridMagnet; waves: waveCount,waveAmp,waveDetail,waveTurbulence,wavePerspective; orb: orbSize,orbSoft,orbHalftone,orbMelt,orbShade) PLUS a shared FINISH group (contrast,saturation,vignette,bloom,soften). Pull exact keys/ranges/defaults from src/lib/store.ts and the engine params.',
    '- TEXTURE: grain, grainSize, dust, SCRATCH LINES toggle + scratchCount.',
    '- SIGIL: SIGIL MARKS toggle + sigilMarkCount/Size/Scatter; BARB FRAME toggle + sigilFrameDensity.',
    '- TYPE OVERLAY: RENDER TEXT toggle, title + artist inputs, CASE segmented, DISTORT slider, COLOR segmented, and the 3x3 POSITION grid (textX/textY/textAlign) with the "or drag on canvas" hint.',
    'ANIMATE mode: BEAT (animBPM, animPump, animKick), DRIFT (animSpeed, animDrift, animSwirl), and engine-specific MOTION (orb: orbSpin/Wobble/Bounce/Breath/Churn; waves: waveFlow/Swell/Surge/Churn/Undulate; grid: gridRipple/Bob/Pop/Orbit/Flow; blob: a small muted note).',
    '',
    'Controls (rewrite primitives.tsx to wrap shadcn):',
    '- Slider row: label (mono, tiny) + shadcn <Slider>, with the value shown and CLICK-TO-EDIT (an inline number input that clamps to min/max). Keep it compact and on-theme.',
    '- Toggle row: label + shadcn <Switch> (or a small ON/OFF). Segmented: shadcn <ToggleGroup type="single">. Text: shadcn <Input>. Keep mono micro-typography.',
    '- Include a RESET action (store.resetParams) somewhere sensible in the panel header.',
    '',
    RULES,
    'Run "pnpm exec tsc --noEmit" for your files and fix control-side errors. Report the config shape + components used.',
  ].join('\n'), { label: 'controls', phase: 'Redesign', effort: 'high' }),
])
log('redesign complete: ' + redesign.filter(Boolean).length + '/2')

// ---------------- INTEGRATE + VERIFY ----------------
phase('Integrate')
const integrate = await agent([
  'Integrate and verify the redesigned akaCOVART studio at ' + ROOT + '. You may edit any file in src/components, src/app, src/lib (NOT src/engine or src/presets).',
  '1) Wire the shell <-> controls: ensure Studio.tsx imports and renders <Controls/> correctly (desktop sidebar + mobile Sheet), and EngineSelector + mode toggle + export action are all wired to the store. Remove now-orphaned files (the old ControlPanel.tsx and SectionNav.tsx if no longer imported) so there is no dead code.',
  '2) Harmonize styling so the shell and controls look like one coherent, modern, dark IBM Plex design (consistent spacing, radius, type, borders, active states). Header MUST be transparent with no border. Engine selector must be large and prominent. Keep DRY.',
  '3) Responsiveness: verify the layout works from ~360px wide up to large desktop — canvas never overflows or gets too small, controls reachable (sidebar on lg+, Sheet drawer below lg), no horizontal scroll, touch targets >= ~36px. Fix any breakpoint issues.',
  '4) Run "pnpm exec tsc --noEmit" and "pnpm exec next build" (static export) and FIX ALL errors/warnings. Ensure no window/document at module scope and all interactive components are client components.',
  '5) Confirm nothing functional was lost: engines, seed/generate, presets, gallery, palette, composition (per engine), texture, sigil, type + drag-to-place, still/animate, motion params, PNG + video export, reset.',
  'Report: final component tree under src/components, files removed, responsive approach, and confirm tsc + next build pass.',
].join('\n'), { label: 'integrate', phase: 'Integrate', effort: 'high' })

return { setup, redesign: redesign.filter(Boolean).length, integrate }
