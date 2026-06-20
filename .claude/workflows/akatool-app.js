export const meta = {
  name: 'akatool-app',
  description: 'Build akaCOVART as a single, well-structured Next.js app: internal engine module + studio UI (2D engines, no flicker)',
  phases: [
    { title: 'Scaffold', detail: 'collapse monorepo -> single Next.js app at root, freeze engine contract, install' },
    { title: 'Port', detail: '2 parallel agents: engine module (src/engine) + studio UI (src/app, components, lib)' },
    { title: 'Integrate', detail: 'wire, next build, fix, archive prototype to reference/' },
  ],
}

const ROOT = '/Users/ieuanking/Desktop/nuu/aka-covart'
const SRC = ROOT + '/index.html' // frozen working prototype: full 2D engine + studio UI to port from

const CONTRACT = [
  'Public API of the INTERNAL engine module at src/engine (imported via "@/engine"). Framework-agnostic, no React deps. Extract-ready but NOT a package now.',
  '',
  '// src/engine/types.ts',
  'export type Mood = "dark" | "cream" | "grey"',
  'export type RNG = () => number',
  'export interface ParamDef { key:string; label:string; type:"range"|"int"|"toggle"|"select"|"text"; group?:"composition"|"finish"|"texture"|"sigil"|"type"|"palette"; min?:number; max?:number; step?:number; default:number|boolean|string; options?:{value:string;label:string}[] }',
  'export interface Palette { base:number[]; colors:number[][]; diamondColors:number[][]; fleck:number[]; smoke:number[]; accentColors:number[][]; scratch:string; markerColors:number[][]; markerBg:number[]; markerDot:number[]; blobCount:number; rMin:number; rMax:number; aMin:number; aMax:number; diamondAlpha:number; topSmudge:boolean; clearCenter:boolean }',
  '// Eased animation values ONLY. Deliberately NO strobe, NO flicker, NO per-frame hue cycle, NO brightness flash.',
  'export interface AnimState { anim:boolean; t:number; rt:number; bake:boolean; kickEnv:number; pumpEnv:number; drift:number; swirl:number }',
  'export interface FieldArgs { ctx:CanvasRenderingContext2D; size:number; params:Record<string,any>; mood:Mood; cfg:Palette; seed:number; anim:AnimState }',
  'export interface FieldEngine { id:string; label:string; kind:"2d"; params:ParamDef[]; field(args:FieldArgs):void }',
  'export interface TextBox { x:number; y:number; w:number; h:number }',
  'export interface RenderResult { textBox?:TextBox }',
  '',
  '// src/engine/registry.ts',
  'export function registerEngine(e:FieldEngine):void; export function getEngine(id:string):FieldEngine|undefined; export function listEngines():FieldEngine[]',
  '',
  '// src/engine/prng.ts        export function prng(seed:number):RNG   (port verbatim)',
  '// src/engine/palettes.ts    export const palettes:Record<Mood,Palette>; export function resolveMood(seed:number, mood:Mood|"random"):Mood',
  '// src/engine/color.ts       export function rgb(c:number[]):string; rgba(c:number[],a:number):string; huerot(c:number[],deg:number):number[]',
  '// src/engine/sharedParams.ts export const sharedParams:ParamDef[]  (mood + finish + texture + sigil + type; NOT engine-specific, NOT seed)',
  '// src/engine/effects/index.ts re-exports:',
  '//   bloom(ctx,size,amount); vignette(ctx,size,amount); postColor(ctx,size,contrast,sat); soften(ctx,size,amount,cfg)',
  '//   scratches(ctx,size,count,rng,cfg); grain(ctx,size,amount,gsize,dust,rng)   // grain STATIC (no per-frame reseed)',
  '//   drawSigil(ctx,size,params,mood,rng); drawText(ctx,size,params,mood,rng):TextBox',
  '// src/engine/render.ts      export function renderTo(canvas, size:number, params:Record<string,any>):RenderResult',
  '//   resolves mood/palette, fills base, dispatches getEngine(params.engine).field(...), then finish order:',
  '//   soften, scratches, drawSigil, postColor, bloom, vignette, grain, drawText. OMITS flicker/strobe/pump-darken/hue-cycle.',
  '// src/engine/index.ts       re-exports all above and imports "./engines" (self-registers blob/grid/waves/orb)',
  '// src/presets/index.ts      export interface Preset { name:string; engine?:string; params:Record<string,any>; seed?:number }; export const presets:Preset[]; export function getPresets():Preset[]',
].join('\n')

const NOFLICKER = 'NO FLICKER: never use brightness strobe, per-frame hue cycling, a white flicker overlay, multiply-darken on the beat, or grain reseeded per frame. Beat energy (anim.kickEnv/pumpEnv) drives only scale/position/displacement/optical-depth, never brightness/opacity/hue. Calm by default.'
const DETERMINISM = 'DETERMINISM: same (seed, params) reproduces the same image. Derive RNG from seed via prng(seed ^ constant). No Math.random() in the render path.'

const rules = (scope) => [
  'HARD RULES (keep the build atomic + clean):',
  '- ' + scope,
  '- Do NOT run pnpm install / pnpm add or edit package.json / configs. Deps are installed in the Scaffold phase.',
  '- Code EXACTLY against this contract (do not change signatures other code depends on):',
  CONTRACT,
  '- ' + NOFLICKER,
  '- ' + DETERMINISM,
  '- Port the LOOK faithfully from the prototype at ' + SRC + ' (read the relevant section), restructured to the contract. TypeScript strict, clean, matching surrounding style. Report files created + assumptions.',
].join('\n')

// ---------------- SCAFFOLD ----------------
phase('Scaffold')
const scaffold = await agent([
  'Collapse the half-built monorepo at ' + ROOT + ' into ONE clean, conventional Next.js app at the repo root (the owner asked for a "basic, well-structured Next.js web app"). Keep the existing Apache-2.0 LICENSE and NOTICE.',
  '',
  'Remove monorepo machinery: delete ' + ROOT + '/apps, ' + ROOT + '/packages, ' + ROOT + '/turbo.json, ' + ROOT + '/pnpm-workspace.yaml, and for a clean dep slate ' + ROOT + '/pnpm-lock.yaml and ' + ROOT + '/node_modules. Keep .gitignore, .prettierrc/.prettierignore, .npmrc, .nvmrc, LICENSE, NOTICE, .claude/, uploads/, and the prototype files (index.html, support.js, server.js, the .dc.html) in place for now (integration archives them later).',
  '',
  'Create a single Next.js (latest stable) App Router app at ROOT (TypeScript, Tailwind v4, ESLint):',
  '- package.json (private, name "akacovart"): deps next, react ^19, react-dom ^19, zustand; devDeps typescript, @types/node, @types/react, @types/react-dom, tailwindcss ^4, @tailwindcss/postcss, postcss, eslint, eslint-config-next. Scripts: dev, build, start, lint, typecheck (tsc --noEmit).',
  '- next.config.ts: output "export", images { unoptimized:true }, reactStrictMode true (static-export SPA, deploys anywhere).',
  '- tsconfig.json: strict, moduleResolution bundler, paths { "@/*": ["./src/*"] }, next plugin.',
  '- postcss.config.mjs (@tailwindcss/postcss), eslint.config.mjs (next + ts), next-env.d.ts.',
  '- src/app/layout.tsx: IBM Plex Mono + IBM Plex Sans via next/font/google as CSS vars; import globals.css; metadata title "akaTOOL — Album Art Engine".',
  '- src/app/globals.css: @import "tailwindcss"; an @theme block with dark tokens (bg #0a0a0b, panel #0c0c0e, borders #18181b/#161619, ink #e8e8ea, prototype grey scale); PORT the range-input + scrollbar + keyframes CSS from ' + SRC + ' <style> so sliders/scrollbars match.',
  '- src/app/page.tsx: minimal placeholder; the Port phase replaces it.',
  '',
  'Freeze the engine CONTRACT so the two Port agents compile in parallel. Under src/engine and src/presets create EXACTLY the files in this contract, with heavy logic as STUBS (valid signatures + minimal bodies) so everything type-checks:',
  CONTRACT,
  'Write real types.ts + registry.ts; prng.ts/palettes.ts/color.ts may be stub or real but MUST export correct signatures; sharedParams.ts stub exporting []; render.ts orchestrator skeleton calling effect stubs; effects/* stubs + effects/index.ts barrel; engines/{blob,grid,waves,orb}.ts stub FieldEngines that self-register (placeholder params[]); engines/index.ts importing the four; index.ts re-exporting all + import "./engines"; src/presets/index.ts stub (presets:[], getPresets()).',
  '',
  'Then run pnpm install at ROOT ONCE, then pnpm exec next build to confirm the skeleton compiles + statically exports. Fix any errors. Report the final src tree (depth 3) and build result.',
  '',
  NOFLICKER,
  DETERMINISM,
].join('\n'), { label: 'scaffold', phase: 'Scaffold', effort: 'high' })
log('scaffold + contract done')

// ---------------- PORT (2 parallel) ----------------
phase('Port')
const ported = await parallel([
  () => agent([
    'Fill the INTERNAL engine module at ' + ROOT + '/src/engine/** and presets at ' + ROOT + '/src/presets/**. Scaffold + contract stubs + node_modules exist (do NOT install). Replace stubs with real implementations ported faithfully from ' + SRC + ':',
    '- prng.ts: the Math.imul hash-chain prng (verbatim).',
    '- palettes.ts: the palettes() object (dark/cream/grey) verbatim into "palettes"; resolveMood().',
    '- color.ts: rgb/rgba/huerot.',
    '- effects/: FULLY port bloom, vignette, postColor, soften, scratches, grain (STATIC; drop the per-frame boil reseed), drawSigil (full ribbon/thorn/spine/barb/frame/marks), drawText (title/artist, case, distort/glitch + chromatic split, alignment, position; return TextBox).',
    '- sharedParams.ts: ParamDef[] for mood + finish (contrast,saturation,vignette,bloom,soften) + texture (grain,grainSize,dust,scratches,scratchCount) + sigil (sigilMarks,sigilMarkCount,sigilMarkSize,sigilMarkScatter,sigilFrame,sigilFrameDensity) + type (showText,title,artist,textCase,distort,textColor). Use the prototype exact min/max/defaults.',
    '- engines/{blob,grid,waves,orb}.ts: real FieldEngine plugins. blob = else-branch of renderTo (paint/diamonds/accents/blur); grid = fieldGrid; waves = fieldWaves; orb = fieldOrb (halftone STATIC). Each self-registers; finalize params[] to match the prototype UI. Animate via anim.kickEnv/pumpEnv/drift/swirl on SPACE only.',
    '- render.ts: finalize renderTo: base fill, dispatch field, build AnimState (kickEnv/pumpEnv as smooth exp attack-decay from beat phase using animBPM; NO strobe/flicker), finish order soften, scratches, drawSigil, postColor, bloom, vignette, grain, drawText; return {textBox}. OMIT flicker overlay/strobe/pump-darken/hue-cycle.',
    '- src/presets/index.ts: the 8 presets (VOID, RITUAL, ASH, BLEACH, TOXIC, STATIC, OBSIDIAN, HAZE) as typed data.',
    'Then run pnpm exec tsc --noEmit and fix engine-side type errors.',
    rules('Edit ONLY src/engine/** and src/presets/**. Do not touch src/app, src/components, src/lib, or configs.'),
  ].join('\n'), { label: 'port:engine', phase: 'Port', effort: 'high' }),

  () => agent([
    'Build the studio UI in ' + ROOT + ' reading from the engine contract (import from "@/engine" and "@/presets"). Contract stubs already compile, so code against them. Recreate the studio from ' + SRC + ' as clean React + Tailwind (dark/minimal: header "akaCOVART", big square canvas stage with caption "3000 x 3000 PX . SEED n", right 364px control panel). Own ONLY: src/app/page.tsx, src/components/**, src/lib/**.',
    '- src/lib/store.ts: Zustand store with all params (seed, mood, engine, every shared + engine param, animate params animBPM/animPump/animKick/animSpeed/animDrift/animSwirl, mode still|animate, open-section flags, gallerySeeds, rendering/recording flags), initialized from prototype defaults; setState merge + selectors.',
    '- src/components/: Studio.tsx (client) = header + CanvasStage + ControlPanel. CanvasStage.tsx: 2D canvas calling renderTo(canvas,880,params) on change (signature-diffed), animate RAF loop for mode==="animate" (renderTo with _anim/_t/_rt + live contrast/saturate CSS filter; NO flicker), drag-to-move text via returned textBox, and the 9-thumbnail variations Gallery (renderTo small, showText off). ControlPanel.tsx + primitives (Section collapsible, Slider, Toggle, Segmented, TextInput): schema-driven from sharedParams + getEngine(engine).params + listEngines() tabs, grouped exactly like the prototype (engine tabs; seed+GENERATE; STARTING POINTS = presets + variations gallery; PALETTE/MOOD; COMPOSITION = engine-specific; TEXTURE; SIGIL; TYPE OVERLAY; footer STILL/ANIMATE + primary action).',
    '- Export: PNG at 3000 (offscreen renderTo(3000) -> toBlob -> download) wired to primary action in still mode; animate primary = MediaRecorder video (basic).',
    '- src/app/page.tsx: render <Studio/>. Use "use client" appropriately; NO window/canvas access during SSR (output:"export"; guard with useEffect/refs).',
    '- Styling: Tailwind utilities + theme tokens; reproduce the prototype spacing/typography (IBM Plex Mono micro-labels).',
    'Then run pnpm exec tsc --noEmit for the UI and fix UI type errors (engine types may still be stubs; fine).',
    rules('Edit ONLY src/app/page.tsx, src/components/**, src/lib/**. Do not touch src/engine, src/presets, or configs.'),
  ].join('\n'), { label: 'port:ui', phase: 'Port', effort: 'high' }),
])
log('port complete: ' + ported.filter(Boolean).length + '/2')

// ---------------- INTEGRATE ----------------
phase('Integrate')
const integration = await agent([
  'Integrate the single Next.js app at ' + ROOT + ' into a working studio. You MAY edit any file now.',
  '1) Run pnpm install (in case of drift) then pnpm exec tsc --noEmit; FIX all type errors at the seams between the engine module and the UI (conform UI to the engine contract; engine is source of truth).',
  '2) Run pnpm exec next build (static export). FIX any build/SSR errors; ensure all canvas/DOM access is client-side only (no window on server); this is output:"export".',
  '3) Quick lint pass for obvious errors; do not bikeshed.',
  '4) Update ' + ROOT + '/.claude/launch.json: add a config "akatool-web" running the Next dev server (runtimeExecutable "pnpm", runtimeArgs ["dev"], port 3000). Keep existing configs.',
  '5) LAST, after the build passes: create ' + ROOT + '/reference/ and move index.html, support.js, server.js, and the .dc.html into it (keep uploads/ at root). Add reference/README.md noting these are the original prototype kept for provenance / as the 2D reference.',
  '6) Final: run pnpm exec next build once more; confirm it passes. Report what you fixed, the final src tree, and whether build passes.',
  'Goal: pnpm install && pnpm dev serves a working studio at localhost:3000 with all four 2D engines, presets, gallery, export, and NO flicker in animate mode.',
].join('\n'), { label: 'integrate', phase: 'Integrate', effort: 'high' })

return { scaffold, ported: ported.filter(Boolean).length, integration }
