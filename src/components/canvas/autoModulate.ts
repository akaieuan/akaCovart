// ── AUTO MODE — gentle, bounded, render-loop-only param evolution ────────────
//
// When `store.auto` is on, the render loops call `applyAuto` each frame to wander
// a CURATED set of composition / finish params around their current manual base
// values. Manual sliders remain the base; Auto only adds a slow, eased, BOUNDED
// offset on top of them — it NEVER writes back to the store, so toggling Auto off
// returns to the exact manual look.
//
// Design rules (flicker-free):
//   • Every channel is a slow sine LFO at a distinct low frequency + fixed phase,
//     so the result is deterministic and smooth (no random jitter, no strobing).
//   • Amplitude is a fraction of each param's real [min,max] range, scaled by
//     autoIntensity (0..100). "Brightness-ish" params (glow, contrast, saturation,
//     bloom) use a gentler range fraction and a slower rate so they can't strobe.
//   • In AUDIO mode the per-channel offset is additionally scaled by a smoothed
//     audio feature (energy / bass / mid / high), so the wander reacts to the
//     track without ever touching opacity/hue per-frame.
//   • Each output is clamped to the param's real [min,max].

import type { AudioFeatures } from "@/audio";

// A param bag is the loose record the engine reads (renderParams output).
type ParamBag = Record<string, unknown>;

function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}

// Which smoothed audio feature drives a channel's reactive scale (audio mode).
type Band = "energy" | "bass" | "mid" | "high";

interface AutoChannel {
  key: string;
  min: number;
  max: number;
  // LFO frequency in Hz (cycles/sec). Low = slow wander.
  freq: number;
  // Fixed phase offset (radians) so channels don't move in lock-step.
  phase: number;
  // Fraction of the [min,max] range used as the LFO amplitude at full intensity.
  rangeFrac: number;
  // Audio band that scales this channel's swing in AUDIO mode.
  band: Band;
}

// ── Curated channel table ────────────────────────────────────────────────────
// Ranges mirror src/components/controls/controls-config.ts. Brightness-ish
// finish params (glow, contrast, saturation, bloom) get small rangeFrac + low
// freq so they breathe instead of strobe. Engine-specific channels only matter
// when that engine is active (the others are simply absent from the bag — we
// guard for that).
const CHANNELS: AutoChannel[] = [
  // shared composition — wider swings so the structure visibly evolves
  { key: "density", min: 0, max: 100, freq: 0.037, phase: 0.0, rangeFrac: 0.24, band: "energy" },
  { key: "smear", min: 0, max: 100, freq: 0.029, phase: 1.1, rangeFrac: 0.28, band: "mid" },
  { key: "blobSize", min: 0, max: 100, freq: 0.023, phase: 2.3, rangeFrac: 0.22, band: "bass" },
  { key: "accent", min: 0, max: 100, freq: 0.041, phase: 0.6, rangeFrac: 0.24, band: "high" },
  { key: "diamondShape", min: 0, max: 100, freq: 0.017, phase: 4.4, rangeFrac: 0.20, band: "mid" },
  { key: "diamondSize", min: 0, max: 100, freq: 0.013, phase: 2.7, rangeFrac: 0.20, band: "bass" },

  // TEXTURE — the grit / feel now evolves too (grain density, size, dust, blur)
  { key: "grain", min: 0, max: 100, freq: 0.035, phase: 5.2, rangeFrac: 0.24, band: "mid" },
  { key: "grainSize", min: 0, max: 100, freq: 0.043, phase: 0.4, rangeFrac: 0.20, band: "high" },
  { key: "dust", min: 0, max: 100, freq: 0.027, phase: 3.9, rangeFrac: 0.26, band: "energy" },
  { key: "soften", min: 0, max: 100, freq: 0.011, phase: 1.6, rangeFrac: 0.16, band: "bass" },

  // finish
  { key: "vignette", min: 0, max: 100, freq: 0.019, phase: 3.7, rangeFrac: 0.16, band: "energy" },

  // brightness-ish FINISH — gentle + slow so it can never strobe
  { key: "glow", min: 0, max: 100, freq: 0.013, phase: 5.0, rangeFrac: 0.10, band: "energy" },
  { key: "contrast", min: 0, max: 100, freq: 0.011, phase: 1.9, rangeFrac: 0.07, band: "bass" },
  { key: "saturation", min: 0, max: 100, freq: 0.015, phase: 3.1, rangeFrac: 0.09, band: "mid" },
  { key: "bloom", min: 0, max: 100, freq: 0.009, phase: 0.3, rangeFrac: 0.08, band: "high" },

  // engine-specific (grid)
  { key: "gridDensity", min: 0, max: 100, freq: 0.031, phase: 2.0, rangeFrac: 0.24, band: "energy" },
  { key: "gridMagnet", min: 0, max: 100, freq: 0.021, phase: 4.0, rangeFrac: 0.26, band: "bass" },
  // engine-specific (waves)
  { key: "waveAmp", min: 0, max: 100, freq: 0.027, phase: 1.4, rangeFrac: 0.26, band: "bass" },
  { key: "waveTurbulence", min: 0, max: 100, freq: 0.039, phase: 5.6, rangeFrac: 0.24, band: "high" },
  // engine-specific (orb 2D)
  { key: "orbMelt", min: 0, max: 100, freq: 0.025, phase: 3.3, rangeFrac: 0.24, band: "mid" },
  { key: "orbHalftone", min: 0, max: 100, freq: 0.033, phase: 0.9, rangeFrac: 0.20, band: "high" },
  { key: "orbSize", min: 0, max: 100, freq: 0.020, phase: 1.2, rangeFrac: 0.16, band: "bass" },
  { key: "orbSoft", min: 0, max: 100, freq: 0.030, phase: 4.7, rangeFrac: 0.18, band: "mid" },
  { key: "orbShade", min: 0, max: 100, freq: 0.024, phase: 2.6, rangeFrac: 0.16, band: "energy" },
  // engine-specific (waves) extra
  { key: "waveDetail", min: 0, max: 100, freq: 0.022, phase: 0.8, rangeFrac: 0.18, band: "mid" },
  { key: "wavePerspective", min: 0, max: 100, freq: 0.016, phase: 3.4, rangeFrac: 0.16, band: "bass" },
  // engine-specific (grid) extra
  { key: "gridPerspective", min: 0, max: 100, freq: 0.018, phase: 5.1, rangeFrac: 0.16, band: "energy" },
  // engine-specific (contours)
  { key: "contourScale", min: 0, max: 100, freq: 0.019, phase: 2.2, rangeFrac: 0.20, band: "bass" },
  { key: "contourWarp", min: 0, max: 100, freq: 0.026, phase: 4.1, rangeFrac: 0.22, band: "mid" },
  { key: "contourLines", min: 0, max: 100, freq: 0.014, phase: 0.7, rangeFrac: 0.16, band: "energy" },
];

// Brightness-ish channels are extra rate-limited in audio mode: their reactive
// gain is blended toward 1 so a loud track can't make them swing hard/fast.
const GENTLE = new Set(["glow", "contrast", "saturation", "bloom"]);

function bandValue(f: AudioFeatures, band: Band): number {
  switch (band) {
    case "energy":
      return f.energy;
    case "bass":
      return f.bass;
    case "mid":
      return f.mid;
    case "high":
      return f.high;
  }
}

/**
 * applyAuto — returns a MODULATED COPY of `base` with the curated channels
 * wandered around their (manual) base values. Does not mutate `base`.
 *
 * @param base       the param bag from renderParams(store)
 * @param t          seconds (a steady clock; real time works fine)
 * @param intensity  store.autoIntensity (0..100)
 * @param audio      smoothed audio features (AUDIO mode) — scales the swing
 *
 * Only channels whose key already exists on `base` and is a finite number are
 * touched, so engine-specific keys for inactive engines are skipped.
 */
export function applyAuto(
  base: ParamBag,
  t: number,
  intensity: number,
  audio?: AudioFeatures,
): ParamBag {
  const amt = clamp(intensity, 0, 100) / 100;
  if (amt <= 0) return base;

  const out: ParamBag = { ...base };
  const TAU = Math.PI * 2;

  for (const ch of CHANNELS) {
    const cur = base[ch.key];
    if (typeof cur !== "number" || !Number.isFinite(cur)) continue;

    // Slow eased LFO in [-1, 1].
    const lfo = Math.sin(t * ch.freq * TAU + ch.phase);

    // Base swing: fraction of the param's real range, scaled by intensity.
    let swing = (ch.max - ch.min) * ch.rangeFrac * amt;

    // AUDIO mode: scale the swing by the channel's smoothed band so it reacts to
    // the track. Keep a floor so it still gently wanders in quiet passages, and
    // rate-limit brightness-ish channels so they can't strobe on loud tracks.
    if (audio) {
      const b = clamp(bandValue(audio, ch.band), 0, 1);
      const gain = GENTLE.has(ch.key)
        ? 0.6 + b * 0.4 // brightness: 0.6..1.0 (gentle)
        : 0.4 + b * 1.0; // motion-ish: 0.4..1.4
      swing *= gain;
    }

    out[ch.key] = clamp(cur + lfo * swing, ch.min, ch.max);
  }

  // ── Colour automation ──────────────────────────────────────────────────────
  // A slow, smooth hue rotation of the WHOLE palette (plus a gentle saturation
  // breath) so colour evolves over time when Auto is on. Hue is circular, so a
  // continuous drift wraps seamlessly — no jump, no strobe. render.ts applies
  // these via transformPalette's hue/sat. Absent when Auto is off, so it no-ops.
  let hueGain = 1;
  if (audio) hueGain = 0.7 + clamp(bandValue(audio, "energy"), 0, 1) * 0.6; // 0.7..1.3
  out._autoHue = (t * 3.5 * amt * hueGain) % 100; // ~28s/cycle at full intensity
  out._autoSat = 50 + Math.sin(t * 0.08 * TAU) * 6 * amt; // gentle ±6 sat breath

  return out;
}
