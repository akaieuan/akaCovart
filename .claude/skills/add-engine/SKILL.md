---
name: add-engine
description: Scaffold a new 2D field engine (generator) for akaCOVART. Use when adding a new visual engine alongside Blob/Grid/Waves/Orb, or when the user says "add an engine", "new generator", "new field", or wants a new tab in the engine selector. Encodes the two hard rules (deterministic seed-derived PRNG; flicker-free space-only motion) and the exact files to wire.
---

# Add a 2D field engine to akaCOVART

An engine is a pure function that draws one frame onto a `CanvasRenderingContext2D`.
The same engine powers the live preview, the 3000² PNG export, and the gallery
thumbnails, so it must stay **framework-agnostic** (no React / store imports) and
obey two hard rules.

## The two hard rules (non-negotiable)

1. **Deterministic.** All randomness comes from the seed via `prng(seed ^ <const>)`
   — never `Math.random()`. Same `seed + params` must always reproduce the same
   image, on any machine. Keep the PRNG draw **order** stable: draw the same number
   of values in the same order regardless of param/animation state. Do per-frame
   motion math *after* the seeded draws, not interleaved with them.
2. **Flicker-free.** Gate **all** motion behind `anim.anim`, so the STILL render is
   byte-identical to a baked frame. Beat energy (`kickEnv`, `kickSpring`, `pumpEnv`)
   and `drift`/`swirl`/`speed` may only move **space** — scale, position,
   displacement, radius. **Never** modulate brightness, opacity, or hue with time
   or the beat.

The canonical reference implementation is `src/engine/engines/blob.ts`. Read it
before writing a new engine — it shows the seed-stream pattern, the `ANIM` gate,
and how dedicated `group: "motion"` params ride along with the global beat.

## Contract

```ts
interface FieldEngine {
  id: string;          // unique, e.g. "ribbons"
  label: string;       // human label for the tab, e.g. "Ribbons"
  kind: "2d";          // 2D canvas engine
  params: ParamDef[];  // declarative param list (the in-engine contract)
  field(args: FieldArgs): void; // draws ONE frame onto args.ctx
}
// FieldArgs = { ctx, size, params, mood, cfg, seed, anim }
```

`cfg` is the resolved `Palette` (use `cfg.base`, `cfg.colors`, etc. — never hardcode
colors). `anim` is the eased `AnimState` from `buildAnim` (see `src/engine/render.ts`).

## Scaffold

Create `src/engine/engines/<id>.ts`:

```ts
import type { FieldArgs, FieldEngine, ParamDef, RNG } from "../types";
import { registerEngine } from "../registry";
import { prng } from "../prng";
import { rgba } from "../color";

const myengine: FieldEngine = {
  id: "myengine",
  label: "My Engine",
  kind: "2d",
  params: myParams(),
  field(args: FieldArgs): void {
    const { ctx, size: S, params: p, mood, cfg, seed, anim } = args;

    // (1) DETERMINISTIC: named seed streams. Draw these in a STABLE order.
    const r: RNG = prng(seed ^ 0x9e3779b1);

    // (2) FLICKER-FREE: gate motion behind ANIM; energy moves space only.
    const ANIM = anim.anim;
    const T = ANIM ? anim.t : 0;          // continuous time
    const kick = anim.kickEnv;            // calm attack-decay pulse
    const spring = anim.kickSpring;       // signed damped bounce
    const flow = ANIM ? (p.myFlow == null ? 50 : p.myFlow) / 100 : 0;

    // (3) Composition params: 0..100 with null-coalescing defaults.
    const amount = (p.myAmount == null ? 50 : p.myAmount) / 100;

    // draw onto ctx using cfg.colors / cfg.base and r() for layout.
    // beat/flow may scale/translate marks — never change their alpha/hue.
    void mood; void S; void T; void kick; void spring; void flow; void amount; void rgba;
  },
};

function myParams(): ParamDef[] {
  return [
    { key: "myAmount", label: "AMOUNT", type: "range", group: "composition", min: 0, max: 100, default: 50 },
    { key: "myFlow",   label: "FLOW",   type: "range", group: "motion",      min: 0, max: 100, default: 50 },
  ];
}

registerEngine(myengine);
export default myengine;
```

## Wiring checklist (the UI is data-driven — these are required)

The engine's own `params` array is the in-module contract, but the studio UI and
defaults are **not** auto-derived from it. To make a new engine show up with
working controls, touch these files:

1. **`src/engine/engines/index.ts`** — add `import "./<id>";` (triggers
   `registerEngine`). This alone makes it render and appear in the engine selector.
2. **`src/lib/store.ts`** — add a default value for **every** param key to the
   `defaults` object (e.g. `myAmount: 50, myFlow: 50`). Sliders read/write the store;
   without defaults they have no initial value and won't pass through `renderParams`.
3. **`src/components/controls/controls-config.ts`** — add
   `COMPOSITION_BY_ENGINE["<id>"]` (the still-mode sliders) and, for animated
   motion, `MOTION_BY_ENGINE["<id>"]` (the ANIMATE-mode sliders). Without these the
   engine renders but exposes no controls.
4. **`src/components/studio/EngineSelector.tsx`** — *optional*: add an entry to
   `ENGINE_DEFS` to give the tab a lucide icon. Omit and it falls back to a `Circle`.

## Verify

```bash
pnpm exec tsc --noEmit && pnpm exec next build   # must pass with NO warnings
```

Then in the studio: switch to the new tab, confirm the sliders move the art, and
confirm STILL mode is calm/stable (no flicker) while ANIMATE moves only in space.
