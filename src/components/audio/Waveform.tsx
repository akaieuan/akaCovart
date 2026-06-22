"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { audioSession, transport } from "@/audio";
import { useStudio, maxClipSeconds } from "@/lib/store";

// Theme greys (resolved literals so the canvas paints without CSS vars).
const C_TRACK = "#3a3a3a"; // unselected peaks
const C_WINDOW = "#c8c8c8"; // selected-window peaks
const C_HANDLE = "#f2f2f2"; // trim handles
const C_PLAYHEAD = "#ffffff"; // playhead line
const C_SHADE = "rgba(220,220,220,0.06)"; // window backing wash

const HANDLE_W = 8; // px visual width of each trim handle
const HANDLE_HIT = 9; // px half-zone around each edge that resizes (vs. moves)

type DragKind = "left" | "right" | "body" | null;
// What a pointer at a given x would do — drives both hit-testing and the cursor.
type HitZone = "left" | "right" | "body" | "outside";

/**
 * Waveform — custom retina canvas of the decoded track peaks.
 *
 * Draws the full track (grey), brightens the selected [clipStart, clipEnd]
 * window, and renders draggable left/right trim handles plus a live playhead
 * line driven by transport.currentTime. Pointer drags update clipStart/clipEnd
 * in the store: edge handles resize, and dragging the highlighted band body
 * moves the whole window (start + end together) along the track. The window
 * length is clamped to the active clip length. The actual offline re-analysis is
 * owned by AudioPanel (it watches the window) — this only edits the window.
 */
export default function Waveform({
  onScrub,
}: {
  // Notify the parent that the user finished a drag (so it can debounce-analyze).
  onScrub?: () => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  const audioDuration = useStudio((s) => s.audioDuration);
  const clipStart = useStudio((s) => s.clipStart);
  const clipEnd = useStudio((s) => s.clipEnd);
  const clipLength = useStudio((s) => s.clipLength);
  const audioPlaying = useStudio((s) => s.audioPlaying);
  const setClip = useStudio((s) => s.setClip);

  const drag = useRef<DragKind>(null);
  const dragGrab = useRef(0); // for "body": offset (s) from clipStart to grab point
  // Cursor hint when not dragging: grab over the band body, ew-resize over edges.
  const [hoverZone, setHoverZone] = useState<HitZone>("outside");

  // ── Drawing ────────────────────────────────────────────────────────────────
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const cssW = wrap.clientWidth;
    const cssH = wrap.clientHeight;
    if (cssW === 0 || cssH === 0) return;

    // Keep backing store crisp on retina.
    const bw = Math.round(cssW * dpr);
    const bh = Math.round(cssH * dpr);
    if (canvas.width !== bw || canvas.height !== bh) {
      canvas.width = bw;
      canvas.height = bh;
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, cssW, cssH);

    const peaks = audioSession.peaks;
    const dur = audioDuration > 0 ? audioDuration : 0;
    const mid = cssH / 2;

    const xForTime = (t: number) => (dur > 0 ? (t / dur) * cssW : 0);
    const sx = xForTime(clipStart);
    const ex = xForTime(clipEnd);

    // Window backing wash.
    if (dur > 0) {
      ctx.fillStyle = C_SHADE;
      ctx.fillRect(sx, 0, Math.max(0, ex - sx), cssH);
    }

    if (peaks && peaks.length > 0 && dur > 0) {
      const n = peaks.length;
      // One vertical bar per device-independent pixel column.
      for (let px = 0; px < cssW; px++) {
        const pi = Math.min(n - 1, Math.floor((px / cssW) * n));
        const amp = peaks[pi];
        const h = Math.max(0.5, amp * (cssH * 0.46));
        const inWindow = px >= sx && px <= ex;
        ctx.fillStyle = inWindow ? C_WINDOW : C_TRACK;
        ctx.fillRect(px, mid - h, 1, h * 2);
      }
    } else if (dur > 0) {
      // No peaks yet: faint baseline.
      ctx.fillStyle = C_TRACK;
      ctx.fillRect(0, mid - 0.5, cssW, 1);
    }

    // Trim handles.
    if (dur > 0) {
      ctx.fillStyle = C_HANDLE;
      ctx.fillRect(sx - HANDLE_W / 2, 0, HANDLE_W, cssH);
      ctx.fillRect(ex - HANDLE_W / 2, 0, HANDLE_W, cssH);
      // Notch grips.
      ctx.fillStyle = C_TRACK;
      for (const hx of [sx, ex]) {
        ctx.fillRect(hx - 0.5, mid - 6, 1, 12);
      }
    }

    // Playhead (clip-relative -> absolute track time).
    if (dur > 0 && transport.clipDuration > 0) {
      const phAbs = clipStart + transport.currentTime;
      const phx = xForTime(phAbs);
      ctx.fillStyle = C_PLAYHEAD;
      ctx.fillRect(phx - 0.5, 0, 1, cssH);
    }
  }, [audioDuration, clipStart, clipEnd]);

  // Repaint on state changes + container resize.
  useEffect(() => {
    draw();
    const wrap = wrapRef.current;
    if (!wrap || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => draw());
    ro.observe(wrap);
    return () => ro.disconnect();
  }, [draw]);

  // Animate the playhead while playing.
  useEffect(() => {
    if (!audioPlaying) {
      draw();
      return;
    }
    let raf = 0;
    const tick = () => {
      draw();
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [audioPlaying, draw]);

  // ── Pointer interaction ──────────────────────────────────────────────────
  const timeAtClientX = (clientX: number): number => {
    const wrap = wrapRef.current;
    if (!wrap || audioDuration <= 0) return 0;
    const rect = wrap.getBoundingClientRect();
    const frac = (clientX - rect.left) / rect.width;
    return Math.max(0, Math.min(audioDuration, frac * audioDuration));
  };

  // Classify a client-x position: edge handle (resize) > band body (move) >
  // outside. Handle zones win over the body so the edges of a narrow window
  // stay resizable rather than being swallowed by the move region.
  const zoneAtClientX = (clientX: number): HitZone => {
    const wrap = wrapRef.current;
    if (!wrap || audioDuration <= 0) return "outside";
    const rect = wrap.getBoundingClientRect();
    const pxPerSec = rect.width / audioDuration;
    const sx = clipStart * pxPerSec;
    const ex = clipEnd * pxPerSec;
    const x = clientX - rect.left;
    if (Math.abs(x - sx) <= HANDLE_HIT) return "left";
    if (Math.abs(x - ex) <= HANDLE_HIT) return "right";
    if (x > sx && x < ex) return "body";
    return "outside";
  };

  const onPointerDown = (e: React.PointerEvent) => {
    if (audioDuration <= 0) return;
    const zone = zoneAtClientX(e.clientX);

    let kind: DragKind;
    if (zone === "left" || zone === "right") {
      kind = zone;
    } else if (zone === "body") {
      kind = "body";
      dragGrab.current = timeAtClientX(e.clientX) - clipStart;
    } else {
      // Click outside the window: move the nearer handle to the click point.
      const t = timeAtClientX(e.clientX);
      kind = Math.abs(t - clipStart) < Math.abs(t - clipEnd) ? "left" : "right";
    }

    drag.current = kind;
    (e.target as Element).setPointerCapture?.(e.pointerId);
    e.preventDefault();
    handleDragMove(e.clientX);
  };

  const handleDragMove = (clientX: number) => {
    const kind = drag.current;
    if (!kind) return;
    const t = timeAtClientX(clientX);

    if (kind === "left") {
      setClip(Math.min(t, clipEnd - 0.05), clipEnd);
    } else if (kind === "right") {
      setClip(clipStart, Math.max(t, clipStart + 0.05));
    } else if (kind === "body") {
      // Move the whole window: shift start + end together, clamped to the track.
      const span = clipEnd - clipStart;
      let ns = t - dragGrab.current;
      ns = Math.max(0, Math.min(ns, audioDuration - span));
      setClip(ns, ns + span);
    }
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (drag.current) {
      handleDragMove(e.clientX);
      return;
    }
    // Idle hover: update the cursor hint without committing any edit.
    const z = zoneAtClientX(e.clientX);
    setHoverZone((prev) => (prev === z ? prev : z));
  };

  const endDrag = (e: React.PointerEvent) => {
    if (!drag.current) return;
    drag.current = null;
    (e.target as Element).releasePointerCapture?.(e.pointerId);
    onScrub?.();
  };

  const span = Math.max(0, clipEnd - clipStart);
  const maxLen = maxClipSeconds(clipLength, audioDuration);
  const atMax = clipLength !== "full" && span >= maxLen - 0.01;

  // Cursor: grabbing while moving the body, ew-resize over/while-dragging edges,
  // grab over the band body at rest, pointer (scrub) elsewhere.
  const activeZone: HitZone =
    drag.current === "body"
      ? "body"
      : drag.current === "left" || drag.current === "right"
        ? drag.current
        : hoverZone;
  const cursor =
    activeZone === "left" || activeZone === "right"
      ? "ew-resize"
      : activeZone === "body"
        ? drag.current === "body"
          ? "grabbing"
          : "grab"
        : "pointer";

  return (
    <div className="select-none">
      <div
        ref={wrapRef}
        className="relative h-[76px] w-full rounded-[4px] border border-grey-800 bg-grey-880"
        style={{ cursor }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onPointerLeave={() => {
          if (!drag.current) setHoverZone("outside");
        }}
      >
        <canvas
          ref={canvasRef}
          className="absolute inset-0 h-full w-full touch-none"
        />
      </div>
      <div className="mt-[6px] flex items-center justify-between font-sans text-[11px] text-grey-400">
        <span>{fmt(clipStart)}</span>
        <span className={atMax ? "text-grey-200" : "text-grey-350"}>
          {span.toFixed(1)}s window{atMax ? " · max" : ""}
          <span className="text-grey-450"> · </span>
          {fmt(clipStart)}
          <span className="text-grey-450">→</span>
          {fmt(clipEnd)}
        </span>
        <span>{fmt(clipEnd)}</span>
      </div>
    </div>
  );
}

function fmt(t: number): string {
  if (!isFinite(t) || t < 0) t = 0;
  const m = Math.floor(t / 60);
  const s = Math.floor(t % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}
