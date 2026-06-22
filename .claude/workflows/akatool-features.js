export const meta = {
  name: 'akatool-features',
  description: 'Cover-font picker + tactile clip window (drag + length presets) + Auto mode (curated param auto-evolve)',
  phases: [
    { title: 'FontPicker', detail: 'Font selector in Type panel + wire textFont into the redraw signature' },
    { title: 'ClipWindow', detail: 'drag the whole selection + length presets (30/60/90/180/full); relax 60s cap' },
    { title: 'AutoMode', detail: 'Auto toggle + Intensity that auto-evolves a curated param set (audio-linked in Audio)' },
    { title: 'Verify', detail: 'typecheck + clean next build + confirm features' },
  ],
}

const ROOT = '/Users/ieuanking/Desktop/nuu/aka-covart'
const STRUCT = 'Current structure: src/components/{studio,canvas,controls,controls/primitives,audio,ui}/ with index.ts barrels; store in src/lib/store.ts; engine in src/engine/** (pure, do not change behavior); audio module in src/audio/**. Control rows self-subscribe by param key + React.memo (keep that pattern — do NOT regress to whole-store subscriptions). Read files before editing.'
const GUARD = 'Keep STILL/ANIMATE/AUDIO working, flicker-free, deterministic where applicable. TypeScript strict. Match the Geist normal-case minimal UI styling. Do not touch src/components/ui/**. Run cd ' + ROOT + ' && pnpm exec tsc --noEmit after your edits and fix errors in the files you touched.'

// ---------------- PHASE 1: FONT PICKER ----------------
phase('FontPicker')
const font = await agent([
  'Add a cover-text FONT PICKER to akaCOVART. ' + STRUCT,
  'Context: the engine already draws the title/artist in params.textFont (src/engine/effects/text.ts), the curated faces are loaded via globals.css @import (real family names: "Space Grotesk", "Anton", "Instrument Serif", "Syne"), and the store has a textFont field (default "Space Grotesk").',
  'Tasks:',
  '1) Add a Font control to the TYPE OVERLAY section of the controls (find where the type-overlay controls render — controls/Controls.tsx and/or controls/controls-config.ts). A compact selector (segmented or a small 2-col button grid; labels: Space Grotesk / Anton / Instrument Serif / Syne) bound to store.textFont. It must self-subscribe narrowly (useStudio(s => s.textFont)) + write via setState, consistent with the other memoized rows.',
  '2) Wire textFont into the redraw SIGNATURE so switching fonts repaints: add s.textFont to the textSig() in src/components/canvas/CanvasStage.tsx AND in src/components/controls/Gallery.tsx (its gallerySig/textSig equivalent). Without this, changing the font would not trigger a redraw.',
  '3) Make sure the chosen font actually renders (the fonts are loaded; ensure a draw happens after document.fonts.ready — CanvasStage already does this on mount; switching font now triggers a redraw via the signature).',
  GUARD,
  'Report what you added and the files touched.',
].join('\n'), { label: 'font-picker', phase: 'FontPicker', effort: 'high' })
log('font picker done')

// ---------------- PHASE 2: CLIP WINDOW ----------------
phase('ClipWindow')
const clip = await agent([
  'Make the audio CLIP WINDOW tactile in akaCOVART. ' + STRUCT,
  'Today: src/components/audio/Waveform.tsx draws the waveform + a draggable 60s window via edge handles only; store.setClip clamps end-start <= MAX_CLIP (60); store has clipStart/clipEnd/audioDuration. Re-analysis on clip change is already debounced in AudioPanel.',
  'Tasks:',
  '1) DRAG THE WHOLE SELECTION: in Waveform.tsx, a pointer-drag on the highlighted band BODY (not on the edge handles) moves the window (start AND end together) along the track, clamped to [0, audioDuration]. Keep the two edge handles for resizing. Cursors: "grab"/"grabbing" on the body, "ew-resize" on the handles. Make hit-testing for body vs handle robust (handle zones ~8-10px at each edge).',
  '2) LENGTH PRESETS: relax the hard 60s cap. In store.ts generalize the clip model so the window length can be 30 / 60 / 90 / 180 seconds or FULL (whole track). Add a store action (e.g. setClipLength(seconds | "full")) that sets clipEnd = min(clipStart + len, duration) (and nudges clipStart back if needed so the window fits), and update setClip to clamp to the active max length rather than a hard 60. Keep clipStart/clipEnd as the source of truth. Add the presets UI as a small row of buttons (30s · 60s · 90s · 180s · Full) in src/components/audio/AudioPanel.tsx, bound to the action, with the active length highlighted. Update the readout to show the window length (e.g. "90.0s window") and start->end.',
  '3) Moving/resizing the window updates clipStart/clipEnd in the store, which already triggers the debounced re-analysis + transport reload. Confirm that still fires. Longer windows just mean longer analysis/clips — fine.',
  'Note MAX_CLIP currently = 60; replace its hard use with the selectable length. Keep the existing transport/playhead behavior.',
  GUARD,
  'Report the new interactions + files touched.',
].join('\n'), { label: 'clip-window', phase: 'ClipWindow', effort: 'high' })
log('clip window done')

// ---------------- PHASE 3: AUTO MODE ----------------
phase('AutoMode')
const auto = await agent([
  'Add AUTO MODE to akaCOVART — gently auto-evolves a CURATED set of composition/finish params so animations feel alive, not stagnant. ' + STRUCT,
  'Design (owner picked "Curated set + Intensity"): an Auto toggle + Intensity slider, available in BOTH Animate and Audio modes. When Auto is on, the render loop perturbs a curated set of params around their current (manual) base values using slow, eased, BOUNDED LFOs — and in AUDIO mode those perturbations also scale with the audio energy/bands. Manual sliders remain the base; Auto wanders around them. FLICKER-FREE: keep modulation slow and bounded; for brightness-ish params (glow, contrast, saturation, bloom) keep the swing gentle and rate-limited so it never strobes.',
  'Tasks:',
  '1) store.ts: add auto:boolean (default false) and autoIntensity:number (0..100, default 50) with defaults + types.',
  '2) Render loop (src/components/canvas/CanvasStage.tsx): add a helper (e.g. a new src/components/canvas/autoModulate.ts) applyAuto(baseParams, t, intensity, audioFeatures?) that returns a modulated copy of the param bag. Curated set to modulate (clamp each to its real [min,max]): density, smear, blobSize, glow, contrast, saturation, vignette, bloom, accent, diamondShape, and engine-specific (gridDensity, gridMagnet, waveAmp, waveTurbulence, orbMelt, orbHalftone). Each param: base + sin/eased LFO at a distinct low frequency + phase (deterministic), amplitude = (range fraction) * (autoIntensity/100); in audio mode multiply the amplitude/offset by a smoothed audio feature (energy/bands) so it reacts to the track. Apply applyAuto in BOTH the BPM-animate loop and the audio loop, only when store.auto is true; pass the result into renderTo. Do not modulate the seed/text/mode. Keep _audioAnim space-motion as-is.',
  '3) UI: add an Auto toggle + Intensity slider to the Animate panel (in src/components/controls/Controls.tsx — the motion/animate panel) AND to the Audio panel (src/components/audio/AudioPanel.tsx). Bind to store.auto / store.autoIntensity, self-subscribed + memo-consistent. Label them clearly (e.g. "Auto" toggle, "Intensity" slider).',
  '4) Auto must NOT change the underlying stored param values (so toggling Auto off returns to the exact manual look) — it only affects what the render loop draws.',
  GUARD,
  'Report the curated params, the LFO/audio-link approach, and files touched.',
].join('\n'), { label: 'auto-mode', phase: 'AutoMode', effort: 'high' })
log('auto mode done')

// ---------------- PHASE 4: VERIFY ----------------
phase('Verify')
const verify = await agent([
  'Verify the three new akaCOVART features at ' + ROOT + '. You may edit any file under src/ (not src/components/ui) to fix issues.',
  'IMPORTANT: ensure no preview/dev server is running before a production build (concurrent next build + dev corrupts .next). Clean first: rm -rf ' + ROOT + '/.next ' + ROOT + '/out, then build.',
  '1) cd ' + ROOT + ' && pnpm exec tsc --noEmit and pnpm exec next build (static export) — FIX ALL errors/warnings until both pass.',
  '2) Confirm: (a) Font picker in the Type panel switches the cover font (Space Grotesk/Anton/Instrument Serif/Syne) and textFont is in the redraw signature; (b) the clip window can be dragged as a whole + length presets 30/60/90/180/Full work and the 60s hard cap is relaxed; (c) Auto toggle + Intensity exist in Animate AND Audio, modulate a curated param set in the render loop (flicker-free, audio-linked in Audio), and toggling Auto off restores the manual look; (d) STILL/ANIMATE/AUDIO, engine selector, presets, gallery, export, and the fluid per-row subscriptions are all intact.',
  'Report: files changed, anything fixed, and confirm tsc + next build pass.',
].join('\n'), { label: 'verify', phase: 'Verify', effort: 'high' })

return { font, clip, auto, verify }
