export const meta = {
  name: 'akatool-motion',
  description: 'Build out physical animation params for ORB/WAVE/GRID: spring beat response, flow, wobble, ripple (eased, no flicker)',
  phases: [
    { title: 'MotionCore', detail: 'enrich AnimState (beat, kickSpring, speed) + buildAnim + store defaults' },
    { title: 'Engines+UI', detail: '4 parallel: orb, waves, grid physical motion + animate-panel MOTION section' },
    { title: 'Verify', detail: 'typecheck + next build + fix seams' },
  ],
}

const ROOT = '/Users/ieuanking/Desktop/nuu/aka-covart'

const SPEC = [
  'MOTION MODEL — shared contract. All motion is EASED and SPACE-ONLY (scale / position / displacement / radius).',
  'NEVER drive brightness, opacity, or hue from the beat or time. No strobe, no flicker. Determinism: time-driven only; same seed+params+time reproduce.',
  '',
  'AnimState (src/engine/types.ts) becomes:',
  '  export interface AnimState {',
  '    anim: boolean; t: number; rt: number; bake: boolean;',
  '    beat: number;       // continuous beat phase in [0,1), wraps each beat',
  '    kickEnv: number;    // smooth attack-decay impulse (kick * (1-beat)^3.4) — existing calm pulse',
  '    kickSpring: number; // damped bounce, SIGNED (overshoots then settles) — kick * exp(-3.2*beat) * cos(2*PI*1.6*beat)',
  '    pumpEnv: number;    // breathing (pump * (1-beat)^2.0)',
  '    drift: number; swirl: number; speed: number; // global 0..1 (animDrift, animSwirl, animSpeed/100)',
  '  }',
  '',
  'buildAnim(params) in src/engine/render.ts (when params._anim):',
  '  const rt = params._rt||0, t = params._t||0, bake=!!params._bake;',
  '  const bps = (params.animBPM==null?128:params.animBPM)/60; const beat = (rt*bps)%1;',
  '  const kick=(params.animKick==null?0:params.animKick)/100, pump=(params.animPump==null?0:params.animPump)/100;',
  '  const drift=(params.animDrift==null?0:params.animDrift)/100, swirl=(params.animSwirl==null?0:params.animSwirl)/100, speed=(params.animSpeed==null?0:params.animSpeed)/100;',
  '  kickEnv = kick * Math.pow(1-beat, 3.4);',
  '  kickSpring = kick * Math.exp(-3.2*beat) * Math.cos(2*Math.PI*1.6*beat);',
  '  pumpEnv = pump * Math.pow(1-beat, 2.0);',
  '  (when not animating, all of beat/kickEnv/kickSpring/pumpEnv/drift/swirl/speed = 0)',
  '',
  'NEW per-engine MOTION params (group: "motion"; all type range 0..100 unless noted). Add to each engine params[] AND to store defaults AND to the ANIMATE panel UI:',
  '  ORB:  orbSpin=25, orbWobble=40, orbBounce=50, orbBreath=35, orbChurn=45',
  '  WAVE: waveFlow=50, waveSwell=40, waveSurge=55, waveChurn=40, waveUndulate=45',
  '  GRID: gridRipple=45, gridBob=40, gridPop=55, gridOrbit=35, gridFlow=30',
  '',
  'MOTION INTENT (implement physically; tune constants for taste, keep amplitudes subtle/elegant):',
  '  ORB  — Spin: rotate the melt-warp angle phases + halftone sampling by t*spin. Wobble: jelly surface, modulate the melt-warp amplitude by an LFO plus orbWobble*kickSpring. Bounce: squash-and-stretch on the beat using kickSpring -> stretch X / squash Y of the orb radius (sx=1+bounce*kickSpring*k, sy=1-bounce*kickSpring*k); keep volume-ish. Breath: radius LFO (sin(t*0.8)) + pumpEnv scaled by breath. Churn: speed of the warp sin terms scales with churn. Position orbit still uses anim.drift.',
  '  WAVE — Flow: scroll waves horizontally by advancing the x-phase with t*flow (a traveling wave). Swell: amplitude breathing LFO scaled by swell. Surge: beat amplitude pulse using kickSpring*surge (bouncy). Churn: turbulence components animate faster with churn. Undulate: vertical baseline cross-drift scaled by undulate (replaces the old fixed drift coupling).',
  '  GRID — Ripple: a wave propagating outfrom center; for each cell compute dist from center, ripple = sin(t*speedish - dist*k); displace cell SCALE and a small radial position by ripple*gridRipple (very TouchDesigner). Bob: per-cell positional oscillation scaled by bob. Pop: beat scale pop using kickSpring*pop. Orbit: the magnet attractor orbits and its pull pulses with pumpEnv, scaled by orbit. Flow: a directional traveling shear across columns/rows scaled by flow.',
  '',
  'Keep existing still-mode look identical when not animating (anim.anim false => all motion terms zero). Blob is unchanged (keeps shared drift/swirl). Engines must read new params with sensible defaults so still render is unaffected.',
].join('\n')

const NOFLICKER = 'HARD: eased + space-only motion. Never modulate brightness/opacity/hue with beat or time. No strobe/flicker. TypeScript strict. Match surrounding code style.'

// ---------------- PHASE 1: MOTION CORE (shared) ----------------
phase('MotionCore')
const core = await agent([
  'Enrich the animation core in the Next.js app at ' + ROOT + '. Edit ONLY: src/engine/types.ts, src/engine/render.ts, src/lib/store.ts. Do not touch engines or components.',
  '',
  SPEC,
  '',
  'Tasks:',
  '1) src/engine/types.ts: extend AnimState to the new shape above (add beat, kickSpring, speed; keep anim,t,rt,bake,kickEnv,pumpEnv,drift,swirl).',
  '2) src/engine/render.ts: update buildAnim() to compute beat, kickEnv, kickSpring, pumpEnv, drift, swirl, speed exactly as specified (still no flicker/strobe/hue/pump-darken; the finish chain is unchanged). The non-anim branch returns all motion fields = 0.',
  '3) src/lib/store.ts: add the 15 new motion params to StudioState interface AND to the defaults object with the specified default values (orbSpin..orbChurn, waveFlow..waveUndulate, gridRipple..gridFlow). Leave existing fields intact (you may leave animHue/animFlicker in the store; they will just no longer be shown in the UI).',
  'Then run: cd ' + ROOT + ' && pnpm exec tsc --noEmit and fix any errors in these three files. Report what changed.',
  NOFLICKER,
].join('\n'), { label: 'motion-core', phase: 'MotionCore', effort: 'high' })
log('motion core done')

// ---------------- PHASE 2: ENGINES + UI (4 parallel) ----------------
phase('Engines+UI')
const engineAgent = (name, file, hint) => () => agent([
  'Implement rich, PHYSICAL animation for the ' + name + ' engine. Edit ONLY ' + file + '. The motion core (AnimState with beat/kickEnv/kickSpring/pumpEnv/drift/swirl/speed) and the new store params already exist.',
  '',
  SPEC,
  '',
  'For ' + name + ': ' + hint,
  'Read the current file first and preserve the existing still-mode look (when anim.anim is false, no motion). Add the 5 new motion params to this engine params[] (group "motion") with the specified defaults. Read params with defaults so still render is unaffected. Use anim.kickSpring for bouncy beat response, anim.kickEnv for smooth pulses, anim.pumpEnv for breathing, anim.beat for traveling phases, anim.t for continuous time, anim.drift/swirl as gentle global modifiers.',
  'After editing run: cd ' + ROOT + ' && pnpm exec tsc --noEmit and fix errors in your file.',
  NOFLICKER,
].join('\n'), { label: 'engine:' + name, phase: 'Engines+UI', effort: 'high' })

const built = await parallel([
  engineAgent('orb', ROOT + '/src/engine/engines/orb.ts', 'Spin/Wobble/Bounce/Breath/Churn per the ORB intent. Make it feel like a living jelly orb: squash-and-stretch on the kick (kickSpring -> stretch X/squash Y of RW/RH), surface wobble + churn on the melt warp, gentle breathing, slow spin of the warp+halftone.'),
  engineAgent('waves', ROOT + '/src/engine/engines/waves.ts', 'Flow/Swell/Surge/Churn/Undulate per the WAVE intent. Make the lines flow like fluid: a traveling wave (advance x-phase by t*flow), amplitude swell + bouncy beat surge (kickSpring), animated turbulence, vertical undulation.'),
  engineAgent('grid', ROOT + '/src/engine/engines/grid.ts', 'Ripple/Bob/Pop/Orbit/Flow per the GRID intent. Make the field physical: a ripple wave propagating from center displacing cell scale+position, per-cell bob, springy beat pop (kickSpring), an orbiting+pulsing magnet attractor, and a directional traveling shear.'),
  () => agent([
    'Update the ANIMATE panel UI in ' + ROOT + '/src/components/ControlPanel.tsx. Edit ONLY that file.',
    'Changes:',
    '1) REMOVE the COLOR section (the HUE CYCLE and FLICKER sliders) from the animate panel entirely — they are dropped (flicker is gone by design).',
    '2) Keep BEAT (BPM, PUMP, KICK) and DRIFT (SPEED, WANDER, SWIRL).',
    '3) ADD a new engine-specific MOTION section in the animate panel (after DRIFT), mirroring how COMPOSITION is engine-specific in still mode. Use a GroupLabel variant "beat" titled "MOTION", then render the 5 motion sliders for the CURRENT engine:',
    '   - orb: SPIN(orbSpin) WOBBLE(orbWobble) BOUNCE(orbBounce) BREATH(orbBreath) CHURN(orbChurn)',
    '   - waves: FLOW(waveFlow) SWELL(waveSwell) SURGE(waveSurge) CHURN(waveChurn) UNDULATE(waveUndulate)',
    '   - grid: RIPPLE(gridRipple) BOB(gridBob) POP(gridPop) ORBIT(gridOrbit) FLOW(gridFlow)',
    '   - blob: no extra motion params — show a small muted note like "Drift + beat react to the global controls above." (or just omit the MOTION section for blob).',
    '   All sliders min 0 max 100, wired via set({ key: v }) reading s.<key> from the store (the fields already exist).',
    'Match the existing Slider/GroupLabel/Divider usage and styling exactly. Keep the intro text and footer as-is.',
    'After editing run: cd ' + ROOT + ' && pnpm exec tsc --noEmit and fix errors in this file.',
    NOFLICKER,
  ].join('\n'), { label: 'ui:animate-panel', phase: 'Engines+UI', effort: 'high' }),
])
log('engines+ui complete: ' + built.filter(Boolean).length + '/4')

// ---------------- PHASE 3: VERIFY ----------------
phase('Verify')
const verify = await agent([
  'Verify the motion build in the Next.js app at ' + ROOT + '. You may edit any file to fix issues.',
  '1) cd ' + ROOT + ' && pnpm exec tsc --noEmit — fix all type errors at the seams (AnimState shape, store fields, engine reads, ControlPanel reads).',
  '2) pnpm exec next build — fix any build/lint errors (no SSR/window issues; this is output:export).',
  '3) Sanity: confirm each of orb/waves/grid reads its 5 new motion params and uses anim.kickSpring/kickEnv/pumpEnv/beat; confirm the animate panel shows the engine-specific MOTION section and no longer shows HUE CYCLE/FLICKER.',
  'Report: errors fixed, and whether tsc + next build both pass.',
].join('\n'), { label: 'verify', phase: 'Verify', effort: 'high' })

return { core, built: built.filter(Boolean).length, verify }
