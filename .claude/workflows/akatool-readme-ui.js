export const meta = {
  name: 'akatool-readme-ui',
  description: 'Comprehensive README + control-panel navigation/param-control upgrade for akaCOVART',
  phases: [
    { title: 'Build', detail: 'parallel: comprehensive README + nav/param-controls UI upgrade' },
    { title: 'Verify', detail: 'typecheck + next build + fix' },
  ],
}

const ROOT = '/Users/ieuanking/Desktop/nuu/aka-covart'

phase('Build')

const readmeAgent = () => agent([
  'Write a COMPREHENSIVE README at ' + ROOT + '/README.md (replace the existing short one). Edit ONLY README.md.',
  'This is the public repo github.com/akaieuan/akaCovart — a generative album-art studio ("akaCOVART" / akaTOOL) by Ubik Studio. It is a single Next.js (App Router, static export) + Tailwind app; the generative engine is a framework-agnostic module in src/engine.',
  'Ground every detail by reading the actual source first: README.md (current), package.json, src/engine/index.ts, src/engine/types.ts, src/engine/render.ts, src/engine/engines/{blob,grid,waves,orb}.ts (for each engine param list + defaults), src/lib/store.ts (defaults), src/components/ControlPanel.tsx (UI groups), src/presets/index.ts (preset names). Do NOT invent params; list the real ones.',
  '',
  'Make it polished and thorough. Use clean Markdown with proper code fences and tables. Include these sections:',
  '1. Title + one-line tagline + short intro paragraph (what it is, who it is for).',
  '2. Highlights / features (bullet list): 4 engines, deterministic seeded output, palettes/moods, presets, variations gallery, sigil marks + barbed frame, film grain/dust/scratches, type overlay with glitch + drag-to-place, high-res PNG (3000x3000) export, beat-synced flicker-free animation, static-export SPA.',
  '3. Quick start: prerequisites (Node version from .nvmrc, pnpm), install, dev (localhost:3000), build (static export to out/), and the other scripts (typecheck, lint). Use real script names from package.json.',
  '4. Usage walkthrough: choosing an engine, seed + GENERATE + variations gallery + presets, palette/mood, composition params, texture/sigil/type, STILL vs ANIMATE, and exporting PNG / video loop.',
  '5. Architecture / how it works: the src/engine module boundary (pure canvas, no React), the typed FieldEngine plugin interface + registry, the seeded PRNG determinism guarantee (same seed+params => same image), resolveMood + palettes, the renderTo orchestrator and the finish chain order, and the src/components + src/lib (Zustand) UI layer. Include the real project tree.',
  '6. Engines & parameters: a subsection per engine (Blob, Grid, Waves, Orb) listing its composition params and (for orb/waves/grid) its MOTION params, each with what it does — pull the exact keys/labels/defaults from source. Also a shared FINISH/TEXTURE/SIGIL/TYPE params subsection.',
  '7. Animation system: explain the no-flicker philosophy (beat energy drives space/scale/displacement only, never brightness/opacity/hue), the eased AnimState primitives (continuous beat phase, kickEnv attack-decay, kickSpring damped bounce, pumpEnv breathing), and the BEAT/DRIFT/MOTION control groups.',
  '8. Extending: how to add a preset (data in src/presets) and how to add an engine (implement FieldEngine in src/engine/engines and call registerEngine; it self-registers and appears in the UI). State the two contribution rules: deterministic (derive randomness from prng(seed^const), never Math.random in the render path) and flicker-free (no beat-driven brightness/opacity/hue).',
  '9. Tech stack (Next.js, React 19, Tailwind v4, Zustand, TypeScript) — verify versions from package.json.',
  '10. Roadmap: WebGL/Three.js (react-three-fiber) physical engines (TouchDesigner-core), live deploy + shareable permalinks, and Claude-native extensibility (skills / MCP / params-as-data) so others can build on top via Claude. Mark these as planned.',
  '11. Contributing (brief) + License: Apache-2.0, and that "akaCOVART" is a trademark of the project owner not licensed under Apache-2.0 (link LICENSE + NOTICE).',
  'Keep the voice clean and confident, not marketing-fluff. No screenshots needed (do not embed image files). Report the final section outline.',
].join('\n'), { label: 'readme', phase: 'Build', effort: 'high' })

const uiAgent = () => agent([
  'Upgrade the control-panel NAVIGATION and PARAM CONTROLS in the Next.js app at ' + ROOT + '. Edit ONLY: src/components/primitives.tsx, src/components/ControlPanel.tsx, src/lib/store.ts, and you may ADD src/components/SectionNav.tsx. Do not touch src/engine, src/presets, CanvasStage, Studio, layout, or globals beyond what is listed (you may add a couple of utility classes to src/app/globals.css if strictly needed for sticky headers).',
  'Read those files first. Keep the existing dark/minimal aesthetic (IBM Plex Mono micro-labels, grey tokens) — every addition must match the current visual language. Keep determinism + no-flicker untouched (this is UI only).',
  '',
  'Implement these improvements:',
  '',
  'A) SECTION NAVIGATION (still mode):',
  '- Add a compact navigator row directly under the seed/GENERATE row (only shown in still mode). One small chip-button per section: POINTS (library), PALETTE, COMP (composition), TEXTURE, SIGIL, TYPE. Clicking a chip OPENS that section (set open[key]=true) AND smooth-scrolls it into view within the scrolling panel. Active/open sections get an active chip style. Horizontal, wraps or scrolls if needed, matches the segmented-button look but smaller.',
  '- Add an EXPAND ALL / COLLAPSE ALL control (a small button or icon) near the navigator that toggles all sections open/closed at once.',
  '- Give each Section a stable DOM id (add an optional id prop to the Section primitive) and scroll to it via document.getElementById(id).scrollIntoView({behavior:"smooth", block:"start"}) inside a requestAnimationFrame after opening. Add scroll-margin-top to sections so the sticky header (below) does not cover the target.',
  '- Make the Section header STICKY to the top of the scroll container while scrolling (position: sticky; top: 0; a panel-colored background; small z-index) so the current section label stays visible. Keep it subtle and clean; ensure it does not break the collapse chevron.',
  '',
  'B) BETTER PARAM CONTROLS (the Slider primitive):',
  '- Show a FILLED progress track: the portion of the slider from min up to the current value is filled in a lighter grey, the remainder darker. Implement by computing a percentage and applying a linear-gradient background to the range input (keep the existing thumb). Keep cross-browser (webkit + moz) reasonable.',
  '- Make the numeric value EDITABLE: clicking the value turns it into a small inline number input; typing + Enter/blur commits, clamped to [min,max] and snapped to step. Keep the compact mono styling identical when not editing.',
  '- Keep label, sub, last behavior intact. Do not require changes at every call site.',
  '',
  'C) RESET TO DEFAULTS:',
  '- In src/lib/store.ts add a resetParams() action that resets all generation/animation params to their defaults (reuse the existing defaults object) while KEEPING the current seed, mode, open sections, gallerySeeds, and rendering/recording flags. Add it to the StudioState interface + the store implementation.',
  '- In ControlPanel, add a small RESET button (matching the panel style) — place it sensibly (e.g. a compact button in the navigator row or beside GENERATE) that calls resetParams. Label it RESET (mono, tiny).',
  '',
  'After editing run: cd ' + ROOT + ' && pnpm exec tsc --noEmit and fix any type errors in the files you touched. Report exactly what you changed.',
  'HARD: UI only. Match existing styling. TypeScript strict.',
].join('\n'), { label: 'ui', phase: 'Build', effort: 'high' })

const built = await parallel([readmeAgent, uiAgent])
log('build done: ' + built.filter(Boolean).length + '/2')

phase('Verify')
const verify = await agent([
  'Verify the README + UI upgrade in the Next.js app at ' + ROOT + '. You may edit any file to fix issues.',
  '1) cd ' + ROOT + ' && pnpm exec tsc --noEmit — fix all type errors (store resetParams typing, Section id prop, Slider editable value).',
  '2) pnpm exec next build — fix any build/lint/SSR errors (output:export; no window on server; client components where needed).',
  '3) Sanity: confirm the still-mode panel has a working section navigator (chips open+scroll), expand/collapse all, sticky section headers, sliders with a filled track + click-to-edit value, and a RESET button wired to resetParams. Confirm README.md exists and is comprehensive.',
  'Report: errors fixed, and whether tsc + next build both pass.',
].join('\n'), { label: 'verify', phase: 'Verify', effort: 'high' })

return { built: built.filter(Boolean).length, verify }
