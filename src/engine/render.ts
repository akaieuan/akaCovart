import type { AnimState, Mood, RenderResult } from "./types";
import { getEngine } from "./registry";
import { palettes, resolveMood } from "./palettes";
import { prng } from "./prng";
import { rgb } from "./color";
import {
  bloom,
  drawSigil,
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
  };
}

// Deterministic: same (seed, params) reproduces the same image.
// Finish order: soften, scratches, drawSigil, postColor, bloom, vignette, grain, drawText.
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
  const cfg = palettes[mood];
  const anim = buildAnim(params);

  // Base fill.
  ctx.fillStyle = rgb(cfg.base);
  ctx.fillRect(0, 0, S, S);

  // Field dispatch.
  const engine = getEngine(params.engine || "blob");
  if (engine) {
    engine.field({ ctx, size: S, params, mood, cfg, seed, anim });
  }

  // ----- finish chain -----
  if ((params.soften || 0) > 0) {
    soften(ctx, S, params.soften || 0, cfg);
  }

  if (params.scratches) {
    scratches(ctx, S, params.scratchCount == null ? 6 : params.scratchCount, prng(seed ^ 0x2c1b3d77), cfg);
  }

  if (params.sigilMarks || params.sigilEmblem || params.sigilFrame) {
    drawSigil(ctx, S, params, mood, prng(seed ^ 0x53a7f0d3));
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

  if ((params.grain || 0) > 0 || (params.dust || 0) > 0) {
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
  if (params.showText) {
    textBox = drawText(ctx, S, params, mood, prng(seed ^ 0x3b9a73c1));
  }

  return { textBox };
}
