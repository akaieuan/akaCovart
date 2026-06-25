import { renderFormatTo, resolveMood } from "@/engine";
import type { Mood } from "@/engine";
import { renderParams, type StudioState } from "@/lib/store";
import { ensureCoverFont } from "@/lib/fonts";
import { getFormat, type Format } from "@/lib/formats";

// ── PNG export for a given format ────────────────────────────────────────────
// renderFormatTo handles the square render -> cover-crop -> frame-space type, so
// the exported file matches what the editor shows for that format exactly.
export function exportFormat(
  state: StudioState,
  f: Format,
  done: () => void,
): void {
  const go = () => {
    try {
      const dest = document.createElement("canvas");
      dest.width = f.w;
      dest.height = f.h;
      renderFormatTo(dest, renderParams(state));
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
    // Record an INTEGER number of resolve-cycles so the loop is seamless: the TxT
    // engines return to their still every cycle (loopPhase wraps), so recording
    // whole cycles means the first and last frames match. (Art engines get a
    // beat-aligned length too — their abstract drift may still seam slightly.)
    const bps = (state.animBPM || 128) / 60;
    const loopBeats = Math.max(1, Math.round(0.5 + ((state.txtLoopBeats ?? 20) / 100) * 7.5));
    const cycleSec = loopBeats / bps;
    const nCycles = Math.max(1, Math.round(6 / cycleSec));
    const durationMs = Math.round(nCycles * cycleSec * 1000);
    rec.start();
    setTimeout(() => {
      try {
        rec.stop();
      } catch {
        /* ignore */
      }
    }, durationMs);
  }, 60);
}
