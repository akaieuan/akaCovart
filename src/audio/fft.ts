// Minimal, deterministic radix-2 FFT (Cooley–Tukey, in-place).
// No Math.random anywhere — same input always yields the same output.
// Size must be a power of two. We operate on real input via two parallel
// Float64 arrays (real/imag) and return magnitudes for the lower half.

export class FFT {
  readonly size: number;
  private readonly cosTable: Float64Array;
  private readonly sinTable: Float64Array;
  private readonly rev: Uint32Array;
  private readonly re: Float64Array;
  private readonly im: Float64Array;

  constructor(size: number) {
    if (size < 2 || (size & (size - 1)) !== 0) {
      throw new Error("FFT size must be a power of two >= 2");
    }
    this.size = size;
    const half = size >> 1;
    this.cosTable = new Float64Array(half);
    this.sinTable = new Float64Array(half);
    for (let i = 0; i < half; i++) {
      const a = (-2 * Math.PI * i) / size;
      this.cosTable[i] = Math.cos(a);
      this.sinTable[i] = Math.sin(a);
    }
    // Bit-reversal permutation table.
    this.rev = new Uint32Array(size);
    let bits = 0;
    while (1 << bits < size) bits++;
    for (let i = 0; i < size; i++) {
      let x = i;
      let r = 0;
      for (let b = 0; b < bits; b++) {
        r = (r << 1) | (x & 1);
        x >>= 1;
      }
      this.rev[i] = r >>> 0;
    }
    this.re = new Float64Array(size);
    this.im = new Float64Array(size);
  }

  // Compute magnitude spectrum (length size/2 + 1) from a real input window.
  // `input` length must equal size; values are copied in (input untouched).
  // `out` (length >= size/2 + 1) receives magnitudes; reused buffer ok.
  magnitudes(input: Float32Array, out: Float32Array): void {
    const n = this.size;
    const re = this.re;
    const im = this.im;
    const rev = this.rev;

    // Load with bit-reversal, imaginary = 0.
    for (let i = 0; i < n; i++) {
      re[i] = input[rev[i]];
      im[i] = 0;
    }

    const cos = this.cosTable;
    const sin = this.sinTable;
    for (let len = 2; len <= n; len <<= 1) {
      const half = len >> 1;
      const step = n / len;
      for (let i = 0; i < n; i += len) {
        let k = 0;
        for (let j = i; j < i + half; j++) {
          const c = cos[k];
          const s = sin[k];
          const tre = re[j + half] * c - im[j + half] * s;
          const tim = re[j + half] * s + im[j + half] * c;
          re[j + half] = re[j] - tre;
          im[j + half] = im[j] - tim;
          re[j] += tre;
          im[j] += tim;
          k += step;
        }
      }
    }

    const bins = (n >> 1) + 1;
    for (let i = 0; i < bins; i++) {
      out[i] = Math.sqrt(re[i] * re[i] + im[i] * im[i]);
    }
  }
}
