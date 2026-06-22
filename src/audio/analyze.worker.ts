/// <reference lib="webworker" />
import { analyzeMono, type AnalyzeInput } from "./analyzeCore";
import type { FeatureArrays } from "./features";

// Worker protocol:
//   in:  { mono: Float32Array, sampleRate, clipDuration }  (mono is transferred)
//   out: { type:"progress", p } | { type:"done", result }  (result arrays transferred)

type WorkerInMsg = AnalyzeInput;

self.onmessage = (e: MessageEvent<WorkerInMsg>) => {
  const { mono, sampleRate, clipDuration } = e.data;
  const result: FeatureArrays = analyzeMono(
    { mono, sampleRate, clipDuration },
    (p) => {
      (self as unknown as Worker).postMessage({ type: "progress", p });
    },
  );
  (self as unknown as Worker).postMessage({ type: "done", result }, [
    result.energy.buffer,
    result.bass.buffer,
    result.mid.buffer,
    result.high.buffer,
    result.beat.buffer,
  ] as Transferable[]);
};
