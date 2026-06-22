"use client";

// ─────────────────────────────────────────────────────────────────────────────
// WebGLStage — the ONLY module that imports three / @react-three/fiber.
//
// This file is reached exclusively through a `next/dynamic` import with
// { ssr: false } (see Stage.tsx), so three never runs on the server or during
// the static-export prerender. The 2D render path does not touch this file.
//
// P2 scope: a deformable "liquid" 3D shape system.
//   • Selectable primitive geometry (sphere / icosahedron / tetrahedron / cube /
//     octahedron / prism), subdivided enough that vertex displacement is smooth.
//   • A custom ShaderMaterial whose VERTEX shader melts the surface along its
//     normals using fbm (fractal simplex) noise sampled from position + uTime +
//     a seeded offset, so ANY shape breathes/liquefies in 3D. Normals are
//     re-derived in-shader (tetrahedral gradient) so lighting stays correct.
//   • A FRAGMENT shader with soft lambert + a fresnel rim, coloured from the
//     akaCOVART palette for the resolved mood (seed picks the colours + offset).
//   • Motion is FLICKER-FREE and fps-independent (driven by useFrame delta):
//     continuous rotation, liquid churn over uTime, and — in "animate" mode —
//     an eased beat squash + displacement pulse derived from animBPM (matching
//     the 2D engines' attack-decay + damped-spring envelopes). Motion only ever
//     drives SPACE (scale / displacement / rotation) — never brightness, opacity
//     or hue. Live params are read via useStudio.getState() inside useFrame so
//     the render loop never triggers React re-renders.
//
// WebGL2 support is feature-detected; if unavailable we render a small fallback
// message instead of crashing.
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useMemo, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import {
  BoxGeometry,
  CylinderGeometry,
  IcosahedronGeometry,
  OctahedronGeometry,
  TetrahedronGeometry,
  type BufferGeometry,
  type Mesh,
  type ShaderMaterial,
} from "three";

import { palettes, prng, resolveMood, transformPalette } from "@/engine";
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

// ── Geometry factory ─────────────────────────────────────────────────────────
// Returns a primitive geometry, subdivided enough that vertex displacement looks
// smooth. `detail` (0..100) scales subdivision within each shape's safe range.
// Spheres/icosa/tetra/octa take a subdivision count; box/prism take per-axis
// segment counts. The geometry is rebuilt only when shape/detail change.
function makeGeometry(shape: string, detail: number): BufferGeometry {
  const d = Math.max(0, Math.min(1, detail / 100));
  switch (shape) {
    case "icosahedron":
      // detail 0..1 -> subdivision 3..7 (smooth enough to displace nicely).
      return new IcosahedronGeometry(1.15, 3 + Math.round(d * 4));
    case "tetrahedron":
      return new TetrahedronGeometry(1.4, 4 + Math.round(d * 4));
    case "octahedron":
      return new OctahedronGeometry(1.3, 4 + Math.round(d * 4));
    case "cube": {
      // Box needs many per-face segments so vertices can be displaced smoothly.
      const seg = 24 + Math.round(d * 40);
      return new BoxGeometry(1.7, 1.7, 1.7, seg, seg, seg);
    }
    case "prism": {
      // Low radial-segment cylinder reads as a faceted prism; height segments
      // let the sides melt. radialSegments stays low for the prism silhouette.
      const heightSeg = 24 + Math.round(d * 48);
      return new CylinderGeometry(1.15, 1.15, 2.2, 6, heightSeg, false);
    }
    case "sphere":
    default:
      // A subdivided icosphere — uniform vertex density, no pole pinching.
      return new IcosahedronGeometry(1.2, 4 + Math.round(d * 3));
  }
}

// ── Shaders ──────────────────────────────────────────────────────────────────
// Public-domain 3D simplex noise (Ashima Arts / Stefan Gustavson, McEwan et al.),
// used to build fbm. Shared GLSL prelude injected into the vertex shader so the
// displacement and the gradient-normal both sample the same field.
const NOISE_GLSL = /* glsl */ `
vec4 mod289(vec4 x){return x-floor(x*(1.0/289.0))*289.0;}
vec3 mod289(vec3 x){return x-floor(x*(1.0/289.0))*289.0;}
vec4 permute(vec4 x){return mod289(((x*34.0)+1.0)*x);}
vec4 taylorInvSqrt(vec4 r){return 1.79284291400159-0.85373472095314*r;}

float snoise(vec3 v){
  const vec2 C=vec2(1.0/6.0,1.0/3.0);
  const vec4 D=vec4(0.0,0.5,1.0,2.0);
  vec3 i=floor(v+dot(v,C.yyy));
  vec3 x0=v-i+dot(i,C.xxx);
  vec3 g=step(x0.yzx,x0.xyz);
  vec3 l=1.0-g;
  vec3 i1=min(g.xyz,l.zxy);
  vec3 i2=max(g.xyz,l.zxy);
  vec3 x1=x0-i1+C.xxx;
  vec3 x2=x0-i2+C.yyy;
  vec3 x3=x0-D.yyy;
  i=mod289(i);
  vec4 p=permute(permute(permute(
        i.z+vec4(0.0,i1.z,i2.z,1.0))
      + i.y+vec4(0.0,i1.y,i2.y,1.0))
      + i.x+vec4(0.0,i1.x,i2.x,1.0));
  float n_=0.142857142857;
  vec3 ns=n_*D.wyz-D.xzx;
  vec4 j=p-49.0*floor(p*ns.z*ns.z);
  vec4 x_=floor(j*ns.z);
  vec4 y_=floor(j-7.0*x_);
  vec4 x=x_*ns.x+ns.yyyy;
  vec4 y=y_*ns.x+ns.yyyy;
  vec4 h=1.0-abs(x)-abs(y);
  vec4 b0=vec4(x.xy,y.xy);
  vec4 b1=vec4(x.zw,y.zw);
  vec4 s0=floor(b0)*2.0+1.0;
  vec4 s1=floor(b1)*2.0+1.0;
  vec4 sh=-step(h,vec4(0.0));
  vec4 a0=b0.xzyw+s0.xzyw*sh.xxyy;
  vec4 a1=b1.xzyw+s1.xzyw*sh.zzww;
  vec3 p0=vec3(a0.xy,h.x);
  vec3 p1=vec3(a0.zw,h.y);
  vec3 p2=vec3(a1.xy,h.z);
  vec3 p3=vec3(a1.zw,h.w);
  vec4 norm=taylorInvSqrt(vec4(dot(p0,p0),dot(p1,p1),dot(p2,p2),dot(p3,p3)));
  p0*=norm.x;p1*=norm.y;p2*=norm.z;p3*=norm.w;
  vec4 m=max(0.6-vec4(dot(x0,x0),dot(x1,x1),dot(x2,x2),dot(x3,x3)),0.0);
  m=m*m;
  return 42.0*dot(m*m,vec4(dot(p0,x0),dot(p1,x1),dot(p2,x2),dot(p3,x3)));
}

// Fractal Brownian motion — a few octaves of simplex for a liquid surface.
float fbm(vec3 p){
  float a=0.5;
  float f=0.0;
  for(int i=0;i<4;i++){
    f+=a*snoise(p);
    p*=2.02;
    a*=0.5;
  }
  return f;
}
`;

const VERTEX_SHADER = /* glsl */ `
uniform float uTime;
uniform float uSeedOffset;
uniform float uLiquid;   // displacement amount (0..~0.5)
uniform float uDetail;   // base noise frequency
uniform float uPulse;    // extra beat displacement (0..~0.5)
uniform float uChurn;    // churn speed multiplier (>=0)

varying vec3 vNormalW;
varying vec3 vViewW;
varying float vDisp;     // signed displacement, for subtle shading variation

${NOISE_GLSL}

// Displacement field sampled at an arbitrary position, used both for the actual
// vertex push and (at small offsets) for re-deriving the normal.
float displaceAt(vec3 pos){
  vec3 sp = pos * uDetail + vec3(uSeedOffset);
  float t = uTime * (0.35 + 0.65 * uChurn);
  // Two scrolling fbm layers melt the surface; phase offset keeps it lively.
  float n = fbm(sp + vec3(0.0, t, 0.0));
  n += 0.5 * fbm(sp * 1.9 - vec3(t * 0.7, 0.0, t * 0.5));
  return n;
}

void main(){
  vec3 pos = position;
  float amp = uLiquid + uPulse;
  float disp = displaceAt(pos) * amp;

  // Re-derive the normal by sampling the field at tetrahedral offsets around the
  // vertex (gradient of the displaced surface) so lighting follows the melt.
  float eps = 0.18;
  vec3 e1 = vec3(eps, -eps, -eps);
  vec3 e2 = vec3(-eps, -eps, eps);
  vec3 e3 = vec3(-eps, eps, -eps);
  vec3 e4 = vec3(eps, eps, eps);
  vec3 grad = normalize(
      e1 * (displaceAt(pos + e1) * amp)
    + e2 * (displaceAt(pos + e2) * amp)
    + e3 * (displaceAt(pos + e3) * amp)
    + e4 * (displaceAt(pos + e4) * amp)
  );
  // Blend the base normal with the displacement gradient for a stable, melted
  // normal that still respects the underlying shape's facets.
  vec3 n = normalize(normal - grad * 1.4);

  vec3 displaced = pos + normal * disp;

  vec4 mvPosition = modelViewMatrix * vec4(displaced, 1.0);
  vNormalW = normalize(normalMatrix * n);
  vViewW = -normalize(mvPosition.xyz);
  vDisp = disp;

  gl_Position = projectionMatrix * mvPosition;
}
`;

const FRAGMENT_SHADER = /* glsl */ `
precision highp float;

uniform vec3 uBaseColor;
uniform vec3 uAccentColor;
uniform float uShade;   // rim / shadow strength (0..1)

varying vec3 vNormalW;
varying vec3 vViewW;
varying float vDisp;

void main(){
  vec3 N = normalize(vNormalW);
  vec3 V = normalize(vViewW);

  // Soft lambert from a fixed key direction (view space) + ambient floor.
  vec3 L = normalize(vec3(0.45, 0.7, 0.6));
  float lambert = max(dot(N, L), 0.0);
  float ambient = 0.35;
  float diffuse = ambient + (1.0 - ambient) * lambert;

  // Fresnel rim — brightest at grazing angles. Strength rides uShade.
  float fres = pow(1.0 - max(dot(N, V), 0.0), 3.0);
  float rim = fres * (0.35 + 0.65 * uShade);

  // Mix base -> accent by surface orientation + a touch of displacement so the
  // melt subtly reveals the accent colour. (Space-driven, no hue strobing.)
  float mixv = clamp(0.5 + 0.5 * lambert + vDisp * 0.4, 0.0, 1.0);
  vec3 base = mix(uBaseColor, uAccentColor, mixv);

  // Soft ambient-occlusion-ish darkening in the troughs, scaled by shade.
  float shadow = 1.0 - uShade * 0.35 * (1.0 - lambert);

  vec3 col = base * diffuse * shadow + uAccentColor * rim;
  gl_FragColor = vec4(col, 1.0);
}
`;

// ── Beat envelopes (mirrors src/engine/render.ts buildAnim) ──────────────────
// Continuous beat phase in [0,1) wraps each beat; kickEnv is a calm attack-decay
// pulse, kickSpring is a signed damped bounce. These drive SPACE only.
function beatEnvelopes(rt: number, bpm: number) {
  const bps = (bpm || 128) / 60;
  const beat = (rt * bps) % 1;
  const kickEnv = Math.pow(1 - beat, 3.4);
  const kickSpring = Math.exp(-3.2 * beat) * Math.cos(2 * Math.PI * 1.6 * beat);
  const pumpEnv = Math.pow(1 - beat, 2.0);
  return { kickEnv, kickSpring, pumpEnv };
}

// ── The liquid mesh ──────────────────────────────────────────────────────────
function LiquidShape({
  geometry,
  baseColor,
  accentColor,
  seedOffset,
}: {
  geometry: BufferGeometry;
  baseColor: [number, number, number];
  accentColor: [number, number, number];
  seedOffset: number;
}) {
  const meshRef = useRef<Mesh>(null);
  const matRef = useRef<ShaderMaterial>(null);

  // Continuous, fps-independent clocks. `rt` is wall-clock time for the beat
  // phase; `flow` accumulates churn-scaled time for the noise field. Stored in a
  // ref so the render loop never re-renders React.
  const clock = useRef({ rt: 0, flow: 0 });

  // Uniforms object — created once; values are mutated each frame in useFrame.
  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uSeedOffset: { value: seedOffset },
      uLiquid: { value: 0.18 },
      uDetail: { value: 1.4 },
      uShade: { value: 0.55 },
      uPulse: { value: 0 },
      uChurn: { value: 0.5 },
      uBaseColor: { value: baseColor },
      uAccentColor: { value: accentColor },
    }),
    // Rebuild only when the deterministic inputs change (seed / palette pick).
    [seedOffset, baseColor, accentColor],
  );

  useFrame((_state, delta) => {
    const mesh = meshRef.current;
    const mat = matRef.current;
    if (!mesh || !mat) return;

    // Clamp delta so a tab-restore / long frame can't fling the motion.
    const dt = Math.min(delta, 0.05);

    // Live params — read imperatively so slider/beat changes never re-render.
    const s = useStudio.getState();
    const liquid = (s.orb3dLiquid ?? 45) / 100;
    const detail = (s.orb3dDetail ?? 50) / 100;
    const rotate = (s.orb3dRotate ?? 35) / 100;
    const shade = (s.orb3dShade ?? 55) / 100;
    const pulseAmt = (s.orb3dPulse ?? 55) / 100;
    const wobbleAmt = (s.orb3dWobble ?? 45) / 100;
    const animate = s.mode === "animate";

    const c = clock.current;
    c.rt += dt;

    // CHURN — liquid time advances faster with detail so finer shapes ripple
    // quicker. Accumulated (not absolute) so changing detail never snaps phase.
    const churn = 0.4 + 0.9 * detail;
    c.flow += dt * churn;

    // Beat reactivity (animate mode only). Eased envelopes -> a squash/scale and
    // an extra displacement pulse; idle otherwise. SPACE-only, so no flicker.
    let squash = 0;
    let pulse = 0;
    let extraSpin = 0;
    if (animate) {
      const { kickEnv, kickSpring, pumpEnv } = beatEnvelopes(c.rt, s.animBPM ?? 128);
      // Squash-and-stretch on the kick (signed spring -> overshoot/settle).
      squash = pulseAmt * kickSpring * 0.16;
      // Extra surface displacement pulse on the beat — melts harder, then eases.
      pulse = (kickEnv * 0.22 + pumpEnv * 0.1) * pulseAmt;
      // A little rotational kick so the spin feels driven by the beat.
      extraSpin = kickEnv * pulseAmt * 0.6;
    }

    // Map detail -> base noise frequency (calmer at low detail, busier at high).
    const freq = 0.9 + detail * 2.6;
    // Idle wobble — a slow surface breathing even when not on the beat.
    const idleWobble = wobbleAmt * 0.06 * Math.sin(c.rt * 1.3);

    // Push uniforms (mutate in place — no new objects per frame).
    mat.uniforms.uTime.value = c.flow;
    mat.uniforms.uDetail.value = freq;
    mat.uniforms.uLiquid.value = Math.max(0, liquid * 0.42 + idleWobble);
    mat.uniforms.uPulse.value = pulse;
    mat.uniforms.uShade.value = shade;
    mat.uniforms.uChurn.value = churn;

    // ROTATION — continuous, delta-stepped (fps-independent). Always allow a
    // very slow idle turn when Rotate > 0, even in still mode.
    const spin = (0.05 + rotate * 0.7) * dt + extraSpin * dt * 8.0;
    mesh.rotation.y += spin;
    mesh.rotation.x += spin * 0.35;

    // BEAT SQUASH — volume-preserving-ish scale on the mesh transform.
    const sx = 1 + squash;
    const sy = 1 - squash * 0.85;
    mesh.scale.set(sx, sy, sx);
  });

  return (
    <mesh ref={meshRef} geometry={geometry}>
      <shaderMaterial
        ref={matRef}
        uniforms={uniforms}
        vertexShader={VERTEX_SHADER}
        fragmentShader={FRAGMENT_SHADER}
      />
    </mesh>
  );
}

export default function WebGLStage() {
  // Determinism: derive the palette tint + seeded noise offset from the resolved
  // mood + seed, mirroring how the 2D engines resolve their palette. The Color
  // controls (tone/hue/sat) are applied too, so the 3D shape sits in the same
  // recoloured world as the 2D engines.
  const seed = useStudio((s) => s.seed);
  const moodSel = useStudio((s) => s.mood);
  const shape = useStudio((s) => s.orb3dShape);
  const detail = useStudio((s) => s.orb3dDetail);
  const colorTone = useStudio((s) => s.colorTone);
  const colorHue = useStudio((s) => s.colorHue);
  const colorSat = useStudio((s) => s.colorSat);
  const bgMode = useStudio((s) => s.orb3dBg);

  const supported = useMemo(() => hasWebGL2(), []);

  // Rebuild geometry only when shape / detail change (not on a beat tick).
  const geometry = useMemo(() => makeGeometry(shape, detail), [shape, detail]);

  // Dispose the previous geometry's GPU buffers when it is replaced (shape /
  // detail change) and on unmount, so switching shapes doesn't leak VRAM.
  useEffect(() => {
    return () => {
      geometry.dispose();
    };
  }, [geometry]);

  const { baseColor, accentColor, bg, seedOffset } = useMemo(() => {
    const mood: Mood = resolveMood(seed, moodSel);
    const pal = transformPalette(palettes[mood], colorTone, colorHue, colorSat);
    // Deterministic colour picks + a seeded noise offset, all from one PRNG so
    // the same seed always yields the same look (no Math.random in the path).
    const r = prng((seed >>> 0) ^ 0x3da5f17b);
    const colors = pal.colors.length ? pal.colors : [pal.base];
    const accents = pal.accentColors.length ? pal.accentColors : colors;
    const base = colors[Math.floor(r() * colors.length)] ?? pal.base;
    const accent = accents[Math.floor(r() * accents.length)] ?? base;
    const off = r() * 100;
    // Backdrop: dark "studio" by default (matches the rest of the app), or the
    // palette base, or a light card — selectable via the Background control.
    const bgCol: number[] =
      bgMode === "palette"
        ? norm255(pal.base)
        : bgMode === "light"
          ? [0.906, 0.906, 0.918]
          : [0.039, 0.039, 0.043];
    return {
      baseColor: norm255(base),
      accentColor: norm255(accent),
      bg: bgCol,
      seedOffset: off,
    };
  }, [seed, moodSel, colorTone, colorHue, colorSat, bgMode]);

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
      {/* Backdrop — dark studio by default; Palette/Light selectable. */}
      <color attach="background" args={bg as [number, number, number]} />
      <LiquidShape
        geometry={geometry}
        baseColor={baseColor}
        accentColor={accentColor}
        seedOffset={seedOffset}
      />
    </Canvas>
  );
}
