// Per-frame audio features. Each value is normalized to roughly 0..1 and
// smoothed offline so it is buttery to sample at render time. `beat` is a
// decaying onset impulse (0..1) — a peak on the beat that eases out.
export interface AudioFeatures {
  energy: number;
  bass: number;
  mid: number;
  high: number;
  beat: number;
}

export function zeroFeatures(): AudioFeatures {
  return { energy: 0, bass: 0, mid: 0, high: 0, beat: 0 };
}

// Serializable payload that crosses the worker boundary and seeds the timeline.
// All arrays are length `frames`, sampled at `hopHz` over `duration` seconds.
export interface FeatureArrays {
  duration: number;
  hopHz: number;
  frames: number;
  energy: Float32Array;
  bass: Float32Array;
  mid: Float32Array;
  high: Float32Array;
  beat: Float32Array;
}
