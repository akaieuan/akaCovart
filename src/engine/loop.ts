// THE SHARED CLIP CLOCK — the one place the resolve-loop / export-clip arithmetic
// lives. render.ts (the live BPM driver), audio/trackMotion.ts (the Track driver),
// lib/export.ts (the frame count of an exported loop) and any engine that rides
// the clip (Oil's bit tide) all call these, so the formulas can never drift apart
// and "one export clip" means the same number of frames everywhere.
//
// Pure arithmetic, no DOM, no state.
//
//   loopBeats  — the resolve loop, in beats (an integer, so the per-beat kick
//                aligns and the loop is seamless); from the Loop slider.
//   cycleSec   — one resolve cycle = loopBeats / bps.
//   clipCycles — how many resolve cycles make one export clip: the integer count
//                closest to CLIP_TARGET_SEC, never 0, so first frame == last.
//   clipPhase  — ψ in [0,1): where `rt` sits inside one clip; 0 at rt = 0 and
//                wraps exactly where the exported loop wraps.

/** Target length of an exported BPM loop, in seconds (rounded to whole cycles). */
export const CLIP_TARGET_SEC = 6;

/** Resolve-loop length in beats from the Loop slider (0..100; null/undefined = 20). */
export function loopBeatsOf(txtLoopBeats?: number | null): number {
  const v = txtLoopBeats == null ? 20 : txtLoopBeats;
  return Math.max(1, Math.round(0.5 + (v / 100) * 7.5));
}

/** Resolve cycles per export clip for a cycle of `cycleSec` seconds (≥ 1). */
export function clipCycles(cycleSec: number): number {
  return Math.max(1, Math.round(CLIP_TARGET_SEC / cycleSec));
}

/** Phase of one export clip at clip time `rt` (seconds), in [0,1). */
export function clipPhaseOf(rt: number, bps: number, loopBeats: number): number {
  return ((rt * bps) / loopBeats / clipCycles(loopBeats / bps)) % 1;
}
