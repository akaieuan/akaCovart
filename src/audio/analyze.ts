import { analyzeMono } from "./analyzeCore";
import type { FeatureArrays } from "./features";
import { makeTimeline, type AudioTimeline } from "./timeline";

// Mix an AudioBuffer's [clipStart, clipEnd] window down to a mono Float32Array.
function extractMono(
  buffer: AudioBuffer,
  clipStart: number,
  clipEnd: number,
): { mono: Float32Array; sampleRate: number; clipDuration: number } {
  const sr = buffer.sampleRate;
  const startSample = Math.max(0, Math.floor(clipStart * sr));
  const endSample = Math.min(buffer.length, Math.ceil(clipEnd * sr));
  const len = Math.max(0, endSample - startSample);
  const mono = new Float32Array(len);
  const ch = buffer.numberOfChannels;
  for (let c = 0; c < ch; c++) {
    const data = buffer.getChannelData(c);
    for (let i = 0; i < len; i++) {
      mono[i] += data[startSample + i];
    }
  }
  if (ch > 1) {
    const inv = 1 / ch;
    for (let i = 0; i < len; i++) mono[i] *= inv;
  }
  return { mono, sampleRate: sr, clipDuration: len / sr };
}

// Try to construct the analysis worker. Returns null if worker bundling isn't
// available in this environment (e.g. some static-export edge cases) so the
// caller can fall back to the chunked main-thread path.
function makeWorker(): Worker | null {
  try {
    if (typeof Worker === "undefined") return null;
    return new Worker(new URL("./analyze.worker.ts", import.meta.url), {
      type: "module",
    });
  } catch {
    return null;
  }
}

// Analyze the selected window ONCE, offline, into a feature timeline.
// Prefers a Web Worker; falls back to a chunked main-thread analyzer that
// yields to the event loop and reports progress so the UI never locks up.
export async function analyzeClip(
  buffer: AudioBuffer,
  clipStart: number,
  clipEnd: number,
  onProgress?: (p: number) => void,
): Promise<AudioTimeline> {
  const { mono, sampleRate, clipDuration } = extractMono(buffer, clipStart, clipEnd);

  const worker = makeWorker();
  if (worker) {
    const arrays = await new Promise<FeatureArrays>((resolve, reject) => {
      worker.onmessage = (
        e: MessageEvent<
          { type: "progress"; p: number } | { type: "done"; result: FeatureArrays }
        >,
      ) => {
        const msg = e.data;
        if (msg.type === "progress") {
          onProgress?.(msg.p);
        } else if (msg.type === "done") {
          resolve(msg.result);
        }
      };
      worker.onerror = (err) => reject(err);
      // Transfer the mono buffer to avoid a copy.
      worker.postMessage({ mono, sampleRate, clipDuration }, [mono.buffer]);
    }).finally(() => worker.terminate());
    return makeTimeline(arrays);
  }

  // Fallback: run on main thread but yield once before the heavy loop so the
  // UI can paint the "analyzing" state; analyzeMono reports progress internally.
  await new Promise((r) => setTimeout(r, 0));
  const arrays = analyzeMono({ mono, sampleRate, clipDuration }, onProgress);
  return makeTimeline(arrays);
}
