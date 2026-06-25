# akaCOVART — agent guide & project rules

Generative album-art studio. **Next.js (static export → Vercel from `main` → akacovart.com).**
An internal, framework-agnostic **engine module** (`src/engine`) renders 2D canvas art; a **studio UI** (`src/components`) drives it via a flat Zustand store. Read this before editing — it encodes the architecture and the rules that keep the project clean, deterministic, and fast.

---

## Architecture map (who owns what)

```
src/
  engine/                 ← render core. NO React, no DOM-framework imports.
    types.ts              ← FieldEngine descriptor (id, label, kind:"2d", params, field())
    registry.ts           ← registerEngine / getEngine / listEngines
    engines/              ← ONE file per engine; engines/index.ts imports each to self-register
    render.ts             ← renderTo(canvas,size,params) + renderFormatTo (square→format crop)
    prng.ts               ← seeded PRNG (the ONLY source of randomness)
    palettes.ts, color.ts ← mood palettes + colour transforms (hue/sat/warm/tone)
    effects.ts / effects/ ← finish chain (soften, bloom, vignette, grain, text…)
    sharedParams.ts
  lib/
    store.ts              ← Zustand: a FLAT bag of generation params + UI flags
    export.ts             ← PNG / video export   formats.ts ← delivery aspect ratios   utils.ts
  components/
    studio/               ← shell: Studio, Header, EngineSelector, SeedRow, MobileControls,
                            Formats, Preview, ModeToggle/Reset/Export
    controls/             ← DATA-DRIVEN param UI: controls-config.ts (schema) + Controls.tsx
                            (generic mapper) + primitives/ (self-subscribing rows)
    canvas/               ← CanvasStage (the live <canvas> + render loops), Stage
    intro/                ← landing hero (auto-cycling engine loops)
    audio/, ui/
  presets/                ← curated "starting point" looks (plain data)
  app/                    ← Next app router
.claude/skills/           ← add-engine, add-preset, akatool-* (USE these for those tasks)
```

---

## The golden rules (do not break)

1. **Params are DATA, never copy-pasted JSX.** To add/change a param, edit three places only:
   `store.ts` (interface field + default) → `controls/controls-config.ts` (a schema entry in
   `COMPOSITION_BY_ENGINE` / `MOTION_BY_ENGINE` / a GROUP) → the engine reads `params.yourKey`.
   `Controls.tsx` maps the config to self-subscribing primitives — **do not hand-write slider/toggle rows.**

2. **Engines are deterministic.** Same `(seed, params)` ⇒ same image. Derive ALL randomness from
   `prng(seed ^ 0x…)`. No `Math.random()` / `Date.now()` in render paths. (Rare, intentional
   exceptions like a per-frame sparkle are explicitly commented — don't add new ones casually.)

3. **Motion is space-only and flicker-free.** Animate scale / position / displacement / radius.
   **NEVER** per-frame hue / brightness / opacity strobe. `postColor` is baked only when still or
   exporting. This is the project's #1 aesthetic rule.

4. **Render square; formats cover-crop.** Engines draw a square field at `size`. Delivery formats are
   centre cover-crops via `renderFormatTo`; type is drawn in FRAME space AFTER the crop, so it lands
   consistently in every aspect ratio.

5. **Self-subscribing rows = perf.** Each control row reads ONLY its own store slice; moving one
   slider must re-render that row, never the whole panel. Use fine-grained selectors; never select the
   whole store object in a component that renders often.

6. **Store is a flat, serializable bag.** Heavy/non-serializable state (audio buffers, analysis
   timelines, peaks) lives in `src/audio`, not the store — the store keeps only a serializable mirror.
   `renderTo` receives the whole object, so **store keys must match what the engine reads.**

7. **New engine → use the `add-engine` skill. New preset → `add-preset`.** They enforce rules 1–3 and
   the exact wiring (register in `engines/index.ts`, schema in `controls-config.ts`, defaults in `store.ts`).

8. **The landing loops are SNAPSHOTS.** `intro/Intro.tsx` `PRESETS` hardcodes one param snapshot per
   engine. When you change an engine's look or params, **re-tune the matching preset** or the start
   page renders the new engine with old tuning and looks "old." (See `HANDOFF-start-loops.md`.)

---

## Performance levers
- Live animation renders at an **adaptive / throttled** backing-store size; transitions are driven by
  **CSS transform/opacity (GPU-composited)**, with the engine raster repainted at a throttled rate.
  Heavy passes (blur/grain) scale with buffer size — keep buffers modest; backing-size is the lever.
- Don't add per-frame React state updates; the render loop lives in refs + rAF, not state.

## Verify & ship
- Before any push: `pnpm exec tsc --noEmit && pnpm exec next build` — **must pass with NO warnings**
  (Vercel lint-fails things a tsc-only check misses).
- Deploys from `main`. Commit/push **only when the user asks.**

## ⚠️ Environment gotcha (will waste your time if you don't know it)
The repo sits in **iCloud-synced `~/Desktop`**. iCloud creates conflict-copy dupes (`routes.d 3.ts`,
`cache-life.d 3.ts`, …) inside the gitignored `.next/` cache. Symptoms — **while production is fine**:
`tsc`/`build` "Duplicate identifier" errors, the local hero/canvas stuck blank at 300×150, dev servers
silently dropping, reloads serving a stale bundle. **Fix:** `find .next -name "* [0-9].ts" -delete`
then restart dev. **Durable fix:** move the repo out of iCloud (e.g. `~/dev/aka-covart`).

## ⚠️ Working cleanly (this repo gets edited concurrently)
- **Re-read a file immediately before editing it** — another agent/session may have changed it; your
  `old_string` can be stale and a structural rewrite can clobber your work.
- Keep each change **scoped to the task**; don't bundle unrelated refactors into one commit.
- Don't duplicate logic to dodge a conflict — fix the shared source (`controls-config.ts`, `store.ts`,
  the engine). Duplication here (e.g. mobile vs desktop controls) is debt; prefer one shared definition.
