# akaCOVART — Album Art Engine

A generative album-art studio. Four deterministic engines — **Blob**, **Grid**, **Waves**, **Orb** — with palettes, presets, sigils, film grain, type overlay, high-res PNG export, and beat-synced **animation** built around physical, eased motion (no flashing or strobing).

Built by [Ubik Studio](https://ubik.studio). Web app: **Next.js + Tailwind**, with the generative engine as a framework-agnostic module.

## Quick start

```bash
pnpm install
pnpm dev          # http://localhost:3000
```

Other scripts:

```bash
pnpm build        # static export to ./out
pnpm typecheck    # tsc --noEmit
pnpm lint
```

## How it works

- **`src/engine/`** — the generative core. Pure, framework-agnostic canvas code: a typed `FieldEngine` plugin interface + registry, a seeded PRNG (same seed + params ⇒ same image), palettes, a `renderTo` orchestrator, the post/finish chain (bloom, vignette, grain, sigil, type), and the four engine plugins.
- **`src/presets/`** — presets as plain data.
- **`src/components/`, `src/lib/`** — the Next.js studio UI and a Zustand store.

### Engines & motion

Each engine has its own composition params, plus dedicated **MOTION** params for animation that drive *space* (scale, position, displacement) and never brightness/opacity/hue — so beats read as physical movement, not flashing:

- **Orb** — Spin · Wobble · Bounce · Breath · Churn
- **Waves** — Flow · Swell · Surge · Churn · Undulate
- **Grid** — Ripple · Bob · Pop · Orbit · Flow

Beat response is built from eased envelopes and a damped spring (`AnimState` in `src/engine/render.ts`).

## Adding an engine or preset

- **Preset:** add an entry to `src/presets/` (engine + params + optional seed).
- **Engine:** add a module under `src/engine/engines/` implementing `FieldEngine` and calling `registerEngine(...)`; it self-registers and appears in the UI.

Contributions should keep two rules: **deterministic** (derive randomness from the seed via `prng`, never `Math.random()` in the render path) and **flicker-free** (no beat-driven brightness/opacity/hue).

## License

[Apache-2.0](./LICENSE). "akaCOVART" is a trademark of the project owner and is not licensed under Apache-2.0 — see [NOTICE](./NOTICE).
