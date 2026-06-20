"use client";

import { useEffect, useRef } from "react";
import CanvasStage from "./CanvasStage";
import ControlPanel from "./ControlPanel";
import { useStudio } from "@/lib/store";
import { exportPng, exportVideo } from "@/lib/export";

export default function Studio() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Randomize seed + gallery after hydration (initial values are deterministic
  // to avoid an SSR/client mismatch). Gives fresh art on every load.
  useEffect(() => {
    const s = useStudio.getState();
    s.newSeed();
    s.rerollGallery();
  }, []);

  const handleExport = () => {
    const s = useStudio.getState();
    if (s.mode === "animate") {
      if (s.recording) return;
      const c = canvasRef.current;
      if (!c) return;
      s.setState({ recording: true });
      exportVideo(c, s, () =>
        useStudio.getState().setState({ recording: false }),
      );
    } else {
      if (s.rendering) return;
      s.setState({ rendering: true });
      exportPng(useStudio.getState(), () =>
        useStudio.getState().setState({ rendering: false }),
      );
    }
  };

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-bg text-ink">
      {/* Header */}
      <header className="flex flex-none items-center border-b border-border px-[22px] py-[14px]">
        <span className="inline-flex items-baseline">
          <span className="font-mono text-[15px] font-light tracking-[0.3em] text-[#7d7d83]">
            aka
          </span>
          <span className="font-mono text-[15px] font-semibold tracking-[0.3em] text-[#f0f0f2]">
            COVART
          </span>
        </span>
      </header>

      {/* App */}
      <main className="flex min-h-0 flex-1">
        <CanvasStage canvasRef={canvasRef} />
        <ControlPanel onExport={handleExport} />
      </main>
    </div>
  );
}
