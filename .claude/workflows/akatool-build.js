export const meta = {
  name: 'akatool-build',
  description: 'Build akaCOVART/akaTOOL: pnpm monorepo + Next.js app, 2D engine baseline + WebGL ORB, contract-first parallel build',
  phases: [
    { title: 'Scaffold', detail: 'monorepo + Next.js/Tailwind scaffold, declare all deps, install once' },
    { title: 'Contract', detail: 'freeze typed engine interface, registry, prng, palettes, orchestrator, stubs' },
    { title: 'Build', detail: '8 parallel agents on disjoint files: 4 engines, effects, web UI, WebGL ORB, presets+mcp+docs' },
    { title: 'Integrate', detail: 'wire registry, typecheck+build whole graph, fix seams, archive prototype' },
  ],
}

const ROOT = '/Users/ieuanking/Desktop/nuu/aka-covart'
const SRC = ROOT + '/index.html' // the frozen 2D prototype to port the LOOK from

// ---- The frozen contract every agent codes against. Foundation implements it EXACTLY; build agents consume it EXACTLY. ----
const CONTRACT = `
TypeScript contract for package @akacovart/engine (transpiled by Next via transpilePackages; no build step; import TS source directly).

// packages/engine/src/types.ts
export type Mood = 'dark' | 'cream' | 'grey'
export type RNG = () => number
export interface ParamDef {
  key: string
  label: string
  type: 'range' | 'int' | 'toggle' | 'select' | 'text'
  group?: 'composition' | 'finish' | 'texture' | 'sigil' | 'type' | 'palette' | 'seed'
  min?: number; max?: number; step?: number
  default: number | boolean | string
  options?: { value: string; label: string }[]
}
export interface Palette {
  base: number[]; colors: number[][]; diamondColors: number[][]
  fleck: number[]; smoke: number[]; accentColors: number[][]
  scratch: string; markerColors: number[][]; markerBg: number[]; markerDot: number[]
  blobCount: number; rMin: number; rMax: number; aMin: number; aMax: number
  diamondAlpha: number; topSmudge: boolean; clearCenter: boolean
}
// Eased animation values ONLY. NOTE: there is deliberately NO strobe, NO flicker, NO per-frame
// hue-cycle, NO brightness-flash term. Beats drive space/scale/displacement, never brightness.
export interface AnimState {
  anim: boolean; t: number; rt: number; bake: boolean
  kickEnv: number   // smooth exponential attack-decay impulse in [0,1], use for scale/displacement
  pumpEnv: number   // smooth breathing envelope in [0,1], use for scale/optical-depth only
  drift: number; swirl: number   // 0..1 ambient motion amounts
}
export interface FieldArgs {
  ctx: CanvasRenderingContext2D; size: number
  params: Record<string, any>
  mood: Mood; cfg: Palette; seed: number
  anim: AnimState
}
export interface FieldEngine {
  id: string            // 'blob' | 'grid' | 'waves' | 'orb'
  label: string         // 'BLOB' etc
  kind: '2d'
  params: ParamDef[]    // engine-specific params only (NOT the shared finish/texture/sigil/type/seed/palette)
  field(args: FieldArgs): void   // draws the engine field onto ctx; base fill already done by orchestrator
}

// packages/engine/src/registry.ts
export function registerEngine(e: FieldEngine): void
export function getEngine(id: string): FieldEngine | undefined
export function listEngines(): FieldEngine[]

// packages/engine/src/prng.ts  (port verbatim from prototype)
export function prng(seed: number): RNG

// packages/engine/src/palettes.ts
export const palettes: Record<Mood, Palette>
export function resolveMood(seed: number, mood: Mood | 'random'): Mood

// packages/engine/src/color.ts
export function rgb(c: number[]): string
export function rgba(c: number[], a: number): string
export function huerot(c: number[], deg: number): number[]   // kept for utility; NOT used per-frame on beat

// packages/engine/src/effects/*  (signatures fixed by foundation; bodies of sigil/grain/text filled by the effects agent)
export function bloom(ctx: CanvasRenderingContext2D, size: number, amount: number): void
export function vignette(ctx: CanvasRenderingContext2D, size: number, amount: number): void
export function postColor(ctx: CanvasRenderingContext2D, size: number, contrast: number, sat: number): void
export function soften(ctx: CanvasRenderingContext2D, size: number, amount: number, cfg: Palette): void
export function scratches(ctx: CanvasRenderingContext2D, size: number, count: number, rng: RNG, cfg: Palette): void
export function grain(ctx: CanvasRenderingContext2D, size: number, amount: number, gsize: number, dust: number, rng: RNG): void
export function drawSigil(ctx: CanvasRenderingContext2D, size: number, params: Record<string, any>, mood: Mood, rng: RNG): void
export interface TextBox { x: number; y: number; w: number; h: number }
export function drawText(ctx: CanvasRenderingContext2D, size: number, params: Record<string, any>, mood: Mood, rng: RNG): TextBox

// packages/engine/src/sharedParams.ts  — seed/palette/finish/texture/sigil/type params (NOT engine-specific)
export const sharedParams: ParamDef[]

// packages/engine/src/render.ts  — the orchestrator
export interface RenderResult { textBox?: TextBox }
// Resolves mood+palette, fills base, dispatches to getEngine(params.engine).field(...), then applies
// finish in this order: soften, scratches, drawSigil, postColor, bloom, vignette, grain, drawText.
// During anim it OMITS: the flicker overlay, strobe, pump multiply-darken, and per-frame hue cycling.
export function renderTo(canvas: HTMLCanvasElement | OffscreenCanvas, size: number, params: Record<string, any>): RenderResult

// packages/engine/src/index.ts re-exports all of the above + './engines' (which self-registers blob/grid/waves/orb).
`

const RULES = `
HARD RULES (atomic soundness — violating these breaks the parallel build):
- Work ONLY on the files explicitly assigned to you. Do NOT create/edit any file outside your assigned paths.
- Do NOT run 'pnpm install', 'pnpm add', or modify any package.json or root config — all deps are pre-declared and installed in Phase 0.
- Do NOT edit packages/engine/src/registry.ts, index.ts, types.ts, render.ts, sharedParams.ts, prng.ts, palettes.ts, color.ts, or engines/index.ts — those are frozen by Phase 0. Import from them.
- Code EXACTLY against this contract (do not invent different signatures):
${CONTRACT}
- NO FLICKER: when porting/animating, never use brightness strobe, per-frame hue cycling, a white flicker overlay, multiply-darken on the beat, or grain reseeded per frame. Beat energy (anim.kickEnv / anim.pumpEnv) may only drive scale, position, displacement, or optical depth — never global brightness/opacity/hue. Default is calm; motion is continuous and eased.
- DETERMINISM: same (seed, params) must reproduce the same image. Derive any RNG from the seed via prng(seed ^ constant). Never use Math.random() in the render path.
- The prototype to port the LOOK from is at ${SRC}. Read the relevant section; preserve the visual character precisely, just restructured to the contract.
- TypeScript strict. No 'any' leaks in public signatures (internal 'any' on the loose params bag is fine). Keep code clean and matching surrounding style.
- When done, briefly self-check your files for obvious type errors. Report exactly which files you created/edited and any assumptions.
`

// ============================ PHASE 0a — SCAFFOLD ============================
phase('Scaffold')
const scaffold = await agent(
`You are setting up the foundation of a pnpm monorepo at ${ROOT} for "akaCOVART" (aka akaTOOL), a generative album-art tool. The directory currently contains the frozen prototype (index.html, support.js, server.js, Album Art Engine.dc.html, uploads/, .claude/). Do NOT delete or move those (a later phase archives them). Build the monorepo AROUND them.

Create this structure and INSTALL once:

ROOT files:
- git init (local only; no remote, no push). Add a thorough .gitignore (node_modules, .next, dist, .turbo, *.log, .DS_Store, coverage).
- pnpm-workspace.yaml -> packages: ['apps/*','packages/*']
- package.json (private root): name 'akacovart', scripts using pnpm recursive + turbo: "dev": run web app dev, "build","lint","typecheck" across workspace. Add devDeps: typescript, prettier, eslint, turbo, @types/node.
- turbo.json (pipeline: build/lint/typecheck; dev persistent).
- tsconfig.base.json (strict, moduleResolution 'bundler', target ES2022, jsx preserve, paths for @akacovart/*).
- .prettierrc, eslint flat config (eslint.config.mjs) reasonable for TS+React+Next.
- .nvmrc (a current LTS, e.g. 22), .npmrc (if helpful).
- LICENSE: the FULL, verbatim Apache License 2.0 text. NOTICE file naming the akaCOVART project and noting "akaCOVART" is a trademark of the project owner, not licensed under Apache-2.0.

PACKAGES (each with package.json + tsconfig.json extending base; type: module; "main"/"exports" -> ./src/index.ts so Next transpiles source directly, NO build step):
- packages/engine  (name @akacovart/engine; deps: zod). Create empty src/ (Phase 0b fills it).
- packages/webgl   (name @akacovart/webgl; deps: three, @react-three/fiber, @react-three/drei, @react-three/postprocessing; peerDeps react, react-dom). src/index.ts stub exporting {}.
- packages/presets (name @akacovart/presets; deps: @akacovart/engine workspace:*). src/index.ts stub.
- packages/mcp-server (name @akacovart/mcp-server; deps: @modelcontextprotocol/sdk, @akacovart/engine workspace:*; devDeps tsx). src/index.ts stub.

APP:
- apps/web (name @akacovart/web): a Next.js 15 App Router app, TypeScript, Tailwind v4.
  - package.json deps: next (latest 15), react@^19, react-dom@^19, zustand, @akacovart/engine workspace:*, @akacovart/webgl workspace:*, @akacovart/presets workspace:*. devDeps: tailwindcss@^4, @tailwindcss/postcss, postcss, typescript, @types/react, @types/react-dom, @types/node, eslint, eslint-config-next.
  - next.config.ts (or .mjs): transpilePackages: ['@akacovart/engine','@akacovart/webgl','@akacovart/presets']; reactStrictMode true.
  - postcss.config.mjs using @tailwindcss/postcss.
  - app/layout.tsx (imports globals.css, sets IBM Plex Mono + Sans via next/font/google), app/globals.css (@import "tailwindcss"; a @theme block with the dark palette tokens: bg #0a0a0b, panel #0c0c0e, borders #18181b/#161619, text #e8e8ea, muted greys; plus the range-input + scrollbar CSS ported from ${SRC}'s <style>). app/page.tsx: a minimal placeholder that says "akaTOOL — studio loads here" (Phase 1 web-UI agent replaces it). tsconfig.json with "paths" and next plugin.
  - Verify it is a valid scaffold.

Then run 'pnpm install' at ${ROOT} ONCE. Confirm it succeeds (report the install summary). If a package version is unresolved, pick the current stable and proceed. Use latest stable versions (verify with 'npm view <pkg> version' if unsure).

${RULES.replace('Do NOT edit packages/engine/src/registry.ts','(You ARE allowed to create the scaffold/config in this phase.) Later agents must not edit packages/engine/src/registry.ts')}

Deliverable: a clean installed monorepo skeleton where apps/web would build once the engine is filled. Report the tree and install result.`,
  { label: 'scaffold', phase: 'Scaffold', effort: 'high' }
)
log('scaffold done')

// ============================ PHASE 0b — CONTRACT ============================
phase('Contract')
const contract = await agent(
`You are freezing the engine CONTRACT for @akacovart/engine at ${ROOT}/packages/engine. The monorepo scaffold + node_modules already exist (do NOT run install). Implement EXACTLY this contract:
${CONTRACT}

Port faithfully from the prototype at ${SRC} (read it):
- prng.ts: port the prng function verbatim (the Math.imul hash chain).
- palettes.ts: port the palettes() object verbatim into 'palettes' (dark/cream/grey), plus resolveMood().
- color.ts: rgb/rgba and huerot (port huerot/shiftHue helper).
- effects: FULLY port the LIGHT effects bloom(), vignette(), postColor(), soften(), scratches() from the prototype. Create effects/sigil.ts, effects/grain.ts, effects/text.ts as STUBS that export the contract signatures with a minimal correct body (e.g. grain draws nothing yet / drawText returns a zero TextBox) — the effects agent fills these in Phase 1. Re-export all effects from effects/index.ts.
- sharedParams.ts: define sharedParams as ParamDef[] covering EXACTLY the non-engine controls seen in ${SRC}: seed (handled separately, you may omit), mood (select: dark/cream/grey/random, group 'palette'), and finish: contrast, saturation, vignette, bloom, soften; texture: grain, grainSize, dust, scratches(toggle), scratchCount; sigil: sigilMarks(toggle), sigilMarkCount, sigilMarkSize, sigilMarkScatter, sigilFrame(toggle), sigilFrameDensity; type: showText(toggle), title(text), artist(text), textCase(select upper/lower/asis/manic), distort, textColor(select auto/light/dark). Use the same min/max/defaults as the prototype state.
- registry.ts: Map-based register/get/list.
- render.ts: the renderTo orchestrator. Port the structure of renderTo() from ${SRC}: get 2d context, clear, resolve mood, cfg=palettes[mood], fill base, then dispatch to getEngine(params.engine).field({ctx,size,params,mood,cfg,seed,anim}) — build the AnimState from params (_anim,_t,_rt,_bake,animDrift,animSwirl,animBPM,animPump,animKick): compute kickEnv and pumpEnv as SMOOTH exponential attack-decay envelopes from the beat phase (bps = animBPM/60; phase = (rt*bps)%1; kickEnv = exp(-phase*decay)) — DO NOT compute strobe/flicker. Then apply finish in order: soften, scratches, drawSigil, postColor, bloom, vignette, grain, drawText — and CRUCIALLY OMIT the prototype's flicker overlay, strobe term, pump multiply-darken, and per-frame hue cycling (those are removed by design). Return { textBox } from drawText.
- engines/blob.ts, grid.ts, waves.ts, orb.ts: create STUB FieldEngine modules — each exports a valid FieldEngine (correct id/label/kind/params[] using the prototype's ranges/defaults for that engine; field() can be a minimal no-op for now) and calls registerEngine(...) at module load. (Phase 1 agents replace the field() bodies and finalize params.) Define each engine's params here as a best-effort placeholder so the UI has them; the engine agents will refine.
  - blob params: density,smear,blobSize,glow,diamonds(toggle),diamondCount,diamondSize,diamondShape,accent,accentCount.
  - grid params: gridCols(int 3-18),gridDensity,gridPerspective,gridMagnet.
  - waves params: waveCount(int 10-160),waveAmp,waveDetail,waveTurbulence,wavePerspective.
  - orb params: orbSize,orbSoft,orbHalftone,orbMelt,orbShade.
- engines/index.ts: import './blob','./grid','./waves','./orb' (side-effect self-register).
- index.ts: re-export types, registry, prng, palettes, color, effects, sharedParams, render, and import './engines'.

After writing, run: cd ${ROOT} && pnpm --filter @akacovart/engine exec tsc --noEmit  (or npx tsc --noEmit -p packages/engine) and FIX any type errors so the package compiles cleanly. Report the result.

${RULES}`,
  { label: 'contract', phase: 'Contract', effort: 'high' }
)
log('contract frozen')

// ============================ PHASE 1 — 8 PARALLEL BUILDERS ============================
phase('Build')

const engineAgent = (id, label, srcHint, ownFile) => () => agent(
`Implement the ${label} field engine for @akacovart/engine. Edit ONLY ${ownFile}. The stub + contract already exist; replace the field() body (and finalize the params[] to match the prototype exactly) so it implements the real ${label} look ported from ${SRC} (${srcHint}).

- Keep it a self-registering FieldEngine (id '${id}', kind '2d'); preserve registerEngine call.
- Port the visual algorithm faithfully from the prototype but restructure to field(args). Derive RNGs from args.seed via prng(seed ^ <constant used in prototype>). Use args.cfg palette colors. The base fill is already done by the orchestrator — draw the field onto args.ctx.
- Animation: use args.anim.kickEnv / pumpEnv / drift / swirl to drive SPACE only (scale, position, displacement, amplitude) — NEVER brightness/opacity/hue flashes. Remove any brightness-flash, strobe, or hue-cycle behavior from the original animate path. Calm by default.
- Determinism preserved. TypeScript strict.

${RULES}`,
  { label: 'engine:' + id, phase: 'Build', effort: 'high' }
)

const tasks = [
  engineAgent('blob', 'BLOB', 'the else-branch in renderTo: paint/paintD canvases, samplePos by mood, smudge blobs, topSmudge/clearCenter, diamonds clip+fill, accent streaks, blur compositing', ROOT + '/packages/engine/src/engines/blob.ts'),
  engineAgent('grid', 'GRID', 'fieldGrid(): instanced soft blobs on a grid with density, perspective depth remap, magnet/scatter force, secondary offset blob', ROOT + '/packages/engine/src/engines/grid.ts'),
  engineAgent('waves', 'WAVE', 'fieldWaves(): stacked polylines summed from sine components + turbulence, perspective amplitude/width scaling', ROOT + '/packages/engine/src/engines/waves.ts'),
  engineAgent('orb', 'ORB', 'fieldOrb(): warped circle clip (melt), radial gradient body, fresnel-ish shade gradient, halftone dots (make halftone STATIC, not pulsing)', ROOT + '/packages/engine/src/engines/orb.ts'),

  // ⑤ heavy 2D effects bodies
  () => agent(
`Fill the bodies of the heavy 2D effects in @akacovart/engine. Edit ONLY these files: ${ROOT}/packages/engine/src/effects/sigil.ts, ${ROOT}/packages/engine/src/effects/grain.ts, ${ROOT}/packages/engine/src/effects/text.ts. Keep the exact exported signatures from the contract (do not change them; do not touch effects/index.ts or other files).

- sigil.ts: port drawSigil() from ${SRC} faithfully (ribbonW, thorn, spine with barbs/depth, sparkle, mark types, the barbed frame 4-way mirror, scattered marks). Reads params.sigilMarks/sigilMarkCount/sigilMarkSize/sigilMarkScatter/sigilFrame/sigilFrameDensity.
- grain.ts: port grain() (film grain noise tile + dust specks) BUT remove the per-frame 'boil' reseed entirely — grain is a STATIC cached noise tile (deterministic from rng); no flicker. Cache by (size|amount|gsize) like the prototype's non-boil path.
- text.ts: port text() -> drawText() returning TextBox. Title/artist with case transform, distort/glitch slices + chromatic split, alignment, position from params.textX/textY/textAlign. Use 'IBM Plex Mono'. Return the {x,y,w,h} textBox (normalized 0..1) for drag support.
- Determinism: derive randomness from the passed rng. TypeScript strict.

${RULES}`,
    { label: 'effects:heavy', phase: 'Build', effort: 'high' }
  ),

  // ⑥ web UI
  () => agent(
`Build the akaTOOL web studio UI in apps/web. You OWN everything under ${ROOT}/apps/web EXCEPT the directory ${ROOT}/apps/web/components/webgl/** (another agent owns that — leave it alone) and except next.config / postcss / package.json / globals.css theme tokens / layout fonts (already set in Phase 0 — you may ADD to globals.css but do not remove the theme block). Do not touch any packages/*.

Recreate the studio from the prototype ${SRC} as clean React + Tailwind (dark, minimal, matching the existing look: header 'akaCOVART', big square canvas stage with caption '3000 × 3000 PX · SEED n', right-hand 364px control panel).

Implement:
- A Zustand store (apps/web/lib/store.ts) holding all params (seed, mood, engine, every shared + engine param, animate params, mode 'still'|'animate', open-section flags, gallerySeeds, rendering/recording flags). Initialize defaults from the prototype state.
- A schema-driven control panel: read sharedParams from @akacovart/engine and the active engine's params via getEngine(engine).params + listEngines(). Render Range/Int sliders, Toggles, Select segmented groups, Text inputs, exactly matching the prototype's grouping (engine tabs; seed + GENERATE; collapsible sections STARTING POINTS [presets from @akacovart/presets + a 9-thumbnail variations gallery], PALETTE·MOOD, COMPOSITION [engine-specific], TEXTURE, SIGIL, TYPE OVERLAY; footer STILL/ANIMATE + primary action). Use the prototype's CSS classes/styling as a guide; implement with Tailwind utility classes + the theme tokens.
- A 2D canvas host component (apps/web/components/Stage2D.tsx) that calls renderTo(canvas, 880, params) from @akacovart/engine on state change (signature-diffed like the prototype), runs the animate RAF loop for mode==='animate' (calling renderTo with _anim/_t/_rt; apply the contrast/saturate CSS filter live; NO flicker), draws the 9 gallery thumbnails, and supports drag-to-move text using the returned textBox.
- Export buttons: PNG at 3000² (offscreen renderTo at 3000 -> toBlob -> download) and a video export for animate mode via MediaRecorder (basic; WebGL/WebCodecs video comes later). Wire to the primary action button.
- The stage must support BOTH a 2D engine (Stage2D) and, when the selected engine is the WebGL ORB, a dynamically-imported WebGL stage. Create a Stage host (apps/web/components/Stage.tsx) that switches: for kind '2d' engines render Stage2D; leave a clearly-commented integration slot to mount the WebGL ORB component from ${ROOT}/apps/web/components/webgl/ (the integration phase will connect it). Do NOT implement the webgl component yourself.
- app/page.tsx (or app/(studio)/page.tsx): compose header + Stage + ControlPanel. Keep it a client component boundary appropriately ('use client' where needed). Ensure no SSR access to window/canvas.

${RULES.replace('- Work ONLY on the files explicitly assigned to you. Do NOT create/edit any file outside your assigned paths.','- Work ONLY under apps/web (excluding apps/web/components/webgl/**). Do NOT edit any packages/*.')}`,
    { label: 'web:ui', phase: 'Build', effort: 'high' }
  ),

  // ⑦ WebGL ORB
  () => agent(
`Build the FLAGSHIP WebGL ORB in @akacovart/webgl + its integration component. You OWN: everything under ${ROOT}/packages/webgl/src/** and the single dir ${ROOT}/apps/web/components/webgl/**. Do not touch anything else.

This is the "TouchDesigner-core, physical, flicker-free" upgrade. Use react-three-fiber v9 (already installed) + @react-three/postprocessing. Build a self-contained React component <WebGLOrbStage params seed size /> (in apps/web/components/webgl/WebGLOrbStage.tsx) that renders an r3f <Canvas> with:
- A displaced sphere (icosphere) — vertex displacement by fbm/curl noise driven by an orbMelt-like uniform; fresnel rim light; soft wrap shading; base color from the @akacovart/engine palette for the resolved mood (import palettes/resolveMood/prng; bake seed -> uSeedOffset + color uniforms on the CPU for determinism).
- Postprocessing: subtle bloom + vignette + a STATIC/animated-by-scroll film grain + ACES tonemap. NO flashing.
- Flicker-free motion system (put reusable easing in packages/webgl/src/motion.ts): map a beat (animBPM) to an exponential attack-decay envelope and a spring; drive ONLY scale/displacement/optical-depth — never brightness/hue/opacity. Slow LFOs for ambient drift/swirl. Cap luminance delta per second conceptually (document the guardrail). Use useFrame to mutate uniforms; ZERO React re-renders per frame (read params via refs/props, mutate material.uniforms.*.value).
- Map ORB params (orbSize,orbSoft,orbHalftone,orbMelt,orbShade) + animate params to uniforms. Halftone as a postprocess or shader pattern, STATIC (no pulsing).
- packages/webgl/src/ should export the shared shader chunks (noise/curl/fbm in glsl as TS template strings), the motion utils, and an OrbField r3f component; the apps/web wrapper just mounts it (this wrapper will be dynamically imported with ssr:false by the integration phase).
- Keep it cleanly importable; do NOT add deps (all installed). TypeScript strict; r3f types.

Ground the look in the prototype fieldOrb at ${SRC} but make it genuinely 3D/physical.

${RULES.replace('- Work ONLY on the files explicitly assigned to you. Do NOT create/edit any file outside your assigned paths.','- Work ONLY under packages/webgl/src/** and apps/web/components/webgl/**.')}`,
    { label: 'webgl:orb', phase: 'Build', effort: 'high' }
  ),

  // ⑧ presets + mcp + docs/OSS
  () => agent(
`Three disjoint deliverables, all in areas no other agent touches:

1) PRESETS — fill ${ROOT}/packages/presets/src/** : port the 8 presets (VOID, RITUAL, ASH, BLEACH, TOXIC, STATIC, OBSIDIAN, HAZE) from ${SRC} into a typed Preset[] data module. Define a Preset type (name, engine default 'blob', params object, optional seed) and export an array + a helper getPresets(). Plain data so contributors can add presets via PR. Re-export from src/index.ts.

2) MCP SERVER (stub but real) — fill ${ROOT}/packages/mcp-server/src/** : a Model Context Protocol stdio server (using @modelcontextprotocol/sdk, already installed) exposing tools: list_engines (from @akacovart/engine listEngines), list_presets (from @akacovart/presets), get_param_schema(engineId) (sharedParams + engine.params), and randomize(engineId) returning a params object with a random seed. A generate(params) tool can return the params + a note that headless image render is a later milestone (do NOT implement headless canvas now). Make it runnable via tsx (bin in package.json already or add a src/index.ts with shebang). Add a short packages/mcp-server/README.md on how to register it with Claude.

3) DOCS / OSS — create at ROOT: README.md (project overview, what akaTOOL is, the "extend via Claude" pitch, monorepo layout, quickstart 'pnpm install && pnpm dev', license note), CONTRIBUTING.md (how to add an engine/preset against the contract, dev setup, the no-flicker + determinism rules as contribution guidelines), CODE_OF_CONDUCT.md (Contributor Covenant), SECURITY.md (note: contributed engines run untrusted canvas/shader code — review policy), CLAUDE.md (an opinionated guide for Claude/agents working in this repo: the engine contract, where engines/presets live, the no-flicker + determinism rules, how to add an engine plugin step by step). Also .github/ISSUE_TEMPLATE/ (bug + feature + new-engine/new-preset) and pull_request_template.md, plus a .github/workflows/ci.yml (pnpm install, typecheck, lint, build — no deploy). Do NOT edit LICENSE/NOTICE (already created).

Do not touch packages/engine, packages/webgl, or apps/web source.
${RULES.replace('- Work ONLY on the files explicitly assigned to you. Do NOT create/edit any file outside your assigned paths.','- Work ONLY in packages/presets/src, packages/mcp-server, and the ROOT docs/.github files listed.')}`,
    { label: 'presets+mcp+docs', phase: 'Build', effort: 'high' }
  ),
]

const built = await parallel(tasks)
log('parallel build complete: ' + built.filter(Boolean).length + '/' + tasks.length + ' units')

// ============================ PHASE 2 — INTEGRATE ============================
phase('Integrate')
const integration = await agent(
`You are the integration engineer. The contract-first parallel build is done at ${ROOT}. Make the whole monorepo compile, build, and run as one coherent app, fixing the seams between independently-built parts. You MAY edit any file now.

Do, in order:
1) Run 'pnpm install' at ${ROOT} (in case any package.json gained deps) and resolve issues.
2) Wire the WebGL ORB into the app: in apps/web, connect the integration slot in components/Stage.tsx to dynamically import (next/dynamic, ssr:false) the WebGL ORB stage from components/webgl/. Decide how ORB selection works: keep the four 2D engines (blob/grid/waves/orb) AND expose the WebGL orb (e.g. an engine option 'orb-gl' labeled "ORB ⚡" or a 2D/GPU toggle on ORB). Make a sensible, clean choice and implement it.
3) Typecheck the whole workspace: 'pnpm -r exec tsc --noEmit' (or per-package). FIX all type errors across packages (mismatched signatures, import paths, missing exports). The engine contract is the source of truth — conform consumers to it.
4) Build the web app: 'pnpm --filter @akacovart/web build' (next build). FIX any build/SSR errors (ensure all three.js/r3f/canvas usage is behind 'use client' + dynamic ssr:false; no window access on server).
5) Lint pass: fix obvious lint errors; don't bikeshed.
6) Update ${ROOT}/.claude/launch.json: add a config named 'akatool-web' that runs the Next dev server (runtimeExecutable 'pnpm', runtimeArgs ['--filter','@akacovart/web','dev'], port 3000). Keep existing configs.
7) Archive the prototype: create ${ROOT}/reference/ and move index.html, support.js, server.js, 'Album Art Engine.dc.html', and uploads/ into ${ROOT}/reference/. Update any references; add reference/README.md noting these are the original prototype kept for provenance and as the 2D-fallback reference. (Do this LAST, after everything else is verified, so earlier reads of index.html still worked.)
8) Final verification: run 'pnpm --filter @akacovart/web build' once more and confirm success. Report: what you wired, all errors you fixed, the final file tree (top 3 levels), and whether 'next build' passes.

Be thorough and decisive. The goal is: 'pnpm install && pnpm --filter @akacovart/web dev' starts a working studio with the 2D engines functional and the WebGL ORB selectable.`,
  { label: 'integrate', phase: 'Integrate', effort: 'high' }
)

return { scaffold, contract, integration, builtUnits: built.filter(Boolean).length }
