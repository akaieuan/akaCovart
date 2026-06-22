export const meta = {
  name: 'akatool-audio-plan',
  description: 'Plan: WebGL/Three.js audio-reactive animations (mp3/wav -> 60s clip -> fluid consistent motion + synced video export)',
  phases: [
    { title: 'Research', detail: 'parallel: audio analysis, webgl audio-motion, clip+export, integration architecture' },
    { title: 'Synthesize', detail: 'cohesive opinionated plan' },
    { title: 'Critique', detail: 'adversarial gaps/risks' },
    { title: 'Finalize', detail: 'final plan + decisions + first slice' },
  ],
}

const ROOT = '/Users/ieuanking/Desktop/nuu/aka-covart'

const RESEARCH_SCHEMA = {
  type: 'object', additionalProperties: false,
  properties: {
    dimension: { type: 'string' },
    summary: { type: 'string' },
    recommendations: { type: 'array', items: { type: 'object', additionalProperties: false, properties: {
      title: { type: 'string' }, detail: { type: 'string' }, rationale: { type: 'string' }, confidence: { type: 'string', enum: ['high','medium','low'] } }, required: ['title','detail','rationale','confidence'] } },
    risks: { type: 'array', items: { type: 'string' } },
    openQuestions: { type: 'array', items: { type: 'string' } },
    sources: { type: 'array', items: { type: 'object', additionalProperties: false, properties: { title: { type:'string' }, url: { type:'string' } }, required: ['title','url'] } },
  },
  required: ['dimension','summary','recommendations','risks','openQuestions','sources'],
}

const CONTEXT = [
  'PROJECT: akaCOVART (akaTOOL) — a Next.js (App Router, static export) + Tailwind generative album-art studio. Generative core is a pure 2D <canvas> module in ' + ROOT + '/src/engine (FieldEngine plugins blob/grid/waves/orb + a registry, a seeded mulberry32 prng, palettes, a renderTo orchestrator, finish effects). State is a Zustand store (' + ROOT + '/src/lib/store.ts). The animate loop lives in ' + ROOT + '/src/components/CanvasStage.tsx (requestAnimationFrame; renderTo with _anim/_t/_rt). Export is in ' + ROOT + '/src/lib/export.ts (PNG via offscreen 3000^2; video via MediaRecorder).',
  'EXISTING MOTION PHILOSOPHY (must be preserved): beat-synced but FLICKER-FREE — motion drives SPACE only (scale/position/displacement/optical-depth), NEVER brightness/opacity/hue. AnimState already has eased primitives: continuous beat phase, kickEnv (attack-decay), kickSpring (damped bounce), pumpEnv (breathing). Per-engine MOTION params exist (orb spin/wobble/bounce/breath/churn; waves flow/swell/surge/churn/undulate; grid ripple/bob/pop/orbit/flow).',
  'GOALS NOW: (1) improve the animations and move toward Three.js + WebGL (GLSL) for more physical, fluid, TouchDesigner-core motion; (2) let the user load an MP3/WAV, select a 60-second clip, and drive the animation from that audio; (3) export a 60s video of the animation WITH the audio. CRITICAL non-functional requirement: animations must stay REALLY FLUID and CONSISTENT (smooth, reproducible, frame-rate-independent, identical in preview and export).',
  'A prior WebGL deep-dive already recommended: react-three-fiber v9 on WebGL2 (not vanilla three, not WebGPU yet), shaders kept modular; seed -> CPU prng -> baked uniforms for determinism; postprocessing (bloom/DOF/grain); export stills via WebGLRenderTarget readback and video via deterministic frame-stepping + WebCodecs. Build on that; do not re-litigate it unless you find a clearly better path.',
]

const webNote = 'Load web tools first via ToolSearch query "select:WebSearch,WebFetch", then verify CURRENT (mid-2026) library versions/APIs/browser support — do not rely on memory for versions. Cite sources (title + url).'

phase('Research')
const DIMS = [
  {
    key: 'audio-analysis',
    prompt: [
      'Research the AUDIO ANALYSIS pipeline for driving generative visuals from a user-supplied MP3/WAV, optimized for FLUID + CONSISTENT (reproducible, smooth) motion.',
      webNote,
      'Cover decisively:',
      '- Decoding mp3/wav in-browser (File -> ArrayBuffer -> AudioContext.decodeAudioData / OfflineAudioContext). wav vs mp3 gotchas.',
      '- REAL-TIME (AnalyserNode FFT, getByteFrequencyData/getFloatTimeDomainData) vs OFFLINE PRE-ANALYSIS (analyze the whole 60s clip once into a per-frame feature timeline). Argue strongly for which gives consistent, frame-rate-independent, reproducible motion suitable for BOTH live preview and deterministic video export. Explain the tradeoffs.',
      '- Feature extraction: overall energy/RMS/loudness, frequency bands (sub-bass/bass/low-mid/mid/high), spectral centroid/flux, and BEAT/ONSET detection (energy-based, spectral-flux onset, tempo/BPM estimation). Which features map best to physical motion.',
      '- SMOOTHING so motion is fluid: envelope followers (attack/release), exponential moving average, one-pole low-pass, peak-hold-with-decay; per-band smoothing constants. How to avoid jitter while staying responsive (and never causing flicker).',
      '- Building a sampleable timeline: e.g. compute features at a fixed analysis hop (say 60-120 Hz) into typed arrays, then sample/interp by time t so any render fps reads consistent values.',
      '- Libraries (verify current): meyda, web-audio-beat-detector, essentia.js, aubiojs, realtime-bpm-analyzer, wavesurfer.js — versions, license, size, what each is good for. Recommend a minimal stack.',
      '- Performance: keep analysis off the main thread (Web Worker / OfflineAudioContext), memory for 60s, decode time.',
      'Return structured findings.',
    ].join('\n'),
  },
  {
    key: 'webgl-audio-motion',
    prompt: [
      'Research the THREE.JS/WEBGL ANIMATION architecture to make audio-reactive motion REALLY FLUID and CONSISTENT, building on the prior WebGL brief (r3f v9 / WebGL2).',
      CONTEXT.join('\n'),
      webNote,
      'Cover decisively:',
      '- How to feed a pre-analyzed audio feature timeline into the render loop: sample features by the AUDIO clock (AudioContext.currentTime / a transport time), not the render frame index, so visuals stay locked to the music regardless of render fps. Decouple audio clock from render clock; handle pause/seek.',
      '- Driving shader UNIFORMS in useFrame WITHOUT React re-renders per frame (mutate material.uniforms.*.value). Frame-rate independence (use delta time / fixed timestep for the smoothing/springs so motion is identical at 30/60/120fps).',
      '- Mapping audio features -> the EXISTING eased motion primitives (kickEnv/kickSpring/pumpEnv + per-engine params) so beats/energy drive SPACE only (no flicker). Concrete per-engine mappings (orb bounce/breath from kick+bass; waves flow/surge from energy+onsets; grid ripple/pop from beats; blob).',
      '- Consistency: critically-damped springs (stable, no overshoot blowups), clamped feature ranges + normalization (so loud/quiet tracks behave), and a luminance-delta guardrail to keep it flicker-free.',
      '- Keeping it fluid at 60fps: GPU work in shaders, devicePixelRatio caps, avoiding GC in the loop, OffscreenCanvas/worker considerations.',
      '- Whether to migrate engines to WebGL now or run audio-reactivity on the existing 2D engines first; recommend a path that keeps fluidity.',
      'Return structured findings with concrete uniform/mapping sketches in detail fields.',
    ].join('\n'),
  },
  {
    key: 'clip-export',
    prompt: [
      'Research (A) the 60-SECOND CLIP SELECTION UX and (B) exporting a 60s VIDEO WITH AUDIO, synced and consistent.',
      webNote,
      'Cover:',
      '- Clip selection UI: waveform display + draggable trim handles to pick a 60s window; libraries (wavesurfer.js regions plugin, peaks.js) vs a custom canvas waveform from decoded peaks. Versions/size/license. Snapping, zoom, scrub/preview playback.',
      '- Synced video export options compared for mid-2026: (1) WebCodecs VideoEncoder + AudioEncoder + a muxer (mp4-muxer / webm-muxer / mediabunny) producing an MP4/WebM with both tracks — deterministic frame-stepping for video + encoding the clip audio; (2) MediaRecorder over canvas.captureStream() + an audio MediaStreamTrack (real-time, simpler, less precise). Recommend, with browser-support + codec/licensing notes (H.264/AAC vs VP9/Opus/AV1).',
      '- SYNC strategy: rendering each video frame at a known t and pulling audio features at the same t; muxing the exact 60s of source audio so audio and visuals line up; avoiding drift. Deterministic (offline) render of frames vs real-time capture.',
      '- Performance/memory for 60s: at what resolution/fps is in-browser export feasible (e.g. 1080p30 or 1440p30); chunked encoding; progress UI; expected file sizes; long-task/keepalive concerns.',
      '- Fallbacks where WebCodecs/AudioEncoder is unavailable.',
      'Return structured findings.',
    ].join('\n'),
  },
  {
    key: 'integration',
    prompt: [
      'Research how to INTEGRATE audio-reactivity + a Three.js/WebGL animation path into the EXISTING app cleanly, keeping it working and fluid. Read the current code to ground this:',
      '- ' + ROOT + '/src/lib/store.ts (Zustand state), ' + ROOT + '/src/components/CanvasStage.tsx (RAF loop), ' + ROOT + '/src/lib/export.ts (export), ' + ROOT + '/src/engine/render.ts + types.ts (AnimState).',
      CONTEXT.join('\n'),
      webNote + ' (for r3f-in-Next/static-export specifics and any audio/worker constraints).',
      'Cover:',
      '- Where the audio module lives (e.g. src/audio: decode, analyze worker, feature timeline, transport/clock) and how it exposes a sampleByTime(t) API the render loop consumes.',
      '- Store/state changes: audio file, decoded buffer ref, analysis status, clip start/end (60s window), playback transport, audio-reactivity on/off + intensity, mapping params.',
      '- A new AUDIO mode alongside STILL/ANIMATE (or an audio toggle within ANIMATE). UI surface for upload + waveform/clip + transport.',
      '- Migration: keep the 2D engines working; add a WebGL render path (r3f) that can be audio-driven. Phasing so each step ships a working app (e.g. audio-reactivity on 2D first, or WebGL ORB first). Determinism note: real audio makes pixel-exact reproduction impossible, so define the consistency guarantee (same clip+settings -> same motion timeline).',
      '- Static export (output:export) implications for r3f + WebCodecs + workers; client-only boundaries.',
      'Return structured findings with a concrete module/file layout and a phased sequence.',
    ].join('\n'),
  },
]
const research = (await parallel(DIMS.map(d => () => agent(d.prompt, { label: 'research:' + d.key, phase: 'Research', schema: RESEARCH_SCHEMA, effort: 'high' })))).filter(Boolean)
log('research: ' + research.length + '/' + DIMS.length)
const bundle = JSON.stringify(research, null, 2)

phase('Synthesize')
const planV1 = await agent([
  'You are the lead architect. Synthesize this research into ONE cohesive, opinionated plan for adding audio-reactive, Three.js/WebGL-powered animations to akaCOVART: load mp3/wav, pick a 60s clip, drive FLUID + CONSISTENT motion from the audio, and export a 60s video with audio. Answer the owner explicitly: "the best way to do this with three.js/WebGL so the animations stay really fluid and consistent."',
  'Write clean Markdown with sections: ## Recommended approach (the fluid+consistent answer) ## Audio pipeline (decode -> offline analysis -> smoothed feature timeline -> sampleByTime) ## WebGL/Three.js motion (uniforms, audio-clock sync, springs, per-engine mappings, no-flicker guardrails) ## Clip selection UX ## Synced 60s video+audio export ## Integration & file layout (in the current app) ## Phased roadmap (each phase ships a working app; what owner can test) ## Risks & mitigations.',
  'Be decisive, ground claims in the research, keep it scannable. Research bundle:',
  bundle,
].join('\n'), { label: 'synthesize', phase: 'Synthesize', effort: 'high' })

phase('Critique')
const critique = await agent([
  'Adversarially critique this plan for audio-reactive WebGL animation + 60s synced export in a static-export Next.js app. Find gaps/risks: audio decode + CORS/large-file/memory, offline-analysis time + UX, consistency vs real audio determinism, render/audio drift, WebCodecs/AudioEncoder browser support + codec licensing, 60s export memory/perf at resolution, mobile/Safari, fluidity pitfalls (GC, spring instability, fps independence), scope creep vs MVP, keeping the 2D app working during WebGL migration, accessibility. For each: what is missing/wrong, why it matters, concrete fix.',
  'PLAN:', planV1,
].join('\n'), { label: 'critique', phase: 'Critique', effort: 'high' })

phase('Finalize')
const FINAL_SCHEMA = {
  type: 'object', additionalProperties: false,
  properties: {
    planMarkdown: { type: 'string' },
    decisionsForUser: { type: 'array', items: { type: 'object', additionalProperties: false, properties: {
      topic: { type: 'string' }, question: { type: 'string' },
      options: { type: 'array', items: { type: 'object', additionalProperties: false, properties: { label: { type:'string' }, tradeoff: { type:'string' } }, required: ['label','tradeoff'] } },
      recommendation: { type: 'string' } }, required: ['topic','question','options','recommendation'] } },
    firstSlice: { type: 'array', items: { type: 'string' } },
  },
  required: ['planMarkdown','decisionsForUser','firstSlice'],
}
const final = await agent([
  'Produce the FINAL plan: incorporate the critique into the synthesized plan (fix gaps; add a short "Consistency guarantee" note and an MVP cut). Output planMarkdown (complete, improved). Then decisionsForUser: 4-6 real forks the owner must pick (e.g. WebGL-now vs audio-on-2D-first; offline vs realtime analysis [recommend offline]; export stack WebCodecs vs MediaRecorder; export resolution/fps target; clip UI library vs custom; audio as a new mode vs toggle) each with options+tradeoffs+recommendation. Then firstSlice: the first concrete buildable step.',
  'SYNTHESIZED PLAN:', planV1, 'CRITIQUE:', critique,
].join('\n'), { label: 'finalize', phase: 'Finalize', effort: 'high', schema: FINAL_SCHEMA })

return final
