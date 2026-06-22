"use client";

// ─────────────────────────────────────────────────────────────────────────────
// WebGLStage — the ONLY module that imports three / @react-three/fiber.
//
// This file is reached exclusively through a `next/dynamic` import with
// { ssr: false } (see Stage.tsx), so three never runs on the server or during
// the static-export prerender. The 2D render path does not touch this file.
//
// P0 scope: a slowly rotating sphere (icosahedron) with simple lighting, tinted
// from the akaCOVART palette and made deterministic by the store seed. WebGL2
// support is feature-detected; if unavailable we render a small fallback message
// instead of crashing.
// ─────────────────────────────────────────────────────────────────────────────

import { useMemo, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import type { Mesh } from "three";

import { palettes, resolveMood } from "@/engine";
import type { Mood } from "@/engine";
import { useStudio } from "@/lib/store";

// One-time WebGL2 capability probe. Runs only in the browser (this component is
// ssr:false), so `document` is always available here.
function hasWebGL2(): boolean {
  try {
    const canvas = document.createElement("canvas");
    return !!canvas.getContext("webgl2");
  } catch {
    return false;
  }
}

// Convert a palette rgb triple (0..255) to a normalized [r,g,b] for three.
function norm255(c: number[]): [number, number, number] {
  return [(c[0] ?? 0) / 255, (c[1] ?? 0) / 255, (c[2] ?? 0) / 255];
}

function RotatingOrb({ color }: { color: [number, number, number] }) {
  const ref = useRef<Mesh>(null);

  // Slow, steady rotation. Space-only motion (no brightness/opacity flicker),
  // matching the akaCOVART "no strobe" rule. delta keeps it fps-independent.
  useFrame((_state, delta) => {
    const m = ref.current;
    if (!m) return;
    m.rotation.y += delta * 0.35;
    m.rotation.x += delta * 0.12;
  });

  return (
    <mesh ref={ref}>
      {/* Icosahedron geometry with a couple of subdivisions for a smooth sphere. */}
      <icosahedronGeometry args={[1.15, 4]} />
      <meshStandardMaterial color={color} roughness={0.45} metalness={0.1} />
    </mesh>
  );
}

export default function WebGLStage() {
  // Determinism: derive the tint from the resolved mood + seed, mirroring how the
  // 2D engines resolve their palette. Subscribing to seed/mood re-tints on change.
  const seed = useStudio((s) => s.seed);
  const moodSel = useStudio((s) => s.mood);

  const supported = useMemo(() => hasWebGL2(), []);

  const { color, bg } = useMemo(() => {
    const mood: Mood = resolveMood(seed, moodSel);
    const pal = palettes[mood];
    // Deterministic colour pick from the palette's `colors` by seed.
    const idx = pal.colors.length
      ? (seed >>> 0) % pal.colors.length
      : 0;
    const c = pal.colors[idx] ?? pal.base;
    return { color: norm255(c), bg: norm255(pal.base) };
  }, [seed, moodSel]);

  if (!supported) {
    return (
      <div className="flex h-full w-full items-center justify-center px-6 text-center font-sans text-[12px] text-grey-400">
        WebGL2 is not available in this browser, so the 3D engine can’t run.
      </div>
    );
  }

  return (
    <Canvas
      // Cap device-pixel-ratio so high-DPR screens stay performant.
      dpr={[1, 2]}
      camera={{ position: [0, 0, 4], fov: 45 }}
      gl={{ antialias: true }}
      style={{ width: "100%", height: "100%", display: "block" }}
    >
      <color attach="background" args={bg} />
      <ambientLight intensity={0.55} />
      <pointLight position={[4, 5, 5]} intensity={120} />
      <pointLight position={[-6, -3, -4]} intensity={40} />
      <RotatingOrb color={color} />
    </Canvas>
  );
}
