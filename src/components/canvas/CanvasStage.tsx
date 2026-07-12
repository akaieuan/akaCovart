"use client";

import { useCallback, useEffect, useRef } from "react";
import { renderFormatTo } from "@/engine";
import type { TextBox } from "@/engine";
import { useStudio, renderParams, type StudioState } from "@/lib/store";
import { getFormat } from "@/lib/formats";
import { ensureCoverFont } from "@/lib/fonts";
import { audioSession, transport, zeroFeatures } from "@/audio";
import type { AudioFeatures } from "@/audio";
import { createTrackMotion, stepTrackMotion, type TrackMotion } from "@/audio/trackMotion";
import { applyAuto } from "./autoModulate";

const DISPLAY = 880;
// Cheaper backing-store size used for "draft" frames while params are actively
// changing; we snap back to DISPLAY (full quality) once the value settles.
const DRAFT = 560;

// Live animation renders at an ADAPTIVE backing-store size (CSS-scaled up to the
// stage) so the per-frame finish chain (grain / soften / bloom / vignette) stays
// cheap and the motion stays fluid. It auto-tunes between these bounds from the
// measured frame time, and snaps back to full DISPLAY at rest + when baking an
// export frame.
//
// PARITY: the floor + ceiling are kept CLOSE to the still's DISPLAY (880) so the
// live animation is a faithful moving version of the still on every screen. On a
// small phone the canvas displays at ~340px, so the still (880) is ~2.5× super-
// sampled and very smooth; if the animation dropped to a low backing-store size it
// would render coarser, thicker-floored lines and read as a DIFFERENT, busier
// image. Holding the floor near DISPLAY makes "Animate" look like the same art the
// still shows, just in motion. The adaptive valve still gives a little relief under
// sustained load without visibly changing the look.
const ANIM_MIN = 640;
const ANIM_MAX = 880;
const ANIM_START = 820;
function nextAnimRes(cur: number, emaMs: number): number {
  if (emaMs > 21 && cur > ANIM_MIN) return Math.max(ANIM_MIN, cur - 48);
  if (emaMs < 13 && cur < ANIM_MAX) return Math.min(ANIM_MAX, cur + 24);
  return cur;
}

// Clamp huge frame dt (tab backgrounded) so the physics + EMA stay sane. The
// track-driver spring physics itself lives in src/audio/trackMotion.ts — the
// SAME stepper the video export uses, so live preview and export always match.
const MAX_FRAME_DT = 0.25;

// Signature of everything that affects the main image (mirrors the prototype).
function paramSig(s: StudioState): string {
  return [
    s.mood,
    s.colorTone,
    s.colorHue,
    s.colorSat,
    s.colorWarm,
    s.colorPick,
    s.engine,
    // Stack focus: the overlay engine + how it composites (txtBg/txtInk already below).
    s.focus,
    s.stackTxt,
    s.stackMode,
    s.stackScrim,
    s.stackAnim,
    s.gridCols,
    s.gridDensity,
    s.gridPerspective,
    s.gridMagnet,
    s.contourLines,
    s.contourWeight,
    s.contourScale,
    s.contourDetail,
    s.contourWarp,
    s.contourRelief,
    s.contourFill,
    s.signalFreq,
    s.signalLayers,
    s.signalSpread,
    s.signalSharp,
    s.signalWarp,
    // TxT engine composition params (motion params are excluded, like the others)
    s.ditherSize,
    s.ditherBreak,
    s.ditherGap,
    s.ditherRound,
    s.ditherInvert,
    s.lineSize,
    s.lineGap,
    s.lineAngle,
    s.lineInvert,
    s.blurAmount,
    s.blurThreshold,
    s.blurInvert,
    s.txtBg,
    s.txtInk,
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
    s.accent,
    s.accentCount,
    s.diamonds,
    s.diamondCount,
    s.diamondSize,
    s.diamondShape,
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
    s.textFont,
    s.distort,
    s.textX,
    s.textY,
    s.textAlign,
    // TxT display text (the subject the txt engines rasterize)
    s.txtText,
    s.txtSub,
    s.txtSize,
    s.txtAlign,
    s.txtVAlign,
  ].join("|");
}

function sig(s: StudioState): string {
  // `format` is included so switching the delivery format re-renders the live
  // frame (the backing-store aspect + crop + frame-space type all change).
  return s.seed + "|" + paramSig(s) + "|" + textSig(s) + "|" + s.format;
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
  // Reused offscreen square canvas for the format cover-crop, so the animate loop
  // never allocates a canvas per frame (which would cause GC hitches).
  const scratchRef = useRef<HTMLCanvasElement | null>(null);

  // Backing-store dims for the ACTIVE format at a given longest-edge target. The
  // engines render square; the canvas is the format aspect (cover-cropped), so
  // the live frame matches the chosen delivery format 1:1 with the export.
  const fmtDims = useCallback((longEdge: number) => {
    const f = getFormat(stateRef.current.format);
    const a = f.w / f.h;
    return a >= 1
      ? { w: longEdge, h: Math.max(1, Math.round(longEdge / a)) }
      : { w: Math.max(1, Math.round(longEdge * a)), h: longEdge };
  }, []);

  // Adaptive animation-resolution state for the unified anim loop. An EMA of
  // frame time drives the backing-store size to keep motion fluid.
  const animResRef = useRef(ANIM_START);
  const animEmaRef = useRef(16);
  const animCtrRef = useRef(0);
  const animLastNowRef = useRef(0);

  // Coalesced still-render scheduling (rAF + draft-while-interacting).
  const drawRafRef = useRef<number | null>(null);
  const lastChangeRef = useRef(0);

  // ── Track-driver (audio) physics state — the shared trackMotion stepper ────
  const motionRef = useRef<TrackMotion>(createTrackMotion());

  // ── Still render (signature-diffed, rAF-coalesced, draft-while-interacting) ─
  // Render at an explicit backing-store size. Smaller = cheaper "draft" frame;
  // the canvas is CSS-scaled to the stage so a draft just looks slightly soft.
  const drawAt = useCallback(
    (longEdge: number) => {
      const c = canvasRef.current;
      if (!c) return;
      const { w, h } = fmtDims(longEdge);
      c.width = w;
      c.height = h;
      const scratch =
        scratchRef.current ?? (scratchRef.current = document.createElement("canvas"));
      const res = renderFormatTo(c, renderParams(stateRef.current), scratch);
      textBoxRef.current = res.textBox;
    },
    [canvasRef, fmtDims],
  );

  // Full-quality immediate draw (mount / settle / after an anim loop stops).
  const draw = useCallback(() => {
    lastSig.current = sig(stateRef.current);
    drawAt(DISPLAY);
  }, [drawAt]);

  // While params change rapidly, paint cheap DRAFT frames coalesced to one per
  // animation frame; once nothing has changed for a beat, paint one full-res
  // frame. Keeps dragging ~60fps and crisp at rest.
  const scheduleDraw = useCallback(() => {
    lastChangeRef.current = performance.now();
    if (drawRafRef.current != null) return;
    const run = () => {
      drawRafRef.current = null;
      const s = stateRef.current;
      if (s.mode !== "still") return;
      if (performance.now() - lastChangeRef.current >= 130) {
        lastSig.current = sig(s);
        drawAt(DISPLAY);
      } else {
        drawAt(DRAFT);
        drawRafRef.current = requestAnimationFrame(run);
      }
    };
    drawRafRef.current = requestAnimationFrame(run);
  }, [drawAt]);

  // Decide, this frame, whether motion is driven by the imported track. The
  // track only drives when the user picked it AND an analyzed timeline exists.
  const trackActive = useCallback((s: StudioState): boolean => {
    const tl = audioSession.timeline;
    return s.animSource === "track" && !!tl && tl.duration > 0;
  }, []);

  // Reset the audio spring/accumulator transients so the track path starts calm
  // (when entering animate, or when the source flips to "track" mid-run).
  const resetAudioTransients = useCallback(() => {
    motionRef.current = createTrackMotion();
  }, []);

  // ── Unified animation loop (runs while mode === "animate") ─────────────────
  // ONE animation. Each frame picks its DRIVER: the internal BPM clock, or the
  // imported track (when animSource === "track" and a timeline is analyzed).
  // Both feed the same shared AnimState the engines already consume. Motion is
  // SPACE-only (scale / position / displacement) so there is never any flicker;
  // brightness/contrast/saturation are applied once per frame as a CSS filter.
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
    {
      const d = fmtDims(DISPLAY);
      c.width = d.w;
      c.height = d.h;
    }
    t0Ref.current = performance.now();
    animResRef.current = ANIM_START;
    animEmaRef.current = 16;
    animCtrRef.current = 0;
    animLastNowRef.current = t0Ref.current;
    // Start the track-driver physics calm; harmless when the BPM driver is used.
    resetAudioTransients();
    // Track which driver ran last frame so we can re-settle the audio springs
    // when the source flips to "track" mid-run.
    let wasTrack = trackActive(stateRef.current);

    // Paint one immediate frame so the canvas is never blank before the first
    // requestAnimationFrame fires (e.g. if the tab is briefly backgrounded).
    {
      const s0 = stateRef.current;
      const p0 = { ...renderParams(s0), _anim: true, _t: 0, _rt: 0, _bake: !!s0.recording };
      const res0 = renderFormatTo(
        c,
        p0,
        scratchRef.current ?? (scratchRef.current = document.createElement("canvas")),
      );
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
      const bake = !!s.recording;
      const useTrack = trackActive(s);
      // Re-settle the audio springs the moment we switch INTO the track driver
      // so it eases in from rest instead of snapping from stale state.
      if (useTrack && !wasTrack) resetAudioTransients();
      wasTrack = useTrack;

      // Frame delta-time (clamped) — used both for the EMA and the track path's
      // fixed-timestep physics so behavior is fps-independent.
      let frameDt = (now - animLastNowRef.current) / 1000;
      animLastNowRef.current = now;
      if (!(frameDt > 0)) frameDt = 0;
      if (frameDt > MAX_FRAME_DT) frameDt = MAX_FRAME_DT;

      // Per-driver: build the render params (incl. AUTO base) + the CSS filter
      // source params. autoBase is also the contrast/saturation source.
      let p: Record<string, unknown>;
      let autoBase: Record<string, unknown>;

      if (useTrack) {
        // ── TRACK DRIVER ──────────────────────────────────────────────────
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

        // Keep engine time-based motion advancing from the AUDIO clock so flow /
        // spin / turbulence stay locked to the music. _rt is the real audio time.
        const rt = haveAudio ? audioT : (now - t0Ref.current) / 1000;

        // Step the shared spring physics (src/audio/trackMotion.ts — the exact
        // stepper the video export uses) toward the sampled features → the eased
        // AnimState the engines consume.
        const bps = (s.animBPM || 128) / 60;
        const loopBeats = Math.max(1, Math.round(0.5 + ((s.txtLoopBeats ?? 20) / 100) * 7.5));
        const builtState = stepTrackMotion(
          motionRef.current,
          raw,
          frameDt,
          intensity,
          rt,
          bps,
          loopBeats,
          bake,
        );

        // AUTO: wander curated params around their manual base, swing additionally
        // scaled by the SMOOTHED audio features. Render-loop only — never stored.
        autoBase = s.auto
          ? applyAuto(renderParams(s), rt, s.autoIntensity, motionRef.current.feat)
          : renderParams(s);

        p = {
          ...autoBase,
          _anim: true,
          _audioAnim: builtState,
          _t: builtState.t,
          _rt: rt,
          _bake: bake,
        };
      } else {
        // ── BPM DRIVER (internal clock) ──────────────────────────────────────
        const sp = 0.3 + (s.animSpeed / 100) * 1.7;
        const rt = (now - t0Ref.current) / 1000;
        const t = rt * sp;
        // AUTO: gently wander curated params around their manual base values
        // (render-loop only). Uses real time `rt` so the wander is BPM-independent.
        autoBase = s.auto
          ? applyAuto(renderParams(s), rt, s.autoIntensity)
          : renderParams(s);
        p = {
          ...autoBase,
          _anim: true,
          _t: t,
          _rt: rt,
          _bake: bake,
        };
      }

      // ── SHARED: adaptive backing-store size + CSS filter (both drivers) ────
      // Adaptive size from the measured frame time keeps motion fluid; full
      // DISPLAY when baking a frame for export.
      const frameMs = frameDt * 1000;
      if (frameMs > 0 && frameMs < 200) {
        animEmaRef.current = animEmaRef.current * 0.9 + frameMs * 0.1;
      }
      if (!bake && ++animCtrRef.current % 12 === 0) {
        animResRef.current = nextAnimRes(animResRef.current, animEmaRef.current);
      }
      // Stack composites TWO engines per frame (art bg + type), so cap the LIVE
      // backing-store lower to keep motion fluid on every device. Stills + exports
      // (bake) are unaffected and snap back to full DISPLAY.
      const liveCap = s.focus === "stack" ? 720 : ANIM_MAX;
      const renderSize = bake ? DISPLAY : Math.min(animResRef.current, liveCap);
      const { w: tw, h: th } = fmtDims(renderSize);
      if (c.width !== tw || c.height !== th) {
        c.width = tw;
        c.height = th;
      }
      const res = renderFormatTo(
        c,
        p,
        scratchRef.current ?? (scratchRef.current = document.createElement("canvas")),
      );
      textBoxRef.current = res.textBox;

      // Live contrast/saturate via CSS filter (never per-frame pixel work).
      // Read from the (possibly auto-modulated) params so AUTO's gentle, rate-
      // limited finish wander is reflected here too — still bounded, no strobe.
      if (bake) {
        c.style.filter = "none";
      } else {
        const cParam = (autoBase.contrast as number) ?? s.contrast;
        const sParam = (autoBase.saturation as number) ?? s.saturation;
        const cc = 1 + ((cParam - 50) / 50) * 0.7;
        const sf = sParam / 50;
        c.style.filter = `contrast(${cc.toFixed(3)}) saturate(${sf.toFixed(3)})`;
      }
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);
  }, [canvasRef, trackActive, resetAudioTransients, fmtDims]);

  // ── Mount + reactive sync ─────────────────────────────────────────────────
  useEffect(() => {
    draw();
    // Re-render once fonts are ready so type metrics are correct.
    if (typeof document !== "undefined" && document.fonts?.ready) {
      document.fonts.ready.then(() => draw());
    }
    return () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
      if (drawRafRef.current != null) cancelAnimationFrame(drawRafRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Cover fonts paint on the canvas, so the browser must DOWNLOAD the chosen face
  // before it can render with it (a CSS @import won't fetch a face no DOM node
  // uses). Load the selected family, then repaint so the switch actually shows.
  useEffect(() => {
    let cancelled = false;
    ensureCoverFont(state.textFont).then(() => {
      if (cancelled) return;
      lastSig.current = null;
      if (stateRef.current.mode === "still") draw();
    });
    return () => {
      cancelled = true;
    };
  }, [state.textFont, draw]);

  // React to state changes (subscribe to the whole store).
  useEffect(() => {
    // Cancel any pending still-draft loop when leaving still mode.
    if (state.mode !== "still" && drawRafRef.current != null) {
      cancelAnimationFrame(drawRafRef.current);
      drawRafRef.current = null;
    }

    // ANIMATE: run the ONE unified loop (driver is chosen per-frame inside it).
    if (state.mode === "animate") {
      if (rafRef.current == null) startAnim();
      return;
    }

    // STILL: stop the loop (it draws a crisp full-res frame), else coalesce a draw.
    if (rafRef.current != null) {
      stopAnim();
      return;
    }
    if (sig(state) !== lastSig.current) scheduleDraw();
  }, [state, draw, scheduleDraw, startAnim, stopAnim]);

  // ── Drag-to-move text on canvas ───────────────────────────────────────────
  // The canvas is now the ACTIVE FORMAT's aspect (backing store == frame), and
  // the type box is reported in frame space, so pointer coords map directly to
  // [0,1] of the frame — accurate in every format with no crop math.
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

  // Active delivery format — the square render is shown via object-cover inside a
  // frame of this aspect ratio. The <section> is a SIZE CONTAINER, so we size the
  // frame against the stage's OWN box (container-query units) rather than the
  // viewport: width is capped three ways so it always fits without breaking the
  // ratio — the stage width (100cqw), the stage height (100cqh × aspect, minus a
  // small reserve for the caption row below), and a hard 760px ceiling. Because
  // this tracks the real stage box, the art fits perfectly whether the mobile
  // dock is expanded or collapsed, with no viewport-height guesswork.
  const fmt = getFormat(state.format);
  const aspect = fmt.w / fmt.h;
  const frameStyle: React.CSSProperties = {
    aspectRatio: `${fmt.w} / ${fmt.h}`,
    width: `min(100cqw, calc((100cqh - 2.5rem) * ${aspect}), 760px)`,
  };

  return (
    <section className="flex min-h-0 min-w-0 flex-1 flex-col items-center justify-start gap-2.5 overflow-hidden bg-[radial-gradient(circle_at_50%_38%,#121215,#0a0a0b_72%)] px-3 pt-14 pb-2 [container-type:size] sm:gap-[18px] sm:px-8 md:justify-center md:pt-16 md:pb-8">
      <div
        className="relative overflow-hidden bg-black shadow-[0_30px_80px_rgba(0,0,0,0.65),0_0_0_1px_#1c1c20] transition-[width,height] duration-300 ease-out"
        style={frameStyle}
      >
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
        {fmt.w} × {fmt.h} px&nbsp;&nbsp;·&nbsp;&nbsp;{fmt.label}&nbsp;{fmt.ratio}
        &nbsp;&nbsp;·&nbsp;&nbsp;Seed&nbsp;{state.seed >>> 0}
      </div>
    </section>
  );
}
