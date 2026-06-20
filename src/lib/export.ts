import { renderTo, resolveMood } from "@/engine";
import type { Mood } from "@/engine";
import { renderParams, type StudioState } from "@/lib/store";

// ── PNG export at 3000² (offscreen renderTo -> toBlob -> download) ───────────
export function exportPng(
  state: StudioState,
  done: () => void,
): void {
  const go = () => {
    try {
      const S = 3000;
      const off = document.createElement("canvas");
      off.width = S;
      off.height = S;
      renderTo(off, S, renderParams(state));
      off.toBlob((blob) => {
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
        a.href = url;
        a.download = `albumart_${mood}_${state.seed >>> 0}.png`;
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
  if (typeof document !== "undefined" && document.fonts?.ready) {
    document.fonts.ready.then(() => requestAnimationFrame(go));
  } else {
    requestAnimationFrame(go);
  }
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
