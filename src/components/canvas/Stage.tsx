"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Stage — the canvas host. Renders the 2D <CanvasStage>, forwarding canvasRef.
// Kept as a thin, stable mount point for the render surface so the studio layout
// has a single place that owns the canvas.
// ─────────────────────────────────────────────────────────────────────────────

import CanvasStage from "./CanvasStage";

export default function Stage({
  canvasRef,
}: {
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
}) {
  return <CanvasStage canvasRef={canvasRef} />;
}
