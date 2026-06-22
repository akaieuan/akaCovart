"use client";

import { useCallback, useEffect, useRef } from "react";
import { renderTo } from "@/engine";
import type { TextBox } from "@/engine";
import { useStudio, renderParams, type StudioState } from "@/lib/store";
import { audioSession, transport, zeroFeatures } from "@/audio";
import type { AudioFeatures } from "@/audio";

const DISPLAY = 880;

// ── Audio reactivity tuning ────────────────────────────────────────────────
// Fixed-timestep physics step. We accumulate real delta-time and step springs
// at this rate so motion is identical at 30 / 60 / 120 fps and never blows up.
const SPRING_DT = 1 / 120; // seconds per physics sub-step
const MAX_FRAME_DT = 0.25; // clamp huge dt (tab backgrounded) so springs stay sane

// Critically-damped spring: x'' = -k x - 2*sqrt(k) x' + k*target.
// Stepping with a small fixed dt keeps it stable and free of overshoot.
// Different stiffnesses give different "feel" per feature.
interface Spring {
  x: number; // position
  v: number; // velocity
}

function stepSpring(s: Spring, target: number, k: number, dt: number): void {
  // Critically damped: damping c = 2*sqrt(k).
  const c = 2 * Math.sqrt(k);
  const a = k * (target - s.x) - c * s.v;
  s.v += a * dt;
  s.x += s.v * dt;
}

// Envelope follower (attack / release in seconds). Smooths a raw feature into
// a buttery signal. Stepped by fixed dt so it is fps-independent.
function follow(cur: number, target: number, atk: number, rel: number, dt: number): number {
  const tau = target > cur ? atk : rel;
  if (tau <= 0) return target;
  // Exponential approach: 1 - e^(-dt/tau).
  const k = 1 - Math.exp(-dt / tau);
  return cur + (target - cur) * k;
}

function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}

// Signature of everything that affects the main image (mirrors the prototype).
function paramSig(s: StudioState): string {
  return [
    s.mood,
    s.engine,
    s.gridCols,
    s.gridDensity,
    s.gridPerspective,
    s.gridMagnet,
    s.waveCount,
    s.waveAmp,
    s.waveDetail,
    s.waveTurbulence,
    s.wavePerspective,
    s.orbSize,
    s.orbSoft,
    s.orbHalftone,
    s.orbMelt,
    s.orbShade,
    s.soften,
    s.density,
    s.smear,
    s.grain,
    s.blobSize,
    s.glow,
    s.contrast,
    s.saturation,
    s.vignette,
    s.bloom,
    s.grainSize,
    s.dust,
    s.accent,
    s.accentCount,
    s.diamonds,
    s.diamondCount,
    s.diamondSize,
    s.diamondShape,
    s.sigilMarks,
    s.sigilMarkCount,
    s.sigilMarkSize,
    s.sigilMarkScatter,
    s.sigilFrame,
    s.sigilFrameDensity,
    s.scratches,
    s.scratchCount,
  ].join("|");
}

function textSig(s: StudioState): string {
  return [
    s.showText,
    s.title,
    s.artist,
    s.textColor,
    s.textCase,
    s.distort,
    s.textX,
    s.textY,
    s.textAlign,
  ].join("|");
}

function sig(s: StudioState): string {
  return s.seed + "|" + paramSig(s) + "|" + textSig(s);
}

export default function CanvasStage({
  canvasRef,
}: {
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
}) {

  // Latest state without forcing re-subscription of the RAF loop.
  const state = useStudio();
  const stateRef = useRef(state);
  stateRef.current = state;

  const textBoxRef = useRef<TextBox | undefined>(undefined);
  const lastSig = useRef<string | null>(null);
  const rafRef = useRef<number | null>(null);
  const t0Ref = useRef(0);
  const dragRef = useRef<{ dx: number; dy: number } | null>(null);

  // ── Audio reactivity loop state ───────────────────────────────────────────
  const audioRafRef = useRef<number | null>(null);
  const audioLastNowRef = useRef(0);
  const audioAccumRef = useRef(0); // fixed-timestep accumulator (seconds)
  // Smoothed (envelope-followed) features — buttery input to the springs.
  const featRef = useRef<AudioFeatures>(zeroFeatures());
  // Spring state (position+velocity) per motion channel. Persist across frames.
  const kickSpringRef = useRef<Spring>({ x: 0, v: 0 });
  const pumpSpringRef = useRef<Spring>({ x: 0, v: 0 });
  const bassSpringRef = useRef<Spring>({ x: 0, v: 0 });
  const driftSpringRef = useRef<Spring>({ x: 0, v: 0 });
  const swirlSpringRef = useRef<Spring>({ x: 0, v: 0 });
  // Decaying onset impulse (kickEnv) — sharp attack on a beat, eased release.
  const kickImpulseRef = useRef(0);
  const prevBeatRef = useRef(0);

  // ── Still render (signature-diffed) ───────────────────────────────────────
  const draw = useCallback(() => {
    const c = canvasRef.current;
    if (!c) return;
    const s = stateRef.current;
    lastSig.current = sig(s);
    c.width = DISPLAY;
    c.height = DISPLAY;
    const res = renderTo(c, DISPLAY, renderParams(s));
    textBoxRef.current = res.textBox;
  }, [canvasRef]);

  // ── Animation loop (beat-synced; NO flicker — CSS filter only) ─────────────
  const stopAnim = useCallback(() => {
    if (rafRef.current != null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    const c = canvasRef.current;
    if (c) c.style.filter = "none";
    lastSig.current = null;
    draw();
  }, [draw, canvasRef]);

  const startAnim = useCallback(() => {
    if (rafRef.current != null) return;
    const c = canvasRef.current;
    if (!c) return;
    c.width = DISPLAY;
    c.height = DISPLAY;
    t0Ref.current = performance.now();

    // Paint one immediate frame so the canvas is never blank before the first
    // requestAnimationFrame fires (e.g. if the tab is briefly backgrounded).
    {
      const s0 = stateRef.current;
      const p0 = { ...renderParams(s0), _anim: true, _t: 0, _rt: 0, _bake: !!s0.recording };
      const res0 = renderTo(c, DISPLAY, p0);
      textBoxRef.current = res0.textBox;
      if (!s0.recording) {
        const cc = 1 + ((s0.contrast - 50) / 50) * 0.7;
        const sf = s0.saturation / 50;
        c.style.filter = `contrast(${cc.toFixed(3)}) saturate(${sf.toFixed(3)})`;
      }
    }

    const loop = (now: number) => {
      const s = stateRef.current;
      if (s.mode !== "animate") {
        rafRef.current = null;
        return;
      }
      const sp = 0.3 + (s.animSpeed / 100) * 1.7;
      const rt = (now - t0Ref.current) / 1000;
      const t = rt * sp;
      const bake = !!s.recording;
      const p = {
        ...renderParams(s),
        _anim: true,
        _t: t,
        _rt: rt,
        _bake: bake,
      };
      const res = renderTo(c, DISPLAY, p);
      textBoxRef.current = res.textBox;
      // Live contrast/saturate via CSS filter (never per-frame pixel work).
      if (bake) {
        c.style.filter = "none";
      } else {
        const cc = 1 + ((s.contrast - 50) / 50) * 0.7;
        const sf = s.saturation / 50;
        c.style.filter = `contrast(${cc.toFixed(3)}) saturate(${sf.toFixed(3)})`;
      }
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);
  }, [canvasRef]);

  // ── Audio-reactive loop (samples the offline feature timeline by the audio ──
  //    clock; drives critically-damped springs with a fixed-timestep accumulator
  //    so motion is identical at any fps. Audio drives SPACE only — never
  //    brightness / opacity / hue, so there is no flicker.) ────────────────────
  const stopAudio = useCallback(() => {
    if (audioRafRef.current != null) {
      cancelAnimationFrame(audioRafRef.current);
      audioRafRef.current = null;
    }
    const c = canvasRef.current;
    if (c) c.style.filter = "none";
    lastSig.current = null;
    draw();
  }, [draw, canvasRef]);

  const startAudio = useCallback(() => {
    if (audioRafRef.current != null) return;
    const c = canvasRef.current;
    if (!c) return;
    c.width = DISPLAY;
    c.height = DISPLAY;

    // Reset transient physics so re-entering audio mode starts calm.
    audioLastNowRef.current = performance.now();
    audioAccumRef.current = 0;
    featRef.current = zeroFeatures();
    kickSpringRef.current = { x: 0, v: 0 };
    pumpSpringRef.current = { x: 0, v: 0 };
    bassSpringRef.current = { x: 0, v: 0 };
    driftSpringRef.current = { x: 0, v: 0 };
    swirlSpringRef.current = { x: 0, v: 0 };
    kickImpulseRef.current = 0;
    prevBeatRef.current = 0;

    const loop = (now: number) => {
      const s = stateRef.current;
      if (s.mode !== "audio") {
        audioRafRef.current = null;
        return;
      }

      // Real delta-time (clamped) for fps-independent physics.
      let frameDt = (now - audioLastNowRef.current) / 1000;
      audioLastNowRef.current = now;
      if (!(frameDt > 0)) frameDt = 0;
      if (frameDt > MAX_FRAME_DT) frameDt = MAX_FRAME_DT;

      // Audio clock — seconds into the clip. SAMPLE the offline timeline here.
      const tl = audioSession.timeline;
      const haveAudio = !!tl && tl.duration > 0;
      const playing = haveAudio && transport.playing && s.audioReactive;
      const audioT = haveAudio ? transport.currentTime : 0;

      // Raw features from the deterministic offline timeline (interpolated).
      // When idle (no clip / not playing) we relax toward zero -> calm hold.
      const raw: AudioFeatures =
        haveAudio && (playing || transport.currentTime > 0)
          ? tl!.sampleByTime(audioT)
          : zeroFeatures();

      // Reactivity scale (0..~1.4). Lets loud/quiet tracks behave the same and
      // gives the user one global intensity knob.
      const intensity = (s.audioReactive ? s.audioIntensity : 0) / 50;

      // ── Fixed-timestep accumulator: step springs + envelopes at SPRING_DT ──
      // so behavior is identical at 30 / 60 / 120 fps and never overshoots.
      audioAccumRef.current += frameDt;
      // Guard against a runaway spiral if the loop ever stalls badly.
      let steps = 0;
      const maxSteps = 240;
      while (audioAccumRef.current >= SPRING_DT && steps < maxSteps) {
        const dt = SPRING_DT;
        audioAccumRef.current -= dt;
        steps++;

        const f = featRef.current;
        // Envelope-follow the raw features (buttery, normalized 0..1).
        f.energy = follow(f.energy, clamp01(raw.energy), 0.04, 0.18, dt);
        f.bass = follow(f.bass, clamp01(raw.bass), 0.03, 0.16, dt);
        f.mid = follow(f.mid, clamp01(raw.mid), 0.05, 0.14, dt);
        f.high = follow(f.high, clamp01(raw.high), 0.02, 0.10, dt);
        // Beat is already a decaying onset peak in the timeline.
        f.beat = follow(f.beat, clamp01(raw.beat), 0.005, 0.12, dt);

        // Onset detection: rising edge of the beat impulse -> kick the impulse
        // envelope (sharp attack), then it decays. Drives kickEnv (calm pulse).
        const rising = f.beat - prevBeatRef.current;
        prevBeatRef.current = f.beat;
        if (rising > 0.04 && f.beat > 0.25) {
          kickImpulseRef.current = Math.max(kickImpulseRef.current, f.beat);
        }
        // Decay the impulse (attack-decay envelope, no flicker).
        kickImpulseRef.current *= Math.exp(-dt / 0.22);

        // Step critically-damped springs toward the followed targets.
        // Stiffness sets the "feel": bouncy kick, breathing pump, slow drift.
        stepSpring(kickSpringRef.current, f.beat, 180, dt); // bouncy
        stepSpring(pumpSpringRef.current, f.energy, 60, dt); // breathing
        stepSpring(bassSpringRef.current, f.bass, 90, dt); // chest thump
        stepSpring(driftSpringRef.current, f.mid, 28, dt); // lazy drift
        stepSpring(swirlSpringRef.current, f.high, 40, dt); // shimmer swirl
      }

      // ── Map spring outputs -> eased AnimState, scaled by intensity ─────────
      const kickSpringX = kickSpringRef.current.x;
      const pumpX = pumpSpringRef.current.x;
      const bassX = bassSpringRef.current.x;
      const driftX = driftSpringRef.current.x;
      const swirlX = swirlSpringRef.current.x;
      const impulse = kickImpulseRef.current;

      // kickSpring is a SIGNED bounce (spring can overshoot above its target);
      // re-center around the followed value so it overshoots/settles like the
      // BPM path's damped cosine. Clamp everything so it never blows up.
      const kickSpringSigned = clamp(
        (kickSpringX - featRef.current.beat) * 1.6 * intensity,
        -1.2,
        1.2,
      );
      const kickEnv = clamp(impulse * intensity, 0, 1.4);
      // pump (breathing) blends overall energy + a little bass for chest weight.
      const pumpEnv = clamp((pumpX * 0.7 + bassX * 0.5) * intensity, 0, 1.4);
      const drift = clamp(driftX * intensity, 0, 1.2);
      const swirl = clamp(swirlX * intensity, 0, 1.2);

      // Keep engine time-based motion advancing from the AUDIO clock so flow /
      // spin / turbulence stay locked to the music. _rt is the real audio time;
      // _t scales it gently by energy so quiet passages feel calmer.
      const rt = haveAudio ? audioT : (now - t0Ref.current) / 1000;
      const speed = clamp(0.35 + pumpX * 0.9 * Math.max(0.0001, intensity), 0, 1.4);
      const t = rt * (0.45 + speed);

      const builtState = {
        anim: true,
        t,
        rt,
        bake: false,
        beat: featRef.current.beat,
        kickEnv,
        kickSpring: kickSpringSigned,
        pumpEnv,
        drift,
        swirl,
        speed,
      };

      const res = renderTo(c, DISPLAY, {
        ...renderParams(s),
        _anim: true,
        _audioAnim: builtState,
        _t: t,
        _rt: rt,
        _bake: false,
      });
      textBoxRef.current = res.textBox;

      // Live contrast/saturate via CSS filter (never per-frame pixel work, never
      // audio-modulated — same rule as the BPM animate path: no flicker).
      const cc = 1 + ((s.contrast - 50) / 50) * 0.7;
      const sf = s.saturation / 50;
      c.style.filter = `contrast(${cc.toFixed(3)}) saturate(${sf.toFixed(3)})`;

      audioRafRef.current = requestAnimationFrame(loop);
    };

    audioRafRef.current = requestAnimationFrame(loop);
  }, [canvasRef]);

  // ── Mount + reactive sync ─────────────────────────────────────────────────
  useEffect(() => {
    draw();
    // Re-render once fonts are ready so type metrics are correct.
    if (typeof document !== "undefined" && document.fonts?.ready) {
      document.fonts.ready.then(() => draw());
    }
    return () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
      if (audioRafRef.current != null) cancelAnimationFrame(audioRafRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // React to state changes (subscribe to the whole store).
  useEffect(() => {
    // AUDIO mode: run the audio-reactive loop. Stop the BPM loop if it is up.
    if (state.mode === "audio") {
      if (rafRef.current != null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      if (audioRafRef.current == null) startAudio();
      return;
    }

    // Leaving audio mode: stop the audio loop and redraw the still frame.
    if (audioRafRef.current != null) {
      stopAudio();
      // Fall through so animate mode can restart the BPM loop below.
    }

    if (state.mode === "animate") {
      if (rafRef.current == null) startAnim();
      return;
    }
    if (rafRef.current != null) {
      stopAnim();
      return;
    }
    if (sig(state) !== lastSig.current) draw();
  }, [state, draw, startAnim, stopAnim, startAudio, stopAudio]);

  // ── Drag-to-move text on canvas ───────────────────────────────────────────
  const norm = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    return {
      x: (e.clientX - r.left) / r.width,
      y: (e.clientY - r.top) / r.height,
    };
  };

  const inBox = (px: number, py: number, b: TextBox) =>
    px >= b.x - 0.04 &&
    px <= b.x + b.w + 0.04 &&
    py >= b.y - 0.04 &&
    py <= b.y + b.h + 0.04;

  const onPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const s = stateRef.current;
    if (!s.showText) return;
    const b = textBoxRef.current;
    if (!b) return;
    const p = norm(e);
    if (inBox(p.x, p.y, b)) {
      dragRef.current = { dx: p.x - s.textX, dy: p.y - s.textY };
      e.currentTarget.setPointerCapture(e.pointerId);
      e.currentTarget.style.cursor = "grabbing";
      e.preventDefault();
    }
  };

  const onPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const p = norm(e);
    const drag = dragRef.current;
    if (drag) {
      const nx = Math.max(0.01, Math.min(0.99, p.x - drag.dx));
      const ny = Math.max(0.01, Math.min(0.99, p.y - drag.dy));
      useStudio.getState().setState({ textX: nx, textY: ny });
    } else if (stateRef.current.showText && textBoxRef.current) {
      e.currentTarget.style.cursor = inBox(p.x, p.y, textBoxRef.current)
        ? "grab"
        : "default";
    }
  };

  const onPointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (dragRef.current) {
      dragRef.current = null;
      e.currentTarget.style.cursor = "grab";
    }
  };

  return (
    <section className="flex min-h-0 min-w-0 flex-1 flex-col items-center justify-center gap-4 overflow-hidden bg-[radial-gradient(circle_at_50%_38%,#121215,#0a0a0b_72%)] px-4 pt-16 pb-44 sm:gap-[18px] sm:px-8 md:py-8">
      <div className="relative aspect-square w-full max-w-[min(82vh,760px)] bg-black shadow-[0_30px_80px_rgba(0,0,0,0.65),0_0_0_1px_#1c1c20]">
        <canvas
          ref={canvasRef}
          className="block h-full w-full touch-none"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        />
      </div>
      <div className="font-sans text-[11px] tabular-nums text-grey-400">
        3000 × 3000 px&nbsp;&nbsp;·&nbsp;&nbsp;Seed&nbsp;{state.seed >>> 0}
      </div>
    </section>
  );
}
