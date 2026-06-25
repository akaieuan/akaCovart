// Shared "grid-with-blur" logo mark — the studio's Grid start-loop distilled to a
// text-free brand mark: a tidy 4×4 field of soft glowing dots. Colours are the
// dark mood palette's cell colours (see src/engine/palettes.ts) so it reads as
// the real engine. Rendered via next/og (Satori) for the OG + apple images; a
// matching hand-blurred SVG (app/icon.svg) is the favicon. No external deps.
import type { ReactElement } from "react";

// Cell colours pulled from palettes.ts `dark.colors`.
const C = {
  white: "214,226,220",
  teal: "104,148,134",
  slate: "150,176,196",
  green: "60,96,78",
  mauve: "186,138,146",
  deep: "40,74,86",
  olive: "150,140,84",
};

type Cell = { c: string; a: number } | null;

// 4×4 arrangement — greens/teals dominant with mauve / slate-blue / olive accents
// and off-white focal highlights; two gaps for organic density (like the engine).
const GRID: Cell[][] = [
  [{ c: C.teal, a: 1 }, { c: C.white, a: 1 }, { c: C.slate, a: 0.82 }, { c: C.green, a: 0.85 }],
  [{ c: C.mauve, a: 0.9 }, null, { c: C.teal, a: 0.8 }, { c: C.white, a: 0.95 }],
  [{ c: C.deep, a: 0.85 }, { c: C.olive, a: 0.85 }, { c: C.white, a: 1 }, { c: C.mauve, a: 0.8 }],
  [{ c: C.white, a: 0.9 }, { c: C.slate, a: 0.85 }, null, { c: C.teal, a: 0.95 }],
];

/** The 4×4 glowing-dot grid, sized to fill a `box`×`box` square. */
export function GridMark({ box }: { box: number }): ReactElement {
  const pad = box * 0.11;
  const cell = (box - pad * 2) / 4;
  const dot = cell * 0.56;
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        width: box,
        height: box,
        padding: pad,
      }}
    >
      {GRID.map((row, ri) => (
        <div key={ri} style={{ display: "flex", flex: 1, width: "100%" }}>
          {row.map((c, ci) => (
            <div
              key={ci}
              style={{
                display: "flex",
                flex: 1,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              {c ? (
                <div
                  style={{
                    width: dot,
                    height: dot,
                    borderRadius: dot,
                    background: `rgba(${c.c},${c.a * 0.9})`,
                    // wide layered halo so neighbouring dots' glows bleed into one
                    // another (conjoined) — the soft blurred field of the loop.
                    boxShadow: `0 0 ${cell * 0.45}px ${cell * 0.14}px rgba(${c.c},${c.a * 0.55}), 0 0 ${cell * 1.05}px ${cell * 0.5}px rgba(${c.c},${c.a * 0.34}), 0 0 ${cell * 1.8}px ${cell * 0.72}px rgba(${c.c},${c.a * 0.18})`,
                  }}
                />
              ) : null}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

export const LOGO_BG = "#08090b";
