import { FFT } from "./fft";
import type { FeatureArrays } from "./features";

// Pure, deterministic offline analysis. No Math.random, no DOM, no AudioContext.
// Operates on a mono Float32 PCM slice (the clip window) at a known sampleRate.
// Returns typed Float32Arrays of per-hop features, each normalized to ~0..1 and
// envelope-smoothed so they're buttery to sample.
//
// Designed to be called either from a Web Worker or from the main thread in
// chunks (it loops frame-by-frame and reports progress through `onProgress`).

const FFT_SIZE = 2048; // window length for spectral analysis
const HOP_HZ = 100; // ~10 ms hop -> 100 frames/sec feature timeline

// Frequency band edges in Hz.
const BASS_MAX = 160;
const MID_MAX = 2000;
const HIGH_MAX = 8000;

// Hann window, precomputed once per call (deterministic).
function hann(n: number): Float32Array {
  const w = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    w[i] = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (n - 1));
  }
  return w;
}

// One-pole envelope follower (attack/release) over a Float32Array, in place.
// attack/release are smoothing coefficients in seconds; dt is hop period.
function envelopeFollow(
  arr: Float32Array,
  dt: number,
  attackSec: number,
  releaseSec: number,
): void {
  const aA = Math.exp(-dt / Math.max(1e-4, attackSec));
  const aR = Math.exp(-dt / Math.max(1e-4, releaseSec));
  let y = arr.length ? arr[0] : 0;
  for (let i = 0; i < arr.length; i++) {
    const x = arr[i];
    const a = x > y ? aA : aR;
    y = a * y + (1 - a) * x;
    arr[i] = y;
  }
}

// Normalize to ~0..1 using a robust high percentile (so a single transient
// doesn't crush everything). Deterministic: percentile via sorted copy.
function normalizeRobust(arr: Float32Array, pct = 0.98): void {
  const n = arr.length;
  if (n === 0) return;
  const copy = Float32Array.from(arr);
  copy.sort();
  let ref = copy[Math.min(n - 1, Math.floor(pct * (n - 1)))];
  if (ref <= 1e-9) ref = 1e-9;
  for (let i = 0; i < n; i++) {
    let v = arr[i] / ref;
    if (v < 0) v = 0;
    if (v > 1) v = 1;
    arr[i] = v;
  }
}

export interface AnalyzeInput {
  mono: Float32Array; // clip PCM, mono-mixed
  sampleRate: number;
  clipDuration: number; // seconds (mono.length / sampleRate, passed for clarity)
}

export function analyzeMono(
  input: AnalyzeInput,
  onProgress?: (p: number) => void,
): FeatureArrays {
  const { mono, sampleRate } = input;
  const hopSamples = Math.max(1, Math.round(sampleRate / HOP_HZ));
  const dt = hopSamples / sampleRate;
  const frames = Math.max(0, Math.floor((mono.length - FFT_SIZE) / hopSamples) + 1);

  const energy = new Float32Array(Math.max(frames, 0));
  const bass = new Float32Array(Math.max(frames, 0));
  const mid = new Float32Array(Math.max(frames, 0));
  const high = new Float32Array(Math.max(frames, 0));
  const flux = new Float32Array(Math.max(frames, 0));

  if (frames <= 0) {
    return emptyArrays(input.clipDuration);
  }

  const fft = new FFT(FFT_SIZE);
  const win = hann(FFT_SIZE);
  const frameBuf = new Float32Array(FFT_SIZE);
  const magBins = (FFT_SIZE >> 1) + 1;
  const mag = new Float32Array(magBins);
  const prevMag = new Float32Array(magBins);

  // Bin index for a given Hz.
  const hzPerBin = sampleRate / FFT_SIZE;
  const bassBin = Math.min(magBins - 1, Math.max(1, Math.round(BASS_MAX / hzPerBin)));
  const midBin = Math.min(magBins - 1, Math.max(bassBin + 1, Math.round(MID_MAX / hzPerBin)));
  const highBin = Math.min(magBins - 1, Math.max(midBin + 1, Math.round(HIGH_MAX / hzPerBin)));

  let progressTick = 0;

  for (let f = 0; f < frames; f++) {
    const start = f * hopSamples;

    // RMS energy on the raw windowed frame.
    let sumSq = 0;
    for (let i = 0; i < FFT_SIZE; i++) {
      const s = mono[start + i] * win[i];
      frameBuf[i] = s;
      sumSq += s * s;
    }
    energy[f] = Math.sqrt(sumSq / FFT_SIZE);

    fft.magnitudes(frameBuf, mag);

    // Band magnitudes (average magnitude in band).
    let bSum = 0;
    for (let i = 1; i <= bassBin; i++) bSum += mag[i];
    bass[f] = bSum / Math.max(1, bassBin);

    let mSum = 0;
    for (let i = bassBin + 1; i <= midBin; i++) mSum += mag[i];
    mid[f] = mSum / Math.max(1, midBin - bassBin);

    let hSum = 0;
    for (let i = midBin + 1; i <= highBin; i++) hSum += mag[i];
    high[f] = hSum / Math.max(1, highBin - midBin);

    // Spectral flux: half-wave-rectified positive change vs previous frame.
    if (f > 0) {
      let fl = 0;
      for (let i = 1; i < magBins; i++) {
        const d = mag[i] - prevMag[i];
        if (d > 0) fl += d;
      }
      flux[f] = fl;
    }
    prevMag.set(mag);

    // Progress reporting (coarse — ~1%).
    const pct = (f + 1) / frames;
    if (onProgress && pct - progressTick >= 0.01) {
      progressTick = pct;
      onProgress(pct);
    }
  }

  // ── Beat: normalize flux, then a decaying peak-hold so beat is a 0..1 impulse
  normalizeRobust(flux, 0.97);
  const beat = new Float32Array(frames);
  // Decaying peak-hold: rises instantly on a strong onset, decays over ~250ms.
  const decay = Math.exp(-dt / 0.18);
  // Adaptive onset gate: only count flux above a local moving average.
  const avgCoef = Math.exp(-dt / 0.4);
  let movingAvg = 0;
  let hold = 0;
  for (let f = 0; f < frames; f++) {
    movingAvg = avgCoef * movingAvg + (1 - avgCoef) * flux[f];
    const onset = Math.max(0, flux[f] - movingAvg * 1.15);
    hold = Math.max(hold * decay, onset);
    beat[f] = hold;
  }
  // Re-normalize beat so peaks reach ~1.
  normalizeRobust(beat, 0.95);

  // ── Energy / band smoothing + normalization.
  // Attack fast (catch transients), release slow (buttery).
  envelopeFollow(energy, dt, 0.01, 0.12);
  envelopeFollow(bass, dt, 0.01, 0.12);
  envelopeFollow(mid, dt, 0.012, 0.13);
  envelopeFollow(high, dt, 0.012, 0.13);

  normalizeRobust(energy, 0.98);
  normalizeRobust(bass, 0.98);
  normalizeRobust(mid, 0.98);
  normalizeRobust(high, 0.98);

  if (onProgress) onProgress(1);

  return {
    duration: input.clipDuration,
    hopHz: HOP_HZ,
    frames,
    energy,
    bass,
    mid,
    high,
    beat,
  };
}

function emptyArrays(duration: number): FeatureArrays {
  return {
    duration,
    hopHz: HOP_HZ,
    frames: 0,
    energy: new Float32Array(0),
    bass: new Float32Array(0),
    mid: new Float32Array(0),
    high: new Float32Array(0),
    beat: new Float32Array(0),
  };
}

export const ANALYZE_CONST = { FFT_SIZE, HOP_HZ };
