---
name: add-preset
description: Add a curated preset ("starting point") to akaCOVART. Use when the user says "add a preset", "save this look", "new starting point", or wants a one-click look in the Starting points panel. Presets are plain data — no UI wiring needed.
---

# Add a preset to akaCOVART

Presets are the one-click looks under **Starting points** in the studio. They are
**plain data** in `src/presets/index.ts` — add an entry to the `presets` array and
it appears automatically (rendered by `src/components/controls/Presets.tsx`).

## Shape

```ts
interface Preset {
  name: string;                  // shown on the chip, e.g. "MIDNIGHT"
  engine?: string;               // optional; "blob" | "grid" | "waves" | "orb"
  params: Record<string, any>;   // PARTIAL — only the keys you want to set
  seed?: number;                 // optional; omit for a fresh random seed on click
}
```

`params` is a **partial** override: set only the keys this look cares about;
everything else keeps the user's current value. Clicking the preset merges
`params` into the store (and switches `engine` if provided).

## Example

```ts
{
  name: "MIDNIGHT",
  engine: "blob",
  params: {
    mood: "dark", density: 40, smear: 60, blobSize: 64, glow: 70,
    contrast: 56, saturation: 44, vignette: 44, bloom: 36,
    diamonds: true, diamondCount: 1, accent: 30, accentCount: 1,
    grain: 56, grainSize: 48, dust: 14, scratches: true, scratchCount: 5,
  },
},
```

## Rules of thumb

- **Use real param keys.** They must match keys in `src/lib/store.ts` `defaults`
  and the engine's params. Browse `src/components/controls/controls-config.ts` for
  the full set per engine (composition + shared finish/texture/type).
- **Skip `sigil*` keys.** Sigils were removed from the render chain — those params
  are dead and have no visible effect (existing presets still list them harmlessly).
- **Easiest workflow:** dial the look in the running studio until you like it, then
  transcribe the values you changed into a new `params` block. Set a `seed` only if
  the exact layout matters; otherwise omit it so each click rerolls.
- Keep `name` short and uppercase to match the existing set (VOID, RITUAL, ASH, …).

## Verify

```bash
pnpm exec tsc --noEmit && pnpm exec next build
```

Then open **Starting points** in the studio and click the new chip — confirm it
loads the intended look.
