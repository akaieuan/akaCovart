import type { AnimState, Mood, RenderResult, TextBox } from "./types";
import { getEngine } from "./registry";
import { palettes, recolorPalette, resolveMood, transformPalette } from "./palettes";
import { prng } from "./prng";
import { rgb } from "./color";
import {
  bloom,
  drawText,
  grain,
  postColor,
  scratches,
  soften,
  vignette,
} from "./effects";

// Build the eased animation state.
// beat is the continuous beat phase; kickEnv / kickSpring / pumpEnv are smooth
// envelopes derived from it, scaled by the kick / pump sliders. They drive ONLY
// scale / position / displacement / radius — never brightness/opacity/hue.
// When not animating (the still default), everything is calm (zero energy).
function buildAnim(params: Record<string, any>): AnimState {
  // Audio-driven override: the render loop computes critically-damped springs
  // off the sampled feature timeline (delta-time stepped) and passes the eased
  // AnimState directly. Audio drives SPACE only — never brightness/opacity/hue.
  const audioAnim = params._audioAnim as Partial<AnimState> | undefined;
  if (audioAnim) {
    return {
      anim: audioAnim.anim ?? true,
      t: audioAnim.t ?? 0,
      rt: audioAnim.rt ?? 0,
      bake: audioAnim.bake ?? false,
      beat: audioAnim.beat ?? 0,
      kickEnv: audioAnim.kickEnv ?? 0,
      kickSpring: audioAnim.kickSpring ?? 0,
      pumpEnv: audioAnim.pumpEnv ?? 0,
      drift: audioAnim.drift ?? 0,
      swirl: audioAnim.swirl ?? 0,
      speed: audioAnim.speed ?? 0,
      loopPhase: audioAnim.loopPhase ?? 0,
    };
  }

  const animOn = !!params._anim;
  if (!animOn) {
    return {
      anim: false,
      t: 0,
      rt: 0,
      bake: false,
      beat: 0,
      kickEnv: 0,
      kickSpring: 0,
      pumpEnv: 0,
      drift: 0,
      swirl: 0,
      speed: 0,
      loopPhase: 0,
    };
  }
  const t: number = params._t || 0;
  const rt: number = params._rt || 0;
  const bake = !!params._bake;

  // Beat phase in [0,1) from real time and BPM.
  const bps = (params.animBPM == null ? 128 : params.animBPM) / 60;
  const beat = (rt * bps) % 1;

  const kick = (params.animKick == null ? 0 : params.animKick) / 100;
  const pump = (params.animPump == null ? 0 : params.animPump) / 100;
  const drift = (params.animDrift == null ? 0 : params.animDrift) / 100;
  const swirl = (params.animSwirl == null ? 0 : params.animSwirl) / 100;
  const speed = (params.animSpeed == null ? 0 : params.animSpeed) / 100;

  // Smooth attack-decay off the beat phase — calm pulse that peaks on the beat
  // and eases out. kickSpring is a SIGNED damped bounce (overshoots, settles).
  // No strobe / flicker — these only ever drive space (scale/position/radius).
  const kickEnv = kick * Math.pow(1 - beat, 3.4);
  const kickSpring = kick * Math.exp(-3.2 * beat) * Math.cos(2 * Math.PI * 1.6 * beat);
  const pumpEnv = pump * Math.pow(1 - beat, 2.0);

  // Beat-synced resolve-loop phase: wraps every `loopBeats` beats (integer so the
  // per-beat kick aligns + the loop stays seamless), 0 at each resolve.
  const loopBeats = Math.max(
    1,
    Math.round(0.5 + ((params.txtLoopBeats == null ? 20 : params.txtLoopBeats) / 100) * 7.5),
  );
  const loopPhase = ((rt * bps) / loopBeats) % 1;

  return {
    anim: true,
    t,
    rt,
    bake,
    beat,
    kickEnv,
    kickSpring,
    pumpEnv,
    drift,
    swirl,
    speed,
    loopPhase,
  };
}

// Deterministic: same (seed, params) reproduces the same image.
// Finish order: soften, scratches, postColor, bloom, vignette, grain, drawText.
// OMITS flicker overlay / strobe / pump-darken / hue-cycle.
export function renderTo(
  canvas: HTMLCanvasElement,
  size: number,
  params: Record<string, any>,
): RenderResult {
  const ctx = canvas.getContext("2d");
  if (!ctx) return {};

  const S = size;
  ctx.clearRect(0, 0, S, S);

  const seed = (params.seed >>> 0) || 1;
  const mood: Mood = resolveMood(seed, (params.mood ?? "random") as Mood | "random");
  // Apply the Color controls to the resolved palette so they affect EVERY engine
  // (base fill, field, and cfg-driven effects below). Order: base mood palette ->
  // recolour toward the picked colour (if any) -> Tone (light<->dark) + optional
  // AUTO colour automation. The picker owns the static hue/sat, so normally
  // transformPalette runs with neutral hue/sat (0/50); when Auto mode is on it
  // supplies a slow hue rotation / sat breath via _autoHue/_autoSat. At defaults
  // (colorPick null, tone 50, no auto) every step is a no-op and the output is
  // byte-identical to before these features existed.
  const picked =
    typeof params.colorPick === "string" && params.colorPick
      ? params.colorPick
      : null;
  const moodPalette = palettes[mood];
  const recolored = picked
    ? recolorPalette(moodPalette, picked)
    : moodPalette;
  // Combine the user Color sliders with AUTO mode's slow hue/sat evolution.
  // The Hue slider is centre-neutral (50 = 0°, mapped to ±180°); AUTO adds on
  // top. The Vibrance slider is 50-neutral; AUTO contributes its delta from 50.
  // Warmth is user-only. At defaults every term is neutral => transform no-ops.
  const userHue = ((((params.colorHue as number) ?? 50) - 50) / 50) * 50;
  const autoHue = (params._autoHue as number) ?? 0;
  const userSat = (params.colorSat as number) ?? 50;
  const autoSat = (params._autoSat as number) ?? 50;
  const cfg = transformPalette(
    recolored,
    params.colorTone ?? 50,
    userHue + autoHue,
    userSat + (autoSat - 50),
    (params.colorWarm as number) ?? 50,
  );
  const anim = buildAnim(params);

  // Base fill.
  ctx.fillStyle = rgb(cfg.base);
  ctx.fillRect(0, 0, S, S);

  // Field dispatch — the selected 2D engine draws into the canvas.
  const engine = getEngine(params.engine || "blob");
  if (engine) {
    engine.field({ ctx, size: S, params, mood, cfg, seed, anim });
  }

  // ----- finish chain -----
  if ((params.soften || 0) > 0) {
    soften(ctx, S, params.soften || 0, cfg);
  }

  // TxT engines are meant to read as smooth, high-res, stark two-tone type, so
  // the film-grain / scratch texture is skipped for them (it muddies the look).
  const smoothTxt = engine?.focus === "txt";

  if (params.scratches && !smoothTxt) {
    scratches(ctx, S, params.scratchCount == null ? 6 : params.scratchCount, prng(seed ^ 0x2c1b3d77), cfg);
  }

  // postColor is baked when still (or when an animation bake/export is requested).
  if (!anim.anim || anim.bake) {
    postColor(ctx, S, params.contrast == null ? 50 : params.contrast, params.saturation == null ? 50 : params.saturation);
  }

  if ((params.bloom || 0) > 0) {
    bloom(ctx, S, params.bloom || 0);
  }

  if ((params.vignette || 0) > 0) {
    vignette(ctx, S, params.vignette || 0);
  }

  if (!smoothTxt && ((params.grain || 0) > 0 || (params.dust || 0) > 0)) {
    grain(
      ctx,
      S,
      params.grain || 0,
      params.grainSize == null ? 50 : params.grainSize,
      params.dust || 0,
      prng(seed ^ 0x6d1f2a8b),
    );
  }

  let textBox;
  // `_skipText` lets renderFormatTo draw the type AFTER cropping (in frame space)
  // so it is placed for the chosen format rather than baked into the square.
  // TxT engines render the type AS the field, so the corner-credit overlay is
  // suppressed for them (no double-draw) regardless of the showText flag.
  if (params.showText && !params._skipText && engine?.focus !== "txt") {
    textBox = drawText(ctx, S, S, params, mood, prng(seed ^ 0x3b9a73c1));
  }

  return { textBox };
}

// ── Format render (square field cover-cropped into a non-square frame) ────────
// The engines draw SQUARE; a delivery format is a centre cover-crop of that
// square. The TYPE is drawn AFTER the crop, in FRAME space, so textX/textY place
// it relative to THIS format (same relative spot in every ratio — never awkwardly
// cropped). For a square destination this defers to renderTo (identical output).
// `dest.width`/`dest.height` must already be set to the target frame size.
// Pass a persistent `scratch` canvas in hot loops (the live animate path) to
// avoid per-frame canvas allocation / GC churn.
export function renderFormatTo(
  dest: HTMLCanvasElement,
  params: Record<string, any>,
  scratch?: HTMLCanvasElement,
): RenderResult {
  const w = dest.width;
  const h = dest.height;
  if (w === h) {
    return renderTo(dest, w, params);
  }
  const ctx = dest.getContext("2d");
  if (!ctx) return {};

  // Render the square field+effects WITHOUT type at the frame's longer edge so
  // the cropped result is full-resolution on both axes.
  const side = Math.max(w, h);
  const off = scratch ?? document.createElement("canvas");
  off.width = side; // (re)setting width also clears the scratch bitmap
  off.height = side;
  renderTo(off, side, { ...params, _skipText: true });

  // Centre cover-crop the square field into the destination frame.
  const a = w / h;
  let sw: number;
  let sh: number;
  if (a >= 1) {
    sw = side;
    sh = side / a;
  } else {
    sh = side;
    sw = side * a;
  }
  ctx.clearRect(0, 0, w, h);
  ctx.drawImage(off, (side - sw) / 2, (side - sh) / 2, sw, sh, 0, 0, w, h);

  // Type drawn in FRAME space (correct placement for this format). Suppressed
  // for TxT engines, which render the type as the field itself.
  let textBox: TextBox | undefined;
  const isTxtEngine = getEngine(params.engine || "blob")?.focus === "txt";
  if (params.showText && !isTxtEngine) {
    const seed = (params.seed >>> 0) || 1;
    const mood: Mood = resolveMood(seed, (params.mood ?? "random") as Mood | "random");
    textBox = drawText(ctx, w, h, params, mood, prng(seed ^ 0x3b9a73c1));
  }
  return { textBox };
}
