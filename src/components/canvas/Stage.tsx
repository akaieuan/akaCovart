"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Stage — the isolation boundary between the 2D and WebGL render paths.
//
//   • 2D engines (blob/grid/waves/orb): render the existing <CanvasStage>,
//     forwarding canvasRef exactly as before. This path is byte-unchanged.
//   • WebGL engine (orb3d): render <WebGLStage> via next/dynamic { ssr: false }
//     so three / @react-three/fiber never load on the server or during the
//     static-export prerender.
//
// The selected engine is read from the store and resolved against the registry;
// the `kind` discriminator decides the branch. Container styling mirrors
// CanvasStage's canvas-hero section so layout is identical across both paths.
// ─────────────────────────────────────────────────────────────────────────────

import dynamic from "next/dynamic";

import { getEngine, isWebGLEngine } from "@/engine";
import { useStudio } from "@/lib/store";
import CanvasStage from "./CanvasStage";

// Dynamically import the WebGL stage with SSR disabled. three / r3f are reached
// ONLY through this dynamic boundary, so the static export never tries to SSR
// them. A lightweight placeholder keeps the square framed while it loads.
const WebGLStage = dynamic(() => import("./WebGLStage"), {
  ssr: false,
  loading: () => null,
});

export default function Stage({
  canvasRef,
}: {
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
}) {
  const engineId = useStudio((s) => s.engine);
  const seed = useStudio((s) => s.seed);
  const engine = getEngine(engineId);

  // WebGL branch — render the dynamically-imported three stage. Mirror the
  // CanvasStage section + framed square + seed caption so layout is unchanged.
  if (engine && isWebGLEngine(engine)) {
    return (
      <section className="flex min-h-0 min-w-0 flex-1 flex-col items-center justify-center gap-4 overflow-hidden bg-[radial-gradient(circle_at_50%_38%,#121215,#0a0a0b_72%)] px-4 pt-16 pb-44 sm:gap-[18px] sm:px-8 md:py-8">
        <div className="relative aspect-square w-full max-w-[min(82vh,760px)] overflow-hidden bg-black shadow-[0_30px_80px_rgba(0,0,0,0.65),0_0_0_1px_#1c1c20]">
          <WebGLStage />
        </div>
        <div className="font-sans text-[11px] tabular-nums text-grey-400">
          3000 × 3000 px&nbsp;&nbsp;·&nbsp;&nbsp;Seed&nbsp;{seed >>> 0}
        </div>
      </section>
    );
  }

  // 2D branch — unchanged. CanvasStage owns the canvas + all render loops.
  return <CanvasStage canvasRef={canvasRef} />;
}
