// Public audio API + a module-level session singleton.
//
// Non-serializable audio data (AudioBuffer, peaks, timeline) lives HERE — never
// in Zustand. The UI and the render loop both import `audioSession` so they
// share one instance. Zustand only holds serializable mirror state (names,
// status, clip window, intensity) — see src/lib/store.ts.

export type { AudioFeatures, FeatureArrays } from "./features";
export { zeroFeatures } from "./features";
export type { AudioTimeline } from "./timeline";

export { decodeFile, audioCtx } from "./decode";
export { analyzeClip } from "./analyze";
export { transport } from "./transport";

import type { AudioTimeline } from "./timeline";

export interface AudioSession {
  buffer: AudioBuffer | null;
  peaks: Float32Array | null;
  timeline: AudioTimeline | null;
  // The window the timeline was analyzed for (so the loop can verify match).
  clipStart: number;
  clipEnd: number;
}

// Single shared instance.
export const audioSession: AudioSession = {
  buffer: null,
  peaks: null,
  timeline: null,
  clipStart: 0,
  clipEnd: 0,
};

export function resetAudioSession(): void {
  audioSession.buffer = null;
  audioSession.peaks = null;
  audioSession.timeline = null;
  audioSession.clipStart = 0;
  audioSession.clipEnd = 0;
}
