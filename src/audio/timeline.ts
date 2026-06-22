import type { AudioFeatures, FeatureArrays } from "./features";

// AudioTimeline: a fixed-hop feature timeline that you sample by time.
// sampleByTime linearly interpolates between hops so motion is smooth at any
// render fps. Sampling is read-only and deterministic.
export interface AudioTimeline {
  duration: number;
  hopHz: number;
  sampleByTime(t: number): AudioFeatures;
}

export function makeTimeline(d: FeatureArrays): AudioTimeline {
  const { duration, hopHz, frames, energy, bass, mid, high, beat } = d;

  function sampleByTime(t: number): AudioFeatures {
    if (frames === 0) {
      return { energy: 0, bass: 0, mid: 0, high: 0, beat: 0 };
    }
    // Position in frame units.
    let x = t * hopHz;
    if (x <= 0) x = 0;
    const maxIdx = frames - 1;
    if (x >= maxIdx) {
      return {
        energy: energy[maxIdx],
        bass: bass[maxIdx],
        mid: mid[maxIdx],
        high: high[maxIdx],
        beat: beat[maxIdx],
      };
    }
    const i0 = x | 0;
    const i1 = i0 + 1;
    const f = x - i0;
    const g = 1 - f;
    return {
      energy: energy[i0] * g + energy[i1] * f,
      bass: bass[i0] * g + bass[i1] * f,
      mid: mid[i0] * g + mid[i1] * f,
      high: high[i0] * g + high[i1] * f,
      // Beat impulses are sharp; interpolating is fine because we keep a
      // decaying peak-hold in the analyzer, so the timeline is already smooth.
      beat: beat[i0] * g + beat[i1] * f,
    };
  }

  return { duration, hopHz, sampleByTime };
}
