export const meta = {
  name: 'akatool-architecture',
  description: 'Reorg components into folders + barrels (DRY) and add fine-grained store selectors + memo for fluid sliders',
  phases: [
    { title: 'Restructure', detail: 'move components into folders, add barrels, rewire imports — build stays green' },
    { title: 'Fluidity', detail: 'per-component store selectors + memo so a slider drag re-renders only that row' },
    { title: 'Verify', detail: 'build + confirm features + isolated re-renders' },
  ],
}

const ROOT = '/Users/ieuanking/Desktop/nuu/aka-covart'

const GUARD = [
  'DO NOT TOUCH (leave exactly as-is): src/engine/**, src/audio/**, src/lib/**, src/app/** (page.tsx stays a server component rendering the client Studio), and src/components/ui/** (shadcn). Only reorganize/refactor the OTHER files under src/components/**.',
  'Keep tsconfig path alias @/* -> ./src/*. Everything stays under src/, so @/ imports just change depth or use the new barrels.',
  'Use git mv to move files (preserve history). Preserve ALL behavior and styling. TypeScript strict. Keep "use client" on interactive components.',
].join('\n')

// ---------------- PHASE 1: RESTRUCTURE ----------------
phase('Restructure')
const restructure = await agent([
  'Reorganize the akaCOVART studio components at ' + ROOT + ' into a clean, professional folder structure with barrel exports. This is a MECHANICAL move + import rewire — do NOT change behavior/logic/styling.',
  'First read the current files in src/components/ to map imports.',
  '',
  'Target structure (create folders + move files with git mv):',
  'src/components/',
  '  studio/   -> Studio.tsx, TopBar.tsx, EngineSelector.tsx, and EXTRACT the inline helpers currently inside Studio.tsx (SeedRow, ModeToggle, ResetButton, ExportButton) into their own files SeedRow.tsx / ModeToggle.tsx / ResetButton.tsx / ExportButton.tsx in studio/. Add studio/index.ts barrel re-exporting Studio (default-as-named is fine) + the named helpers used elsewhere.',
  '  canvas/   -> CanvasStage.tsx + canvas/index.ts',
  '  controls/ -> Controls.tsx, controls-config.ts, Gallery.tsx, and primitives. Split src/components/primitives.tsx into controls/primitives/ as individual files (one per primitive: SliderRow/Slider, ToggleRow/Toggle, Segmented, TextRow/TextInput, Section, GroupLabel, Divider, Label — match the actual exports) with a controls/primitives/index.ts barrel. Add controls/index.ts barrel.',
  '  audio/    -> AudioPanel.tsx, Waveform.tsx + audio/index.ts',
  '  ui/       -> unchanged (shadcn).',
  '',
  'Then rewire EVERY import across the app to the new locations (prefer the folder barrels for cross-folder imports, e.g. import { Controls } from "@/components/controls", import { CanvasStage } from "@/components/canvas", import { EngineSelector, TopBar } from "@/components/studio"). Update src/app/page.tsx (or wherever Studio is imported) too. Keep intra-folder imports relative or via the barrel consistently.',
  'Extraction detail: when extracting SeedRow/ModeToggle/ResetButton/ExportButton from Studio.tsx, keep them as "use client" components with the SAME implementation (they read the store via selectors already); just move each to its own file and import back into Studio.tsx. ExportButton takes the onExport prop as today.',
  '',
  GUARD,
  '',
  'After: run cd ' + ROOT + ' && pnpm exec tsc --noEmit and pnpm exec next build — FIX every import/path error until BOTH pass (static export). Report the final tree of src/components and the barrels created.',
].join('\n'), { label: 'restructure', phase: 'Restructure', effort: 'high' })
log('restructure done')

// ---------------- PHASE 2: FLUIDITY ----------------
phase('Fluidity')
const fluidity = await agent([
  'Make the akaCOVART control panel render fluidly by ISOLATING re-renders so dragging one slider only re-renders THAT control (not the whole panel). Work in the new structure at ' + ROOT + '/src/components/controls/** (primitives + Controls + controls-config) and any control rows. Read those files first.',
  '',
  'Problem: today Controls.tsx subscribes to the WHOLE store (const s = useStudio()) and passes value/onChange down, so every slider tick re-renders the entire panel (all ~30 rows) — wasteful React reconciliation on top of each canvas frame.',
  '',
  'Refactor to fine-grained subscriptions + memo:',
  '- Make each control ROW SELF-SUBSCRIBE to only its own store slice. Change the primitives so a row takes a param KEY (and static meta like label/min/max/step/sub), reads its value with a narrow selector: const value = useStudio(s => s[paramKey]); and writes via a stable action: const setState = useStudio(s => s.setState); setState({ [paramKey]: v }). Wrap each row in React.memo so it only re-renders when ITS value (or static props) change. Do the same for Toggle (boolean key), Segmented (string key), and the text inputs.',
  '- Update controls-config.ts + Controls.tsx so Controls maps the config to <SliderRow paramKey=... label=... .../> etc. Controls itself must subscribe to ONLY what it needs to decide WHICH controls to show — i.e. useStudio(s => s.mode) and useStudio(s => s.engine) (narrow selectors), NOT the whole store. So changing a slider value does not re-render Controls or its siblings.',
  '- Keep the click-to-edit value, filled track, accordion sections, presets grid, and the AUDIO panel working. For the audio panel + waveform, keep them subscribing narrowly (audio fields) — do not regress them.',
  '- Gallery: narrow its subscription so it only re-renders when the gallery signature actually changes (e.g. subscribe to a derived sig/seeds), keeping the existing 200ms debounce of the thumbnail renderTo. Do not undo the debounce.',
  '- Stable callbacks/refs: ensure the memo actually holds (no new inline object/array props each render that defeat React.memo; use the paramKey pattern + stable store actions).',
  '',
  GUARD.replace('Only reorganize/refactor the OTHER files under src/components/**.', 'Only edit src/components/controls/** and, if strictly needed for narrow selectors, src/components/audio/**.'),
  '',
  'After: run cd ' + ROOT + ' && pnpm exec tsc --noEmit and pnpm exec next build — fix all errors. Report which components now self-subscribe and confirm Controls no longer subscribes to the whole store.',
].join('\n'), { label: 'fluidity', phase: 'Fluidity', effort: 'high' })
log('fluidity done')

// ---------------- PHASE 3: VERIFY ----------------
phase('Verify')
const verify = await agent([
  'Verify the architecture reorg + fluidity refactor in akaCOVART at ' + ROOT + '. You may edit any file under src/components to fix issues (not engine/audio/lib/app cores).',
  '1) cd ' + ROOT + ' && pnpm exec tsc --noEmit and pnpm exec next build (static export) — FIX ALL errors/warnings until both pass.',
  '2) Structure sanity: components live under studio/ canvas/ controls/ audio/ ui/ with index.ts barrels; imports use the barrels; no broken/circular imports; src/engine, src/audio, src/lib, src/app, and presets are untouched.',
  '3) Fluidity sanity: Controls subscribes only to mode/engine (not the whole store); control rows self-subscribe by key and are React.memo-wrapped; the gallery debounce and the canvas draft/rAF render from the previous commit are intact.',
  '4) Functional sanity: STILL/ANIMATE/AUDIO modes, engine selector (white-pill selected), all params + click-to-edit, presets, variations gallery, audio upload/waveform/clip/transport, PNG + video export, RESET — all still wired and working.',
  'Report: final src/components tree, confirmation Controls is no longer whole-store-subscribed, and that tsc + next build pass.',
].join('\n'), { label: 'verify', phase: 'Verify', effort: 'high' })

return { restructure, fluidity, verify }
