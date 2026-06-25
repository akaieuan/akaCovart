# Handoff — Start-page animated loops look "old" (+ mobile dock reach)

**Project:** akaCOVART · live at akacovart.com (Vercel from `main`) · repo `akaieuan/akaCovart`
**Symptom (reported):** On the start page (the landing **before** "Start"), the four animated engine loops — Grid, Blob, Wave, Contours — look like the **old** versions of the engines, not what the studio now produces. Seen on phone.

---

## TL;DR
The start page renders **four hardcoded preset snapshots** in `src/components/intro/Intro.tsx` (`PRESETS`). Those snapshots were tuned against an **earlier version of the engines**. The engines have since been reworked (Contours rework, "fluidity"/motion changes, Auto-colour). The preset **keys are all still valid**, but the **values + seeds** now drive the reworked engines with stale tuning → the loops read "old" vs the studio.

**Fix = re-tune each of the 4 presets from a good *current* studio look.** It's a re-tuning job, not a code migration. Rule out phone caching first.

---

## 0) First, rule out a stale build on the phone (2 min)
"Old" can also just be a cached/old deploy.
- **Vercel:** confirm the latest commit (currently `de14ed2`) is the live Production deploy and the build is green.
- **Phone:** hard-refresh, open in a private tab, or load `akacovart.com/?v=2` to bust cache.
- If a guaranteed-fresh load **still** looks old → it's the presets. Continue below.

---

## 1) Root cause
- File: **`src/components/intro/Intro.tsx`** → `BASE` + `PRESETS` (4 objects: Grid, Blob, Wave, Contours).
- Each preset is a frozen param snapshot rendered live by the real engine:
  `paint()` → `renderTo(canvas, HERO_SIZE, { ...preset.params, _anim:true, _t, _rt })`.
  So **a loop == exactly what the studio outputs for those params + seed.**
- Recent reworks (see `git log`): *"Contours rework"*, *"fluidity + Auto colour"*, *"Contours audio-reactivity + multi-format"*. The presets predate these.
- **Verified:** every key the presets set still exists in the current schema (`controls-config.ts` + `store.ts`). Nothing was renamed/removed. (Contours is now a topographic look: `contourLines`="Ridges", `contourScale`="Terrain scale", `contourRelief`="Height", `contourFlow`="Fly forward".) → This is **re-tuning**, not migration.

---

## 2) How the loops work (architecture)
- `Intro.tsx`: two stacked `<canvas>` cross-dissolve through `PRESETS`; auto-cycles; scroll/arrow/tap to move.
- Square backing buffer `HERO_SIZE` (1080), CSS `object-fit: cover`; `kenBurns()` adds a zoom that's boosted on small screens so the framing matches desktop.
- Registered engines: **`src/engine/engines/index.ts`** → `blob, grid, waves, contours`.
- Param baselines: **`src/lib/store.ts`** (`defaults`). Slider schema per engine: **`src/components/controls/controls-config.ts`** (`COMPOSITION_BY_ENGINE`, `FINISH_GROUP`, `MOTION_BY_ENGINE`).

---

## 3) The fix — re-snapshot each preset from the live studio
Repeat per engine (grid, blob, waves, contours):
1. Run the studio; select the engine.
2. Dial a look that represents the **current** aesthetic (composition + finish + motion). Keep the shared dark/grainy feel from `BASE` (mood `dark`, vignette ~30, bloom ~24, grain ~60).
3. **Capture the values.** Either read them off the control panel + the seed (shown under the canvas), or expose the store for a one-shot copy (dev-only): add `if (typeof window!=='undefined') (window as any).S = useStudio;` in `store.ts`, then in the console run `copy(JSON.stringify(S.getState()))` and pick out the keys below. (Remove the dev line after.)
4. Paste into the matching object in `PRESETS`, keeping `...BASE` and overriding `engine`, `seed`, and **every** key listed below.
5. Re-tune the motion values — the landing auto-animates, so motion should read well on its own.

### Keys to set per engine (current, cross-checked against `controls-config.ts` + `store.ts`)
| Engine | Composition | Motion |
|---|---|---|
| **grid** | `gridCols, gridDensity, gridPerspective, gridMagnet` | `gridRipple, gridBob, gridPop, gridOrbit, gridFlow` |
| **blob** | `density, smear, blobSize, glow, diamonds, diamondCount, diamondSize, diamondShape, accent, accentCount` | `blobFlow, blobSwirl, blobPulse, blobWander, blobMorph` |
| **waves** | `waveCount, waveAmp, waveDetail, waveTurbulence, wavePerspective` | `waveFlow, waveSwell, waveSurge, waveChurn, waveUndulate` |
| **contours** | `contourLines, contourWeight, contourScale, contourDetail, contourWarp, contourRelief` | `contourMorph, contourFlow` |

Shared finish/texture (in `BASE` or per-preset): `soften, glow, contrast, saturation, vignette, bloom, grain, grainSize, dust`.

> **Set every listed key per preset** so nothing silently falls back to a `store.ts` default you didn't intend — that fallback is a likely contributor to the "old" feel (esp. Contours after its rework).

---

## 4) Verify
- The start loop for an engine should look **identical** to the studio with the same engine + seed + params.
- `cd <repo> && pnpm exec tsc --noEmit && pnpm exec next build` — must pass with **no warnings**.
- ⚠️ **Local-dev caveat:** the project lives in iCloud-synced `~/Desktop`, which duplicates `.next` files and corrupts the dev server (blank hero stuck at 300×150, dropped dev servers, `.next/types/* 3.ts` "Duplicate identifier" errors) **while production is fine**. If local looks broken: `find .next -name "* [0-9].ts" -delete` then restart dev. Durable fix: move the repo to e.g. `~/dev/aka-covart`.

---

## 5) Secondary — mobile dock is hard to expand (reach)
- File: **`src/components/studio/MobileControls.tsx`**.
- The dock is `absolute inset-x-0 bottom-0`. Collapsed, the expand chevron sits at the very bottom edge — awkward to reach on a phone (browser UI / home indicator).
- Options: lift it off the bottom (wrapper `bottom-[calc(env(safe-area-inset-bottom)+12px)]` or extra bottom margin), and/or make the collapsed state a taller grab-bar with a bigger, higher tap target for the chevron.

---

## 6) ⚠️ Collision warning
This repo has had a **concurrent editing effort** repeatedly rewriting `Intro.tsx`, `Studio.tsx`, `Controls.tsx`, `controls-config.ts` (file line counts changed mid-session; edits got clobbered). **Re-read each file immediately before editing**, and coordinate ownership of `Intro.tsx` so the preset re-tune isn't overwritten.
