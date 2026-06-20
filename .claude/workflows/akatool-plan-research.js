export const meta = {
  name: 'akatool-plan-research',
  description: 'Research + synthesize a plan to rebuild akaCOVART Album Art Engine as an open-source, Claude-extensible Next.js tool',
  phases: [
    { title: 'Research', detail: 'parallel deep-dives: next.js arch, claude extensibility, OSS setup, engine refactor, export pipeline, live/community' },
    { title: 'Synthesize', detail: 'fuse research into one opinionated plan' },
    { title: 'Critique', detail: 'adversarial completeness pass' },
    { title: 'Finalize', detail: 'incorporate critique + produce decisions list' },
  ],
}

const RESEARCH_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    dimension: { type: 'string' },
    summary: { type: 'string', description: 'tight 4-8 sentence overview of findings' },
    recommendations: {
      type: 'array',
      items: {
        type: 'object', additionalProperties: false,
        properties: {
          title: { type: 'string' },
          detail: { type: 'string' },
          rationale: { type: 'string' },
          confidence: { type: 'string', enum: ['high','medium','low'] },
        },
        required: ['title','detail','rationale','confidence'],
      },
    },
    risks: { type: 'array', items: { type: 'string' } },
    openQuestions: { type: 'array', items: { type: 'string' } },
    sources: {
      type: 'array',
      items: { type: 'object', additionalProperties: false, properties: { title: { type:'string' }, url: { type:'string' } }, required: ['title','url'] },
    },
  },
  required: ['dimension','summary','recommendations','risks','openQuestions','sources'],
}

const webNote = 'Load web tools first with ToolSearch query "select:WebSearch,WebFetch", then use them to verify CURRENT (mid-2026) versions, APIs, and best practices — do not rely on memory for version numbers or framework specifics. Cite concrete sources (url + title).'

const DIMENSIONS = [
  {
    key: 'nextjs-arch',
    prompt: 'You are researching the front-end architecture for rebuilding a heavy client-side HTML5 <canvas> generative-art tool ("akaCOVART Album Art Engine") as a Next.js + Tailwind app with clean, minimal styling.\n\n' + webNote + '\n\nCover concretely:\n- Current stable Next.js (App Router) and Tailwind versions and the recommended way to scaffold (create-next-app flags), with React version.\n- For an app that is ~entirely a client-side interactive canvas: RSC vs client components boundary, where the canvas/engine lives, "use client" strategy, avoiding hydration pitfalls.\n- Static export (output: export) vs SSR/edge for a "live testable version" — tradeoffs, and whether a static SPA-style export is best for a free canvas playground (and still deployable to Vercel/GitHub Pages/Cloudflare).\n- Tailwind v4 setup specifics (CSS-first config, @theme, tokens) and how to achieve a clean minimal dark UI matching an existing design (IBM Plex Mono/Sans, dark panels, sliders).\n- Performance: keeping the 60fps animate loop + 3000px export off the main thread (OffscreenCanvas, Web Workers, transferControlToOffscreen), and how that interacts with React state.\n- TypeScript project conventions, ESLint/Prettier, recommended folder structure for app/ + a framework-agnostic engine package.\nReturn structured findings.',
  },
  {
    key: 'claude-extensibility',
    prompt: 'You are researching how to make an open-source tool "Claude-centric" — designed so other people can build on top of it through Claude (Claude Code skills, plugins, MCP, params/presets-as-data). The tool is a generative album-art engine with typed parameters, multiple "engines" (blob/grid/waves/orb), presets, and PNG/video export.\n\n' + webNote + '\n\nResearch the CURRENT (mid-2026) state and conventions of:\n- Claude Code Skills (SKILL.md format/frontmatter, the .claude/skills directory, how skills are discovered/invoked, packaging). How could a skill let someone generate/iterate album art ("make me a dark techno cover") that drives this engine\'s params?\n- Claude Code plugins and plugin marketplaces (structure, how others install/distribute, plugin manifests). Could akaCOVART ship as a plugin?\n- MCP servers as the integration backbone: exposing the engine as MCP tools (generate(params)->image, list_engines, list_presets, randomize, export) so ANY Claude surface (Code, desktop, API) can call it. Local (stdio) vs remote (HTTP) MCP, auth, returning images.\n- CLAUDE.md conventions and how an opinionated CLAUDE.md + a typed param/preset schema make the repo easy for Claude to extend safely.\n- The "params/engines/presets as data" pattern: a declarative schema that simultaneously (a) auto-generates the UI controls, (b) is the contract Claude/MCP uses, (c) lets contributors add engines/presets via PRs or even via Claude.\n- Concrete examples of existing open-source projects that are explicitly "extend via Claude" (skills/MCP) to model the pattern after.\nBe specific and opinionated about the BEST architecture for "others build on top in their own ways via Claude." Return structured findings.',
  },
  {
    key: 'oss-setup',
    prompt: 'You are researching how to set up "akaCOVART" as a healthy open-source project on GitHub (repo already at https://github.com/akaieuan/akaCovart) that the owner uses personally now, wants others to build on, and might commercialize / keep brand control later.\n\n' + webNote + '\n\nCover:\n- License choice with clear tradeoffs for this exact situation: permissive (MIT, Apache-2.0 — note Apache patent + trademark clauses) vs copyleft (GPL-3.0, AGPL-3.0 — relevant because it is a web app others could host) vs dual-licensing / open-core. Recommend one, and explain trademark protection for the "akaCOVART" name separate from the code license.\n- Repo scaffolding: README (with live demo + screenshots), CONTRIBUTING, CODE_OF_CONDUCT, SECURITY.md, LICENSE, issue/PR templates, good-first-issue labeling.\n- Monorepo vs single app: is a pnpm + Turborepo monorepo (packages: engine, ui, mcp-server, app, presets) worth it here, or single Next.js app to start? Recommend a structure with migration path.\n- CI/CD: GitHub Actions (lint, typecheck, test, build), Vercel preview deployments per PR, conventional commits + Changesets for versioning npm packages, release automation.\n- Publishing the engine as an npm package so others can install it outside Claude.\n- Governance/discoverability: topics, awesome-lists, how to attract contributors.\nReturn structured, opinionated findings.',
  },
  {
    key: 'engine-architecture',
    prompt: 'You are designing the refactor of an existing MONOLITHIC canvas generative-art engine into a clean, typed, PLUGGABLE architecture so new "engines" and "presets" can be added by contributors (and by Claude).\n\nFirst, Read the current implementation to ground your recommendations:\n- /Users/ieuanking/Desktop/nuu/aka-covart/index.html  (contains the ENGINE object: renderTo + fieldGrid/fieldWaves/fieldOrb + drawSigil + grain/bloom/vignette/postColor/text + palettes + presets + a deterministic seeded prng, plus a plain-JS UI controller).\n\n' + webNote + ' (especially: TypeScript plugin-registry patterns, zod or similar for schema-driven params, deterministic seeded PRNG, canvas testing/snapshot approaches.)\n\nDesign and specify:\n- A TypeScript Engine interface (id, label, param schema, render(ctx, size, params, rng, anim)) and a registry so engines are self-registering modules. Show how blob/grid/waves/orb become 4 plugins implementing one interface.\n- A declarative param schema (e.g., zod) that yields: types, ranges, defaults, labels/groups — and is consumed by BOTH the auto-generated UI and the MCP/Claude contract. Include shared "finish" params (contrast/sat/vignette/bloom/grain/sigil/text) vs engine-specific params.\n- Preset schema as plain JSON/TS data (so presets are trivially contributable), incl. how presets reference engine + params + seed.\n- Separation: pure render core (no DOM/React) + thin React UI + export adapters. Determinism (seeded PRNG) so the same params+seed reproduce identically across UI, MCP, and server.\n- Testing strategy: pixel/snapshot tests for determinism, schema validation tests.\n- Security: contributed engines run untrusted canvas code — sandboxing/review implications.\nReturn structured findings with the concrete interface/schema sketches in the detail fields.',
  },
  {
    key: 'export-pipeline',
    prompt: 'You are researching the EXPORT + sharing pipeline for a browser generative-art tool being rebuilt in Next.js: high-res PNG (3000x3000) and looping video export, plus shareable permalinks, plus a possible server/API render path.\n\n' + webNote + '\n\nCover with current (mid-2026) facts and tradeoffs:\n- Non-blocking high-res PNG render (3000px): OffscreenCanvas in a Web Worker, transferControlToOffscreen, canvas.convertToBlob; memory limits; progress UI.\n- Video export options compared: MediaRecorder (current approach; webm/mp4 support varies), WebCodecs (VideoEncoder) for precise frames + seamless loops, and ffmpeg.wasm (note: LGPL/GPL licensing implications for an MIT/Apache project, bundle size, perf). Which gives clean seamless BPM-synced loops?\n- Shareable state: encoding seed + engine + params into a URL (compact encoding, versioning the schema), and rehydrating; "open in app" links.\n- Server-side / API render (so Claude or others can render without a browser, and for social share images): node-canvas vs napi-rs/canvas vs headless-browser vs skia; running the SAME engine code server-side (determinism); Vercel function limits; an HTTP "render" endpoint that the MCP server and a public API could share.\n- Optional: og:image generation for shared links.\nReturn structured findings.',
  },
  {
    key: 'live-community',
    prompt: 'You are researching the "live testable version" + distribution/community strategy for an open-source, Claude-extensible generative album-art tool (owner will get a custom domain later).\n\n' + webNote + '\n\nCover:\n- Hosting the live playground: Vercel (preview deployments per PR, custom domain later) vs Cloudflare Pages vs GitHub Pages — recommend for a mostly-static client app with an optional render API; cost at hobby scale.\n- A shareable, embeddable playground UX: permalinks (seed+params in URL), "remix this", gallery of community presets.\n- A community preset/engine registry: options ranked — (a) presets as JSON files contributed via PR into the repo and shown in-app, (b) presets/engines published as npm packages discovered via a manifest, (c) a lightweight hosted gallery. Recommend the lowest-friction path that still scales.\n- How Claude users discover and install the skill/plugin/MCP (marketplace listing, README quickstart, one-command install), and how a non-Claude user just uses the website.\n- Light analytics/privacy (privacy-friendly analytics), feedback loop, roadmap visibility (GitHub Projects).\n- Branding touchpoints: keeping the "akaCOVART" aesthetic while being a clean general tool others can reskin.\nReturn structured findings.',
  },
]

phase('Research')
const research = await parallel(DIMENSIONS.map(d => () =>
  agent(d.prompt, { label: 'research:' + d.key, phase: 'Research', schema: RESEARCH_SCHEMA, effort: 'high' })
))
const findings = research.filter(Boolean)
log('research complete: ' + findings.length + '/' + DIMENSIONS.length + ' dimensions')

const bundle = JSON.stringify(findings, null, 2)

phase('Synthesize')
const planV1 = await agent(
  'You are the lead architect. Synthesize the following multi-dimension research into ONE cohesive, opinionated implementation plan for rebuilding "akaCOVART Album Art Engine" as:\n  (1) a clean, minimal Next.js + Tailwind app the owner uses for their own album art,\n  (2) a LIVE, testable, shareable web version,\n  (3) an OPEN-SOURCE project others can build on,\n  (4) and crucially "Claude-centric": designed so others extend it via Claude (skills, MCP, params/presets-as-data).\n\nWrite the plan in clean Markdown with these sections:\n## Vision & product shape\n## Tech stack (with current versions) & why\n## Repository structure (concrete tree)\n## The engine refactor (typed plugin + schema-driven params/presets) — the core\n## Claude-centric extensibility design (skills + MCP + data-as-extension) — the differentiator, be concrete about how a stranger adds an engine/preset/skill\n## Export & sharing (PNG/video/permalinks/API)\n## Live deploy & community\n## Open-source setup & licensing recommendation\n## Phased roadmap (Phase 0..N with crisp deliverables, what ships when, and what the owner can test at each phase)\n## Risks & mitigations\n\nBe specific and decisive (recommend defaults, do not just list options). Keep it scannable. Ground every major claim in the research. Here is the research bundle:\n\n' + bundle,
  { label: 'synthesize', phase: 'Synthesize', effort: 'high' }
)

phase('Critique')
const critique = await agent(
  'You are an adversarial reviewer. Critique this plan for an open-source, Claude-extensible Next.js generative-art tool. Find: gaps, unverified/risky claims, missing concerns (security of running contributed/untrusted engine code, brand/trademark, accessibility, mobile/responsive, SEO/discoverability, cost at scale, maintenance burden for a solo owner, scope creep vs MVP, schema versioning/migration, font licensing, video codec licensing). For each issue give: what is missing/wrong, why it matters, and a concrete fix. Be specific and harsh but constructive.\n\nPLAN:\n' + planV1,
  { label: 'critique', phase: 'Critique', effort: 'high' }
)

phase('Finalize')
const FINAL_SCHEMA = {
  type: 'object', additionalProperties: false,
  properties: {
    planMarkdown: { type: 'string', description: 'the FINAL, complete plan in Markdown, with critique incorporated' },
    decisionsForUser: {
      type: 'array',
      description: '3-6 high-leverage decisions that change what gets built and need the owner to choose before building starts',
      items: {
        type: 'object', additionalProperties: false,
        properties: {
          topic: { type: 'string', description: 'short label, e.g. License' },
          question: { type: 'string' },
          options: { type: 'array', items: { type: 'object', additionalProperties:false, properties: { label:{type:'string'}, tradeoff:{type:'string'} }, required:['label','tradeoff'] } },
          recommendation: { type: 'string', description: 'which option you recommend and one-line why' },
        },
        required: ['topic','question','options','recommendation'],
      },
    },
    mvpFirstWeek: { type: 'array', items: { type: 'string' }, description: 'the concrete first slice to build once approved' },
  },
  required: ['planMarkdown','decisionsForUser','mvpFirstWeek'],
}
const final = await agent(
  'Produce the FINAL plan by incorporating the critique into the synthesized plan. Output the complete improved plan as Markdown in planMarkdown (keep all good sections, fix the gaps the critique found, add a short "Security & untrusted contributions" and "Brand vs license" note if missing). Then extract decisionsForUser (3-6 real forks the owner must pick: e.g. license, monorepo-vs-single, video export tech, hosting, MVP scope, skill-vs-MCP-vs-both priority) each with options+tradeoffs+your recommendation. Then give mvpFirstWeek: the first concrete build slice.\n\nSYNTHESIZED PLAN:\n' + planV1 + '\n\nCRITIQUE TO INCORPORATE:\n' + critique,
  { label: 'finalize', phase: 'Finalize', effort: 'high', schema: FINAL_SCHEMA }
)

return final
