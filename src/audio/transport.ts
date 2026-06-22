import { audioCtx } from "./decode";

// Singleton clip player for the chosen window. Plays [clipStart, clipEnd] of an
// AudioBuffer through the shared AudioContext, looping for continuous preview.
//
// currentTime is seconds INTO THE CLIP (0..clipDuration), derived from the
// AudioContext clock so the render loop can sample the feature timeline against
// a precise audio clock (no drift, fps-independent).

interface Transport {
  load(buffer: AudioBuffer, clipStart: number, clipEnd: number): void;
  play(): void;
  pause(): void;
  seek(tInClip: number): void;
  readonly currentTime: number;
  readonly playing: boolean;
  readonly clipDuration: number;
  onEnded(cb: () => void): void;
}

class ClipTransport implements Transport {
  private buffer: AudioBuffer | null = null;
  private clipStart = 0;
  private clipEnd = 0;
  private _clipDuration = 0;

  private source: AudioBufferSourceNode | null = null;
  private gain: GainNode | null = null;

  private _playing = false;
  // Audio-clock anchor: ctx.currentTime at the moment offsetInClip was set.
  private anchorCtxTime = 0;
  private offsetInClip = 0; // clip-relative position at the last anchor
  private endedCbs: (() => void)[] = [];

  get clipDuration(): number {
    return this._clipDuration;
  }

  get playing(): boolean {
    return this._playing;
  }

  // Seconds into the clip, wrapped to the loop length. Driven by the audio clock.
  get currentTime(): number {
    if (this._clipDuration <= 0) return 0;
    if (!this._playing) return clamp(this.offsetInClip, 0, this._clipDuration);
    const ctx = audioCtx();
    const elapsed = ctx.currentTime - this.anchorCtxTime;
    let t = this.offsetInClip + elapsed;
    // Loop wrap.
    t = t % this._clipDuration;
    if (t < 0) t += this._clipDuration;
    return t;
  }

  load(buffer: AudioBuffer, clipStart: number, clipEnd: number): void {
    this.stopSource();
    this.buffer = buffer;
    this.clipStart = Math.max(0, clipStart);
    this.clipEnd = Math.min(buffer.duration, clipEnd);
    this._clipDuration = Math.max(0, this.clipEnd - this.clipStart);
    this.offsetInClip = 0;
    this._playing = false;
  }

  play(): void {
    if (!this.buffer || this._clipDuration <= 0) return;
    if (this._playing) return;
    const ctx = audioCtx();
    if (ctx.state === "suspended") void ctx.resume();
    this.startSource(this.offsetInClip);
    this._playing = true;
  }

  pause(): void {
    if (!this._playing) return;
    // Capture current position before stopping.
    const t = this.currentTime;
    this.stopSource();
    this.offsetInClip = t;
    this._playing = false;
  }

  seek(tInClip: number): void {
    const t = clamp(tInClip, 0, this._clipDuration);
    if (this._playing) {
      this.stopSource();
      this.startSource(t);
    } else {
      this.offsetInClip = t;
    }
  }

  onEnded(cb: () => void): void {
    this.endedCbs.push(cb);
  }

  // ── internals ──────────────────────────────────────────────────────────
  private startSource(offsetInClip: number): void {
    if (!this.buffer) return;
    const ctx = audioCtx();
    const src = ctx.createBufferSource();
    src.buffer = this.buffer;
    src.loop = true;
    src.loopStart = this.clipStart;
    src.loopEnd = this.clipEnd;

    const gain = ctx.createGain();
    gain.gain.value = 1;
    src.connect(gain).connect(ctx.destination);

    // Start playing at clipStart + offset; the loop region keeps it cycling.
    src.start(0, this.clipStart + clamp(offsetInClip, 0, this._clipDuration));

    this.source = src;
    this.gain = gain;
    this.anchorCtxTime = ctx.currentTime;
    this.offsetInClip = clamp(offsetInClip, 0, this._clipDuration);

    // Fire onEnded each time we wrap is NOT desired for a loop; we only notify
    // listeners if the loop is ever disabled. Kept for contract completeness.
    src.onended = () => {
      if (!src.loop) {
        this._playing = false;
        for (const cb of this.endedCbs) cb();
      }
    };
  }

  private stopSource(): void {
    if (this.source) {
      try {
        this.source.onended = null;
        this.source.stop();
      } catch {
        /* already stopped */
      }
      try {
        this.source.disconnect();
      } catch {
        /* noop */
      }
      this.source = null;
    }
    if (this.gain) {
      try {
        this.gain.disconnect();
      } catch {
        /* noop */
      }
      this.gain = null;
    }
  }
}

function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}

export const transport: Transport = new ClipTransport();
