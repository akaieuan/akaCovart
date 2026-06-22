// File -> AudioBuffer + downsampled peaks for the waveform display.

const PEAK_BARS = 2000;

let _ctx: AudioContext | null = null;
// A shared AudioContext for decode + transport. Created lazily (must be after a
// user gesture in some browsers, but decodeAudioData itself is fine pre-gesture).
export function audioCtx(): AudioContext {
  if (!_ctx) {
    const Ctor =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext })
        .webkitAudioContext;
    _ctx = new Ctor();
  }
  return _ctx;
}

// Build a ~2000-bar peaks array: max abs amplitude per bucket, mono-mixed.
// Deterministic (no randomness) so the waveform is stable for a given file.
function buildPeaks(buffer: AudioBuffer, bars = PEAK_BARS): Float32Array {
  const len = buffer.length;
  const ch = buffer.numberOfChannels;
  const peaks = new Float32Array(bars);
  if (len === 0) return peaks;
  const bucket = len / bars;
  const channels: Float32Array[] = [];
  for (let c = 0; c < ch; c++) channels.push(buffer.getChannelData(c));

  for (let b = 0; b < bars; b++) {
    const start = Math.floor(b * bucket);
    const end = Math.min(len, Math.floor((b + 1) * bucket));
    let max = 0;
    for (let i = start; i < end; i++) {
      let s = 0;
      for (let c = 0; c < ch; c++) s += channels[c][i];
      s /= ch;
      const a = s < 0 ? -s : s;
      if (a > max) max = a;
    }
    peaks[b] = max;
  }

  // Normalize peaks so the tallest bar is 1 (display only; analysis is separate).
  let gmax = 0;
  for (let b = 0; b < bars; b++) if (peaks[b] > gmax) gmax = peaks[b];
  if (gmax > 1e-6) {
    for (let b = 0; b < bars; b++) peaks[b] /= gmax;
  }
  return peaks;
}

export async function decodeFile(
  file: File,
): Promise<{ buffer: AudioBuffer; peaks: Float32Array }> {
  const arrayBuf = await file.arrayBuffer();
  const ctx = audioCtx();
  // decodeAudioData with a copy (some browsers detach the input ArrayBuffer).
  const buffer = await ctx.decodeAudioData(arrayBuf.slice(0));
  const peaks = buildPeaks(buffer);
  return { buffer, peaks };
}
