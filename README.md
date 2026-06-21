# akaCOVART — Album Art Engine

> A generative album-art studio built around four deterministic field engines, physical beat-synced motion, and high-res export.

**akaCOVART** (working name **akaTOOL**) is a browser-based studio for generating album art. You pick a field engine, give it a seed, and shape the result with palettes, composition controls, film texture, sigil marks, and a type overlay — then export a 3000×3000 PNG or a looping video. Every image is deterministic: the same seed and parameters always produce the same artwork, so a result you like is always reproducible and shareable as data.

It is aimed at musicians, labels, and designers who want distinctive cover art fast, and at developers who want a clean, framework-agnostic generative engine to build on. Built by [Ubik Studio](https://ubik.studio) as a single Next.js + Tailwind app, with the generative core isolated as a pure module under `src/engine`.

---

## Highlights

- **Four field engines** — **Blob**, **Grid**, **Waves**, and **Orb**, each a self-contained generator with its own composition and motion parameters.
- **Deterministic, seeded output** — a seeded mulberry32 PRNG means `same seed + same params ⇒ same image`, every time, on every machine.
- **Palettes & moods** — three hand-tuned palettes (`dark`, `cream`, `grey`) plus a seed-derived `random` mood.
- **Presets** — eight curated starting points: VOID, RITUAL, ASH, BLEACH, TOXIC, STATIC, OBSIDIAN, HAZE.
- **Variations gallery** — a 9-up grid of seed variations you can reroll and click to adopt.
- **Sigil marks & barbed frame** — generative occult-style glyphs and an optional barbed border.
- **Film finish** — film grain, dust/specks, and scratch lines for a printed, physical feel.
- **Type overlay** — title/artist text with case modes, a distort/glitch slider, color modes, and drag-to-place positioning on the canvas.
- **High-res PNG export** — renders offscreen at **3000×3000** independent of the on-screen preview size.
- **Beat-synced, flicker-free animation** — motion driven by an eased beat model that moves *space* only (scale, position, displacement) and never brightness, opacity, or hue.
- **Static-export SPA** — ships as a fully static site (`next build` → `out/`), deployable to any static host.

---

## Quick start

### Prerequisites

- **Node** `22` (see [`.nvmrc`](./.nvmrc))
- **pnpm** (recommended package manager)

```bash
nvm use            # picks up Node 22 from .nvmrc
pnpm install
```

### Develop

```bash
pnpm dev           # http://localhost:3000
```

### Build (static export)

```bash
pnpm build         # static export to ./out
```

`next.config.ts` sets `output: "export"`, so `pnpm build` emits a self-contained static site in `out/` — no Node server required at runtime.

### Other scripts

| Script | Command | What it does |
| --- | --- | --- |
| `pnpm dev` | `next dev` | Dev server at `localhost:3000` |
| `pnpm build` | `next build` | Production build + static export to `out/` |
| `pnpm start` | `next start` | Serve a non-exported production build |
| `pnpm lint` | `next lint` | ESLint over the project |
| `pnpm typecheck` | `tsc --noEmit` | TypeScript type-check, no emit |

---

## Usage walkthrough

1. **Choose an engine.** The tabs at the top of the control panel switch between **BLOB**, **GRID**, **WAVE**, and **ORB**. The composition controls below update to match the active engine.
2. **Seed & generate.** Type a seed directly, or hit **↻ GENERATE** for a fresh random one. The seed is the single source of truth for the random layout — same seed, same image.
3. **Variations gallery.** Under **STARTING POINTS** a 9-up gallery renders the current settings across nine alternate seeds. Click one to adopt its seed; reroll to get a new set.
4. **Presets.** Also under **STARTING POINTS** — eight one-click looks that load a full set of mood + composition + finish + texture + sigil values and a fresh gallery.
5. **Palette / mood.** Pick `DARK`, `CREAM`, `GREY`, or `RANDOM` (mood is then derived deterministically from the seed).
6. **Composition.** Engine-specific controls (e.g. blob density and smear, grid columns, wave amplitude, orb softness) plus a shared **FINISH** group (contrast, saturation, vignette, bloom, soften).
7. **Texture, sigil, type.** Add film grain / dust / scratches, toggle sigil marks and the barbed frame, and set the title/artist overlay — including case, distort/glitch, color mode, and position. You can drag the text directly on the canvas or use the 3×3 position grid.
8. **STILL vs ANIMATE.** The footer toggles between **STILL** and **ANIMATE**. Animate mode reveals **BEAT**, **DRIFT**, and (for Grid/Waves/Orb) **MOTION** control groups.
9. **Export.**
   - In **STILL** mode the primary button is **DOWNLOAD PNG · 3000²** — it renders a fresh 3000×3000 canvas offscreen and downloads it as `albumart_<mood>_<seed>.png`.
   - In **ANIMATE** mode the button becomes **EXPORT VIDEO LOOP** — it records the live animated canvas via `MediaRecorder` (MP4 where the browser supports it, otherwise WEBM) and downloads `akacovart_<seed>.<ext>`.

---

## Architecture / how it works

### The `src/engine` module boundary

`src/engine` is the generative core. It is **pure, framework-agnostic canvas code** — no React, no Next.js, no store imports. Everything it needs arrives through function arguments, and its only output is pixels drawn onto a `CanvasRenderingContext2D`. This boundary is what lets the same engine power the live preview, the offscreen 3000² export, and the gallery thumbnails without modification.

The module's public surface is re-exported from [`src/engine/index.ts`](./src/engine/index.ts): the type definitions, the engine registry, the PRNG, the palettes, color helpers, shared params, the finish effects, and the `renderTo` orchestrator. Importing the module also self-registers the four built-in engines.

### The `FieldEngine` plugin interface + registry

Every engine implements the `FieldEngine` interface from [`src/engine/types.ts`](./src/engine/types.ts):

```ts
interface FieldEngine {
  id: string;          // "blob" | "grid" | "waves" | "orb"
  label: string;       // human label
  kind: "2d";
  params: ParamDef[];  // declarative parameter list (drives defaults & UI)
  field(args: FieldArgs): void; // draws the field onto the canvas
}
```

Engines call `registerEngine(...)` at module load and are looked up by id at render time:

```ts
registerEngine(blob);            // self-registration on import
const engine = getEngine("blob"); // resolved inside renderTo
listEngines();                    // used by the UI to build engine tabs
```

The registry is a simple `Map<string, FieldEngine>` ([`src/engine/registry.ts`](./src/engine/registry.ts)). Because the UI builds its engine tabs from `listEngines()`, a newly registered engine appears in the studio automatically.

### Deterministic PRNG

Randomness comes from a seeded mulberry32 generator ([`src/engine/prng.ts`](./src/engine/prng.ts)). The render path **never** calls `Math.random()` — instead each engine derives independent, named random streams by XOR-ing the seed with a per-stream constant, e.g. `prng(seed ^ 0x9e3779b1)`. The finish effects do the same (`prng(seed ^ 0x2c1b3d77)` for scratches, `prng(seed ^ 0x53a7f0d3)` for sigils, etc.). This is the determinism guarantee: **same seed + same params ⇒ identical image**, on any device.

### Mood resolution & palettes

`resolveMood(seed, mood)` ([`src/engine/palettes.ts`](./src/engine/palettes.ts)) returns the concrete `Mood` — when `mood` is `random`, it picks `dark` / `cream` / `grey` deterministically from the seed, so "random" is still reproducible. Each palette is a rich `Palette` record: base color, color/diamond/accent/marker color sets, fleck and smoke tones, scratch color, and per-mood layout constants (blob count, radius and alpha ranges, diamond alpha, and a couple of compositional flags).

### The `renderTo` orchestrator and finish chain

[`src/engine/render.ts`](./src/engine/render.ts) exposes `renderTo(canvas, size, params)`. It:

1. Resolves the seed, mood, palette, and (when animating) builds the eased `AnimState`.
2. Fills the base color and dispatches to the active engine's `field(...)`.
3. Runs the **finish chain in a fixed order**:

   ```
   soften → scratches → drawSigil → postColor → bloom → vignette → grain → drawText
   ```

   `postColor` (contrast/saturation) is baked when rendering a still, or when an animation bake/export is requested, but skipped on live animation frames so it never strobes. The chain deliberately **omits** any flicker overlay, strobe, pump-darken, or hue-cycle.

### UI layer — `src/components` + `src/lib`

The studio UI is a thin React/Next.js layer over the engine. State lives in a single flat **Zustand** store ([`src/lib/store.ts`](./src/lib/store.ts)) — a bag of generation params plus UI flags whose keys match exactly what the engine reads. `renderParams(state)` strips the action functions and hands the rest straight to `renderTo`. `src/components` holds the canvas stage, control panel, gallery, and small UI primitives; `src/lib/export.ts` handles PNG and video export.

### Project tree

```
.
├── next.config.ts            # output: "export" (static SPA)
├── package.json
├── .nvmrc                    # Node 22
├── LICENSE                   # Apache-2.0
├── NOTICE                    # trademark notice
└── src
    ├── app
    │   ├── globals.css
    │   ├── layout.tsx
    │   └── page.tsx
    ├── components
    │   ├── CanvasStage.tsx   # live preview canvas + drag-to-place text
    │   ├── ControlPanel.tsx  # all control groups (still + animate)
    │   ├── Gallery.tsx       # 9-up seed variations
    │   ├── Studio.tsx        # top-level layout + export wiring
    │   └── primitives.tsx    # Slider / Toggle / Segmented / Section …
    ├── lib
    │   ├── export.ts         # PNG (3000²) + video (MediaRecorder)
    │   └── store.ts          # Zustand store + defaults + renderParams
    ├── presets
    │   └── index.ts          # eight curated presets (data only)
    └── engine                # ── framework-agnostic generative core ──
        ├── index.ts          # public API barrel + engine self-register
        ├── types.ts          # FieldEngine, ParamDef, Palette, AnimState …
        ├── registry.ts       # registerEngine / getEngine / listEngines
        ├── prng.ts           # seeded mulberry32
        ├── palettes.ts       # palettes + resolveMood
        ├── color.ts          # rgb / rgba helpers
        ├── sharedParams.ts   # mood + finish + texture + sigil + type params
        ├── render.ts         # renderTo orchestrator + AnimState builder
        ├── effects           # the finish chain
        │   ├── index.ts
        │   ├── soften.ts
        │   ├── scratches.ts
        │   ├── sigil.ts
        │   ├── postColor.ts
        │   ├── bloom.ts
        │   ├── vignette.ts
        │   ├── grain.ts
        │   └── text.ts
        └── engines           # the four field engines
            ├── index.ts
            ├── blob.ts
            ├── grid.ts
            ├── waves.ts
            └── orb.ts
```

---

## Engines & parameters

All slider/range params are `0–100` unless noted. Defaults below come directly from each engine's `params` definition.

### Blob

Soft, painterly clouds of color with optional "diamond zones" and edge accent streaks, blurred together. The Blob engine has no dedicated MOTION group — in animate mode it responds to the shared **DRIFT** controls and the beat envelope (drift/swirl wander its blobs through space, `kickEnv` pulses blob radius).

| Key | Label | Type | Default | Description |
| --- | --- | --- | --- | --- |
| `density` | BLOB DENSITY | range | 60 | How many blobs are painted |
| `smear` | SMEAR / BLUR | range | 45 | Overall blur applied to the blob layer |
| `blobSize` | BLOB SIZE | range | 50 | Base blob radius scale |
| `glow` | GLOW | range | 55 | Blob opacity / luminance factor |
| `diamonds` | DIAMOND ZONES | toggle | `true` | Enables clipped diamond-shaped detail zones |
| `diamondCount` | COUNT | int (0–4) | 2 | Number of diamond zones |
| `diamondSize` | SIZE | range | 50 | Diamond zone size |
| `diamondShape` | SHAPE WIDE–TALL | range | 50 | Diamond aspect, wide ↔ tall |
| `accent` | INTENSITY | range | 60 | Strength of edge accent streaks |
| `accentCount` | COUNT | int (0–4) | 2 | Number of accent streaks |

### Grid

A field of organic blob-cells laid out on a grid, with optional 3D perspective and a magnet/scatter attractor. Motion is a physical, TouchDesigner-style model.

**Composition**

| Key | Label | Type | Default | Description |
| --- | --- | --- | --- | --- |
| `gridCols` | COLUMNS | int (3–18) | 9 | Grid resolution (columns = rows) |
| `gridDensity` | FILL DENSITY | range | 55 | Probability each cell is filled |
| `gridPerspective` | 3D PLANE | range | 0 | Tilts the grid into a receding plane |
| `gridMagnet` | MAGNET · SCATTER | range | 0 | Strength of the attractor pull + scatter |

**Motion** (animate mode)

| Key | Label | Default | Description |
| --- | --- | --- | --- |
| `gridRipple` | RIPPLE | 45 | Wave propagating outward from center — displaces cell scale + radial position |
| `gridBob` | BOB | 40 | Per-cell positional oscillation |
| `gridPop` | POP | 55 | Springy beat scale pop (signed overshoot via `kickSpring`) |
| `gridOrbit` | ORBIT | 35 | Magnet attractor orbits the center; its pull breathes with `pumpEnv` |
| `gridFlow` | FLOW | 30 | Directional traveling shear across the field |

### Waves

Stacked line waves built from layered sine components plus a turbulence layer, with optional perspective.

**Composition**

| Key | Label | Type | Default | Description |
| --- | --- | --- | --- | --- |
| `waveCount` | LINES | int (10–160) | 60 | Number of wave lines |
| `waveAmp` | AMPLITUDE | range | 50 | Wave height |
| `waveDetail` | DETAIL | range | 45 | Spatial frequency of the body waves |
| `waveTurbulence` | TURBULENCE | range | 25 | Strength of the high-frequency layer |
| `wavePerspective` | PERSPECTIVE | range | 0 | Foreshortens lines toward the horizon |

**Motion** (animate mode)

| Key | Label | Default | Description |
| --- | --- | --- | --- |
| `waveFlow` | FLOW | 50 | Traveling wave — crests scroll horizontally |
| `waveSwell` | SWELL | 40 | Slow global amplitude breathing (LFO) |
| `waveSurge` | SURGE | 55 | Bouncy beat amplitude pulse via `kickSpring` |
| `waveChurn` | CHURN | 40 | Turbulence layer animates faster |
| `waveUndulate` | UNDULATE | 45 | Vertical baseline cross-drift |

### Orb

A single melted, shaded sphere with a halftone dot field. Halftone is static (no per-frame shimmer); motion moves the orb through space only.

**Composition**

| Key | Label | Type | Default | Description |
| --- | --- | --- | --- | --- |
| `orbSize` | ORB SIZE | range | 55 | Orb radius |
| `orbSoft` | SOFTNESS | range | 55 | Edge blur |
| `orbHalftone` | HALFTONE | range | 40 | Halftone dot coverage |
| `orbMelt` | MELT | range | 30 | Surface warp / drip distortion |
| `orbShade` | 3D SHADE | range | 55 | Highlight + shadow shading depth |

**Motion** (animate mode)

| Key | Label | Default | Description |
| --- | --- | --- | --- |
| `orbSpin` | SPIN | 25 | Slow rotation of the warp phases + halftone sampling |
| `orbWobble` | WOBBLE | 40 | Jelly surface — LFO + `kickSpring` drive the warp amplitude |
| `orbBounce` | BOUNCE | 50 | Squash-and-stretch on the kick (stretch X / squash Y) |
| `orbBreath` | BREATH | 35 | Radius LFO + `pumpEnv` breathing |
| `orbChurn` | CHURN | 45 | Speed of the warp sine terms |

### Shared FINISH / TEXTURE / SIGIL / TYPE params

These apply across all engines (defined in [`src/engine/sharedParams.ts`](./src/engine/sharedParams.ts)).

**Palette**

| Key | Label | Type | Default | Options |
| --- | --- | --- | --- | --- |
| `mood` | MOOD | select | `random` | `dark`, `cream`, `grey`, `random` |

**Finish**

| Key | Label | Type | Default | Description |
| --- | --- | --- | --- | --- |
| `contrast` | CONTRAST | range | 50 | Post contrast (baked on still/export) |
| `saturation` | SATURATION | range | 50 | Post saturation (baked on still/export) |
| `vignette` | VIGNETTE | range | 28 | Edge darkening |
| `bloom` | BLOOM | range | 22 | Soft highlight bloom |
| `soften` | SOFTEN · BLUR | range | 0 | Whole-image soft blur |

**Texture**

| Key | Label | Type | Default | Description |
| --- | --- | --- | --- | --- |
| `grain` | FILM GRAIN | range | 60 | Film grain amount |
| `grainSize` | GRAIN SIZE | range | 50 | Grain particle size |
| `dust` | DUST / SPECKS | range | 18 | Dust specks |
| `scratches` | SCRATCH LINES | toggle | `true` | Enable scratch lines |
| `scratchCount` | COUNT | int (0–16) | 6 | Number of scratches |

**Sigil**

| Key | Label | Type | Default | Description |
| --- | --- | --- | --- | --- |
| `sigilMarks` | SIGIL MARKS | toggle | `true` | Enable sigil glyphs |
| `sigilMarkCount` | DENSITY | int (0–20) | 5 | Number of marks |
| `sigilMarkSize` | SIZE | range | 42 | Mark size |
| `sigilMarkScatter` | SCATTER | range | 58 | Mark placement spread |
| `sigilFrame` | BARB FRAME | toggle | `false` | Enable barbed border frame |
| `sigilFrameDensity` | FRAME DENSITY | range | 50 | Barb density along the frame |

**Type overlay**

| Key | Label | Type | Default | Options / Description |
| --- | --- | --- | --- | --- |
| `showText` | RENDER TEXT | toggle | `true` | Draw the title/artist overlay |
| `title` | TITLE | text | `UNTITLED` | Title text |
| `artist` | ARTIST | text | `V/A` | Artist text |
| `textCase` | CASE | select | `upper` | `upper`, `lower`, `asis` (As-Is), `manic` (ManIC) |
| `distort` | DISTORT / GLITCH | range | 0 | Type glitch / displacement |
| `textColor` | COLOR | select | `auto` | `auto`, `light`, `dark` |

Text position (`textX`, `textY`, `textAlign`) is set via the 3×3 position grid or by dragging the text directly on the canvas.

---

## Animation system

### No-flicker philosophy

The single hard rule of the animation system: **beat energy drives space only** — scale, position, displacement, and radius — and **never** brightness, opacity, or hue. There is no strobe, no flash, no per-frame hue cycle, no pump-darken. Beats read as physical movement (a pump, a bounce, a ripple), which is comfortable to watch on loop and safe for photosensitive viewers. The `postColor` (contrast/saturation) pass is even skipped on live animation frames and only baked for stills/exports, so color grading can't shimmer.

### Eased `AnimState` primitives

When animating, `buildAnim` in [`src/engine/render.ts`](./src/engine/render.ts) constructs an `AnimState` of eased, continuous values from the BPM and the kick/pump sliders. Engines read these and apply them to geometry:

- **`beat`** — a continuous beat phase in `[0, 1)`, wrapping each beat (`(rt * bpm/60) % 1`).
- **`kickEnv`** — a smooth attack-decay impulse, `kick · (1 − beat)^3.4`. A calm pulse that peaks on the beat and eases out.
- **`kickSpring`** — a **signed** damped bounce, `kick · e^(−3.2·beat) · cos(2π · 1.6 · beat)`. It overshoots then settles, giving springy pops.
- **`pumpEnv`** — a breathing envelope, `pump · (1 − beat)^2.0`.

Alongside these the state carries `drift`, `swirl`, `speed`, and timing (`t`, `rt`). When not animating, every energy term is zero, so the still render is perfectly calm and identical to a baked frame.

### Control groups

In **ANIMATE** mode the panel exposes:

- **BEAT** — `BPM` (90–160, default 128), `PUMP`, `KICK`. These feed the envelopes above.
- **DRIFT** — `SPEED`, `WANDER` (drift), `SWIRL`. Slow, continuous, engine-agnostic motion.
- **MOTION** — the per-engine physical parameters listed in the engine tables above (Grid/Waves/Orb only; Blob uses BEAT + DRIFT).

---

## Extending

### Add a preset

Presets are plain data in [`src/presets/index.ts`](./src/presets/index.ts). Add an entry to the `presets` array:

```ts
{
  name: "MY LOOK",
  engine: "orb",            // optional; defaults to the current engine
  params: { mood: "dark", orbSize: 70, glow: 80, grain: 50 /* … */ },
  seed: 12345,              // optional; omit for a random seed on click
}
```

It appears in the **PRESETS** grid automatically. A preset only needs to set the params it cares about; everything else stays at the current value.

### Add an engine

1. Create `src/engine/engines/<your-engine>.ts`.
2. Implement the `FieldEngine` interface — give it an `id`, a `label`, a declarative `params: ParamDef[]`, and a `field(args)` that draws onto `args.ctx`.
3. Call `registerEngine(yourEngine)` at the bottom of the file, and import it from `src/engine/engines/index.ts`.

It self-registers on import and, because the control panel builds its tabs from `listEngines()`, it shows up in the studio with no further wiring.

### Contribution rules

Two rules keep the engine coherent:

1. **Deterministic** — derive all randomness from `prng(seed ^ <const>)`. Never call `Math.random()` in the render path. Same seed + params must always reproduce the same image.
2. **Flicker-free** — no beat-driven brightness, opacity, or hue. Beat energy (`kickEnv`, `kickSpring`, `pumpEnv`) may only move space (scale, position, displacement, radius).

---

## Tech stack

| Layer | Choice | Version |
| --- | --- | --- |
| Framework | Next.js (App Router, static export) | `^15.5.4` |
| UI | React | `^19.0.0` |
| Styling | Tailwind CSS | `^4.1.16` |
| State | Zustand | `^5.0.8` |
| Language | TypeScript | `^5.9.3` |
| Generative core | Plain Canvas 2D (no runtime deps) | — |

---

## Roadmap

All of the following are **planned**, not yet shipped:

- **WebGL / Three.js physical engines** — a `react-three-fiber` engine tier with TouchDesigner-style physical simulation at its core (true 3D fields, GPU shaders), alongside the existing 2D engines.
- **Live deploy + shareable permalinks** — a hosted instance plus permalinks that encode seed + params, so any image can be reopened and re-edited from a URL.
- **Claude-native extensibility** — skills / MCP / params-as-data so others can build engines, presets, and looks on top of akaCOVART through Claude.

---

## Contributing

Contributions are welcome. New engines and presets should follow the two contribution rules above (**deterministic** and **flicker-free**). Keep the `src/engine` module free of React and framework imports — it must stay pure canvas code. Run `pnpm typecheck` and `pnpm lint` before opening a PR.

## License

Licensed under [Apache-2.0](./LICENSE).

**Trademark:** "akaCOVART" and "akaTOOL" are trademarks of the project owner and are **not** licensed under Apache-2.0. The source license does not grant rights to use these names, marks, or logos except as required for reasonable and customary use in describing the origin of the work. See [NOTICE](./NOTICE) for details.
