import { renderTo, resolveMood } from "@/engine";
import type { Mood } from "@/engine";
import { renderParams, type StudioState } from "@/lib/store";
import { ensureCoverFont } from "@/lib/fonts";
import { coverCrop, getFormat, type Format } from "@/lib/formats";

// Render the square art at `side`px then cover-crop it into `dest` (whose width/
// height must already be set to the target format size). Shared by the live
// bento previews and the export path so what you see is what you download.
export function paintFormat(
  dest: HTMLCanvasElement,
  side: number,
  f: Format,
  params: Record<string, unknown>,
): void {
  const ctx = dest.getContext("2d");
  if (!ctx) return;
  // Square render is the engine's native output; fast-path it with no crop.
  if (f.w === f.h && side === f.w) {
    renderTo(dest, side, params);
    return;
  }
  const off = document.createElement("canvas");
  off.width = side;
  off.height = side;
  renderTo(off, side, params);
  const { sx, sy, sw, sh } = coverCrop(side, f);
  ctx.clearRect(0, 0, dest.width, dest.height);
  ctx.drawImage(off, sx, sy, sw, sh, 0, 0, dest.width, dest.height);
}

// ── PNG export for a given format (offscreen square render -> cover-crop -> download) ─
export function exportFormat(
  state: StudioState,
  f: Format,
  done: () => void,
): void {
  const go = () => {
    try {
      // Render the square at the format's LONGEST edge so the cropped result is
      // full-resolution on every axis.
      const side = Math.max(f.w, f.h);
      const dest = document.createElement("canvas");
      dest.width = f.w;
      dest.height = f.h;
      paintFormat(dest, side, f, renderParams(state));
      dest.toBlob((blob) => {
        if (!blob) {
          done();
          return;
        }
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        const mood: Mood = resolveMood(
          state.seed >>> 0,
          state.mood as Mood | "random",
        );
        // Square keeps the legacy name; other formats append their id.
        const suffix = f.id === "square" ? "" : `_${f.id}`;
        a.href = url;
        a.download = `albumart_${mood}_${state.seed >>> 0}${suffix}.png`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 3000);
        done();
      }, "image/png");
    } catch (err) {
      console.error(err);
      done();
    }
  };
  // Make sure the chosen cover font is downloaded before rendering (canvas can't
  // paint a web font the browser hasn't fetched).
  ensureCoverFont(state.textFont).then(() => requestAnimationFrame(go));
}

// Still PNG export of the currently-active format (used by the sidebar button).
export function exportPng(state: StudioState, done: () => void): void {
  exportFormat(state, getFormat(state.format), done);
}

// ── Video export (MediaRecorder over the live animated canvas) ───────────────
export function exportVideo(
  canvas: HTMLCanvasElement,
  state: StudioState,
  done: () => void,
): void {
  if (!canvas.captureStream) {
    done();
    return;
  }
  setTimeout(() => {
    const stream = canvas.captureStream(30);
    let mime = "video/webm";
    const want = [
      "video/mp4;codecs=h264",
      "video/mp4",
      "video/webm;codecs=vp9",
      "video/webm",
    ];
    if (typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported) {
      for (const w of want) {
        if (MediaRecorder.isTypeSupported(w)) {
          mime = w;
          break;
        }
      }
    }
    let rec: MediaRecorder;
    try {
      rec = new MediaRecorder(stream, { mimeType: mime });
    } catch {
      try {
        rec = new MediaRecorder(stream);
        mime = "video/webm";
      } catch {
        done();
        return;
      }
    }
    const ext = mime.indexOf("mp4") >= 0 ? "mp4" : "webm";
    const chunks: Blob[] = [];
    rec.ondataavailable = (e) => {
      if (e.data && e.data.size) chunks.push(e.data);
    };
    rec.onstop = () => {
      const blob = new Blob(chunks, { type: mime.split(";")[0] });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `akacovart_${state.seed >>> 0}.${ext}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 4000);
      done();
    };
    rec.start();
    setTimeout(() => {
      try {
        rec.stop();
      } catch {
        /* ignore */
      }
    }, 6200);
  }, 60);
}
