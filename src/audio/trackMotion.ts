import type { AudioFeatures } from "./features";
import { zeroFeatures } from "./features";
import type { AnimState } from "@/engine";

// ── Deterministic track-driven motion stepper ────────────────────────────────
// Mirrors the LIVE track driver in CanvasStage (the same critically-damped
// springs + envelope followers + onset impulse), packaged as a reusable, stateful
// stepper so the OFFLINE video encoder can advance the motion frame-by-frame and
// the exported video matches what plays in the editor.
//
// Determinism: the only inputs are the (deterministic) offline feature timeline
// and a fixed per-frame dt, so a given (timeline, clip, fps) always yields the
// same frames. Motion is space-only (the AnimState never carries hue/brightness).
//
// NOTE: keep in sync with the track-driver block in
// src/components/canvas/CanvasStage.tsx — same constants + mapping.

const SPRING_DT = 1 / 120; // fixed physics sub-step (fps-independent)

interface Spring {
  x: number;
  v: number;
}

function stepSpring(s: Spring, target: number, k: number, dt: number): void {
  const c = 2 * Math.sqrt(k); // critically damped
  const a = k * (target - s.x) - c * s.v;
  s.v += a * dt;
  s.x += s.v * dt;
}

function follow(cur: number, target: number, atk: number, rel: number, dt: number): number {
  const tau = target > cur ? atk : rel;
  if (tau <= 0) return target;
  const k = 1 - Math.exp(-dt / tau);
  return cur + (target - cur) * k;
}

function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}
function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}

export interface TrackMotion {
  feat: AudioFeatures;
  kick: Spring;
  pump: Spring;
  bass: Spring;
  drift: Spring;
  swirl: Spring;
  impulse: number;
  prevBeat: number;
  accum: number;
}

export function createTrackMotion(): TrackMotion {
  return {
    feat: zeroFeatures(),
    kick: { x: 0, v: 0 },
    pump: { x: 0, v: 0 },
    bass: { x: 0, v: 0 },
    drift: { x: 0, v: 0 },
    swirl: { x: 0, v: 0 },
    impulse: 0,
    prevBeat: 0,
    accum: 0,
  };
}

// Advance the motion by `frameDt` seconds toward the sampled `raw` features, then
// map the eased springs to the AnimState the engines consume. `rt` is the
// clip-relative time (drives engine flow + the resolve loopPhase). `intensity` =
// audioIntensity/50 (0 when reactivity is off). Returns a full AnimState.
export function stepTrackMotion(
  m: TrackMotion,
  raw: AudioFeatures,
  frameDt: number,
  intensity: number,
  rt: number,
  bps: number,
  loopBeats: number,
  bake: boolean,
): AnimState {
  m.accum += Math.min(frameDt, 0.25);
  let steps = 0;
  while (m.accum >= SPRING_DT && steps < 240) {
    const dt = SPRING_DT;
    m.accum -= dt;
    steps++;
    const f = m.feat;
    f.energy = follow(f.energy, clamp01(raw.energy), 0.04, 0.18, dt);
    f.bass = follow(f.bass, clamp01(raw.bass), 0.03, 0.16, dt);
    f.mid = follow(f.mid, clamp01(raw.mid), 0.05, 0.14, dt);
    f.high = follow(f.high, clamp01(raw.high), 0.02, 0.1, dt);
    f.beat = follow(f.beat, clamp01(raw.beat), 0.005, 0.12, dt);
    const rising = f.beat - m.prevBeat;
    m.prevBeat = f.beat;
    if (rising > 0.04 && f.beat > 0.25) m.impulse = Math.max(m.impulse, f.beat);
    m.impulse *= Math.exp(-dt / 0.22);
    stepSpring(m.kick, f.beat, 180, dt);
    stepSpring(m.pump, f.energy, 60, dt);
    stepSpring(m.bass, f.bass, 90, dt);
    stepSpring(m.drift, f.mid, 28, dt);
    stepSpring(m.swirl, f.high, 40, dt);
  }
  const kickSpring = clamp((m.kick.x - m.feat.beat) * 1.6 * intensity, -1.2, 1.2);
  const kickEnv = clamp(m.impulse * intensity, 0, 1.4);
  const pumpEnv = clamp((m.pump.x * 0.7 + m.bass.x * 0.5) * intensity, 0, 1.4);
  const drift = clamp(m.drift.x * intensity, 0, 1.2);
  const swirl = clamp(m.swirl.x * intensity, 0, 1.2);
  const speed = clamp(0.35 + m.pump.x * 0.9 * Math.max(0.0001, intensity), 0, 1.4);
  const t = rt * (0.45 + speed);
  const loopPhase = ((rt * bps) / loopBeats) % 1;
  return {
    anim: true,
    t,
    rt,
    bake,
    beat: m.feat.beat,
    kickEnv,
    kickSpring,
    pumpEnv,
    drift,
    swirl,
    speed,
    loopPhase,
  };
}
