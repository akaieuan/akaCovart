# reference/ — original prototype

These files are the **original single-file 2D prototype** of the Album Art Engine,
kept here for provenance and as the canonical **2D reference** the Next.js studio
was ported from. They are no longer part of the build or runtime.

| File                      | What it is                                                              |
| ------------------------- | ---------------------------------------------------------------------- |
| `index.html`              | The original self-contained studio UI + canvas wiring.                 |
| `support.js`              | The original 2D engine: blob/grid/waves/orb fields, effects, text, export. |
| `server.js`               | The tiny static dev server used to serve the prototype (port 4178).    |
| `Album Art Engine.dc.html`| Design-canvas export / snapshot of the prototype.                      |

## Relationship to the live app

The production studio lives in `../src` (Next.js, `output: "export"`). The engine
under `../src/engine` is the source of truth and was ported from `support.js`,
preserving the exact parameter ranges, defaults, finish-chain order, and the
deterministic `(seed, params) -> image` contract. When in doubt about intended
visual behavior, this prototype is the reference.

The `../uploads/` directory (sample/reference imagery) is intentionally kept at
the repo root, not here.

To run the original prototype: `node reference/server.js` (or the
`album-art-engine` config in `.claude/launch.json`).
