export const meta = {
  name: 'akatool-audio-build',
  description: 'Audio reactivity on the 2D engines: mp3/wav import -> offline analysis -> 60s clip -> fluid, consistent live reaction',
  phases: [
    { title: 'AudioCore', detail: 'src/audio (decode, analyze, timeline, transport) + store fields + buildAnim override' },
    { title: 'WireUI', detail: 'parallel: audio-driven CanvasStage loop + AUDIO mode UI (upload, waveform, 60s clip, transport)' },
    { title: 'Integrate', detail: 'wire, keep BPM animate working, build + verify' },
  ],
}

const ROOT = '/Users/ieuanking/Desktop/nuu/aka-covart'

const FLUID = [
  'FLUID + CONSISTENT is the hard requirement. Rules:',
  '- Analyze the selected 60s clip ONCE (offline) into a per-frame FEATURE TIMELINE (typed Float32Arrays at a fixed hop ~100-120 Hz). Never drive visuals off a live per-frame FFT.',
  '- At render time SAMPLE the timeline by the AUDIO CLOCK (transport.currentTime), interpolating between hops, so motion is locked to the music at any render fps.',
  '- Smooth features (envelope followers attack/release) so data is buttery; drive motion through CRITICALLY-DAMPED SPRINGS stepped by DELTA-TIME (fixed-timestep accumulator) so motion is identical at 30/60/120 fps and never overshoots/blows up.',
  '- NO FLICKER: audio drives SPACE only (scale/position/displacement/flow) via the existing AnimState (kickEnv/kickSpring/pumpEnv/drift/swirl). Never modulate brightness/opacity/hue from audio.',
  '- Normalize/clamp features (so loud and quiet tracks behave); an overall reactivity INTENSITY scales the mapping.',
  '- Consistency guarantee: same clip + same settings -> same feature timeline -> same motion (offline deterministic analysis). Determinism in analysis: no Math.random in the analysis path.',
].join('\n')

const TIMELINE_CONTRACT = [
  'AUDIO MODULE CONTRACT (src/audio):',
  '// features.ts',
  'export interface AudioFeatures { energy:number; bass:number; mid:number; high:number; beat:number } // each ~0..1; beat = decaying onset impulse 0..1',
  '// timeline.ts',
  'export interface AudioTimeline { duration:number; hopHz:number; sampleByTime(t:number):AudioFeatures }',
  '// decode.ts',
  'export async function decodeFile(file:File):Promise<{ buffer:AudioBuffer; peaks:Float32Array }>  // peaks = downsampled abs-amplitude (~2000 bars) for the waveform',
  '// analyze.ts (prefer a Web Worker via new URL(..., import.meta.url); fall back to a chunked main-thread analyzer with progress if worker bundling is awkward under output:export)',
  'export async function analyzeClip(buffer:AudioBuffer, clipStart:number, clipEnd:number, onProgress?:(p:number)=>void):Promise<AudioTimeline>',
  '// transport.ts — singleton clip player (AudioBufferSourceNode or HTMLAudioElement) for the chosen 60s window',
  'export const transport: { load(buffer:AudioBuffer, clipStart:number, clipEnd:number):void; play():void; pause():void; seek(tInClip:number):void; readonly currentTime:number; readonly playing:boolean; readonly clipDuration:number; onEnded(cb:()=>void):void }',
  '// index.ts re-exports the above + a module-level current-session ref (buffer/timeline/peaks) so UI and the render loop share one instance without putting non-serializable data in Zustand.',
].join('\n')

// ---------------- PHASE 1: AUDIO CORE ----------------
phase('AudioCore')
const core = await agent([
  'Build the AUDIO CORE for akaCOVART at ' + ROOT + '. Edit ONLY: create src/audio/** ; edit src/lib/store.ts (add audio fields) ; edit src/engine/render.ts (small buildAnim override). Do not touch components yet.',
  'First read: ' + ROOT + '/src/engine/render.ts (buildAnim + AnimState usage), ' + ROOT + '/src/engine/types.ts (AnimState), ' + ROOT + '/src/lib/store.ts.',
  '',
  TIMELINE_CONTRACT,
  '',
  FLUID,
  '',
  'Implement:',
  '1) src/audio/decode.ts: File -> ArrayBuffer -> AudioContext.decodeAudioData -> AudioBuffer; build a ~2000-bar Float32 peaks array (downsampled max-abs per bucket, mono mix) for the waveform.',
  '2) src/audio/analyze.ts: offline analysis of the [clipStart,clipEnd] window into a timeline. Per hop (~10ms / ~100Hz): RMS energy; FFT (use a tiny FFT — add a minimal dependency like fft.js OR hand-roll a radix-2 FFT, your call, keep it light/deterministic) -> band magnitudes for bass/mid/high; spectral flux -> onset/beat (half-wave-rectified flux, normalized, with a decaying peak-hold so beat is a 0..1 impulse). Normalize each feature to ~0..1 over the clip. Apply attack/release envelope smoothing. Store as Float32Arrays. Prefer a Web Worker; fall back to chunked main-thread with onProgress if needed under static export.',
  '3) src/audio/timeline.ts: AudioTimeline with sampleByTime(t) linear-interpolating the arrays.',
  '4) src/audio/transport.ts: singleton that plays the chosen window (AudioBufferSourceNode through an AudioContext, or a looped slice); exposes currentTime (seconds into the clip), playing, clipDuration, play/pause/seek/onEnded. Loops the clip for continuous preview.',
  '5) src/audio/index.ts: re-export + a session singleton holding {buffer, peaks, timeline} the UI and render loop both read.',
  '6) src/lib/store.ts: add SERIALIZABLE audio state to StudioState + defaults + actions: audioName:string|null, audioStatus:"idle"|"decoding"|"analyzing"|"ready", audioDuration:number, clipStart:number, clipEnd:number (default a 60s window; clamp end-start<=60), audioReactive:boolean, audioIntensity:number (0..100, default 65), audioPlaying:boolean. Add a "audio" option to the Mode type ("still"|"animate"|"audio"). Do NOT put AudioBuffer/timeline in the store (keep in the src/audio singleton).',
  '7) src/engine/render.ts: in buildAnim, if params._audioAnim is provided (an object with the eased fields anim/t/rt/bake/beat/kickEnv/kickSpring/pumpEnv/drift/swirl), RETURN it directly as the AnimState (the render loop computes audio-driven springs and passes them in). Otherwise behave exactly as today. Keep flicker-free.',
  'Then run: cd ' + ROOT + ' && pnpm exec tsc --noEmit and fix errors in your files. Report the module API + store fields.',
].join('\n'), { label: 'audio-core', phase: 'AudioCore', effort: 'high' })
log('audio core done')

// ---------------- PHASE 2: parallel (render loop + UI) ----------------
phase('WireUI')
const wired = await parallel([
  // A — audio-driven render loop
  () => agent([
    'Make the akaCOVART canvas react to audio in the new AUDIO mode. Edit ONLY ' + ROOT + '/src/components/CanvasStage.tsx. The audio core (src/audio: transport, timeline, session singleton) and store fields (mode "audio", audioReactive, audioIntensity, audioPlaying, clip range) already exist; render.ts buildAnim accepts a params._audioAnim override.',
    'Read CanvasStage.tsx first; preserve STILL and BPM-ANIMATE behavior exactly.',
    '',
    FLUID,
    '',
    'Implement an AUDIO render path:',
    '- When store.mode === "audio": run a RAF loop similar to startAnim, but each frame sample the audio FEATURES from the src/audio timeline by transport.currentTime (the audio clock). If no clip/timeline loaded or not playing, hold the last frame / render a calm idle state (do not error).',
    '- Maintain spring state in refs (position+velocity) and step with a FIXED-TIMESTEP accumulator using real delta-time so behavior is fps-independent. Use critically-damped springs. Map features -> eased AnimState fields, scaled by audioIntensity:',
    '   beat(onset) -> kickSpring (bouncy) + kickEnv (attack-decay); energy/RMS -> pumpEnv (breathing); bass -> extra scale/breath; mid/high -> drift/swirl/flow amount. Clamp outputs. Keep _t/_rt advancing from the audio clock so engine time-based motion stays in sync.',
    '- Pass the computed AnimState as params._audioAnim into renderTo(c, DISPLAY, {...renderParams(s), _anim:true, _audioAnim:builtState, _t, _rt, _bake}). Apply the live contrast/saturate CSS filter as in BPM animate.',
    '- React to transport play/pause (store.audioPlaying) and to mode changes; start/stop the loop cleanly (no leaks); when leaving audio mode, stop the loop and redraw the still frame.',
    'Then run: cd ' + ROOT + ' && pnpm exec tsc --noEmit and fix errors in this file.',
  ].join('\n'), { label: 'render-loop', phase: 'WireUI', effort: 'high' }),

  // B — AUDIO mode UI
  () => agent([
    'Build the AUDIO mode UI for akaCOVART. You OWN: create ' + ROOT + '/src/components/AudioPanel.tsx and ' + ROOT + '/src/components/Waveform.tsx, and edit ' + ROOT + '/src/components/Studio.tsx (add "AUDIO" to the mode toggle + render the audio chrome) and ' + ROOT + '/src/components/Controls.tsx (render AudioPanel when mode==="audio"). Do NOT edit CanvasStage.tsx, src/audio, src/engine, or store.ts shape (read them).',
    'Use shadcn components + the akaCOVART dark theme (mono micro-labels). Import the audio core from "@/audio" and the store from "@/lib/store".',
    '',
    'Implement:',
    '- Studio.tsx: extend the ModeToggle to three options STILL / ANIMATE / AUDIO (keep it tidy; it can wrap or shrink). Keep desktop sidebar + mobile sheet working.',
    '- Controls.tsx: when mode==="audio", render <AudioPanel/> instead of the still/animate param sections (engine selector + finish still reachable is fine).',
    '- AudioPanel.tsx: (1) an upload dropzone / file picker (accept audio/mpeg, audio/wav, .mp3, .wav). On select: setState audioStatus "decoding", call decodeFile, then analyzeClip for the current 60s window (show progress), set audioStatus "ready", load transport. (2) The <Waveform/> with a draggable 60s clip window (handles), showing current playhead; clicking/dragging sets clipStart/clipEnd (clamp span <=60s) and re-analyzes (debounced). (3) Transport: PLAY/PAUSE (toggles transport + store.audioPlaying), and a small time readout. (4) An AUDIO REACT intensity slider (audioIntensity) and an audioReactive toggle. Mono/minimal styling.',
    '- Waveform.tsx: a custom <canvas> waveform from the decoded peaks (from the @/audio session singleton); draw the full track peaks (theme greys), shade the selected 60s window brighter, draw draggable left/right trim handles + a playhead line driven by transport.currentTime (via requestAnimationFrame while playing). Pointer drag on handles updates clipStart/clipEnd in the store; drag the body to move the window. Keep it crisp on retina (devicePixelRatio).',
    'Then run: cd ' + ROOT + ' && pnpm exec tsc --noEmit and fix errors in your files.',
  ].join('\n'), { label: 'audio-ui', phase: 'WireUI', effort: 'high' }),
])
log('wire-ui: ' + wired.filter(Boolean).length + '/2')

// ---------------- PHASE 3: integrate + verify ----------------
phase('Integrate')
const integrate = await agent([
  'Integrate + verify the audio-reactivity feature in akaCOVART at ' + ROOT + '. You may edit any file in src/.',
  '1) Wire seams: AUDIO mode in the mode toggle shows the AudioPanel + drives CanvasStage; STILL and BPM-ANIMATE still work unchanged. Re-analyze on clip change is debounced. Transport play/pause reflects store.audioPlaying.',
  '2) Static-export safety (output:export): all audio/DOM/AudioContext/Worker usage must be client-only (inside effects/handlers, "use client"); if a Web Worker via new URL(import.meta.url) breaks the static build, switch analyze.ts to the chunked main-thread fallback. No window/AudioContext at module scope.',
  '3) Run: cd ' + ROOT + ' && pnpm exec tsc --noEmit and pnpm exec next build — FIX ALL errors/warnings until both pass (static export).',
  '4) Sanity: confirm src/audio API matches what CanvasStage + AudioPanel import; confirm no flicker (audio drives only space via _audioAnim); confirm the timeline is sampled by the audio clock and springs use delta-time.',
  'Report: files changed, the audio data flow (decode -> analyze -> timeline -> transport -> CanvasStage), whether worker or main-thread analysis was used, and whether tsc + next build pass.',
].join('\n'), { label: 'integrate', phase: 'Integrate', effort: 'high' })

return { core, wired: wired.filter(Boolean).length, integrate }
