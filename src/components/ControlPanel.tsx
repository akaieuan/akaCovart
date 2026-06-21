"use client";

import { listEngines } from "@/engine";
import { getPresets } from "@/presets";
import { useStudio, makeSeeds, type OpenSections } from "@/lib/store";
import {
  Section,
  Slider,
  Toggle,
  Segmented,
  TextInput,
  GroupLabel,
  Divider,
  type SegOption,
} from "./primitives";
import Gallery from "./Gallery";
import SectionNav, { SECTION_IDS } from "./SectionNav";

// Engine tabs: prefer the registry, fall back to the known four so the panel is
// usable while the engine stubs are empty.
const FALLBACK_ENGINES: SegOption[] = [
  { value: "blob", label: "BLOB" },
  { value: "grid", label: "GRID" },
  { value: "waves", label: "WAVE" },
  { value: "orb", label: "ORB" },
];

const ENGINE_TAB_LABELS: Record<string, string> = {
  blob: "BLOB",
  grid: "GRID",
  waves: "WAVE",
  orb: "ORB",
};

function engineOptions(): SegOption[] {
  const reg = listEngines();
  if (!reg.length) return FALLBACK_ENGINES;
  return reg.map((e) => ({
    value: e.id,
    label: ENGINE_TAB_LABELS[e.id] ?? e.label.toUpperCase(),
  }));
}

const POS_COLS = [
  { x: 0.05, a: "left" },
  { x: 0.5, a: "center" },
  { x: 0.95, a: "right" },
];
const POS_ROWS = [0.06, 0.45, 0.84];

export default function ControlPanel({
  onExport,
}: {
  onExport: () => void;
}) {
  const s = useStudio();
  const setState = useStudio((st) => st.setState);
  const toggleSection = useStudio((st) => st.toggleSection);
  const newSeed = useStudio((st) => st.newSeed);

  const set = (patch: Parameters<typeof setState>[0]) => setState(patch);
  const sec = (key: keyof OpenSections) => ({
    open: s.open[key],
    onToggle: () => toggleSection(key),
  });

  const primaryLabel =
    s.mode === "animate"
      ? s.recording
        ? "RECORDING…"
        : "EXPORT VIDEO LOOP"
      : s.rendering
        ? "RENDERING…"
        : "DOWNLOAD PNG · 3000²";
  const busy = s.rendering || s.recording;

  const presets = getPresets();

  return (
    <aside className="flex w-[364px] flex-none flex-col border-l border-border bg-panel">
      {/* Engine tabs */}
      <div className="flex flex-none gap-[5px] px-[18px] pt-3">
        <Segmented
          value={s.engine}
          options={engineOptions()}
          onChange={(v) => set({ engine: v })}
        />
      </div>

      {/* Seed + GENERATE */}
      <div className="flex flex-none gap-2 border-b border-border px-[18px] py-3">
        <input
          type="number"
          value={s.seed}
          onChange={(e) => set({ seed: Number(e.target.value) })}
          className="h-10 min-w-0 flex-1 rounded-[3px] border border-grey-780 bg-grey-880 px-3 font-mono text-[12px] font-medium text-ink outline-none"
        />
        <button
          type="button"
          onClick={newSeed}
          className="flex h-10 flex-none items-center gap-[7px] rounded-[3px] bg-grey-100 px-[18px] font-mono text-[10px] font-semibold tracking-[0.14em] whitespace-nowrap text-bg hover:bg-white"
        >
          ↻&nbsp;GENERATE
        </button>
      </div>

      {/* Section navigator (still mode only) */}
      {s.mode === "still" && <SectionNav />}

      {/* Scrolling body */}
      <div className="pnl min-h-0 flex-1 overflow-y-auto">
        {s.mode === "still" ? (
          <>
            {/* STARTING POINTS */}
            <Section title="STARTING POINTS" id={SECTION_IDS.library} {...sec("library")}>
              <GroupLabel variant="sub">PRESETS</GroupLabel>
              <div className="mb-4 grid grid-cols-4 gap-[6px]">
                {presets.length === 0 ? (
                  <span className="col-span-4 font-mono text-[8px] tracking-[0.08em] text-grey-400">
                    NO PRESETS
                  </span>
                ) : (
                  presets.map((p, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() =>
                        set({
                          ...(p.engine ? { engine: p.engine } : {}),
                          ...p.params,
                          seed: p.seed ?? (Math.random() * 1e9) | 0,
                          gallerySeeds: makeSeeds(9),
                        })
                      }
                      className="rounded-[3px] border border-grey-800 bg-grey-880 px-1 py-[9px] text-center font-mono text-[8px] font-semibold tracking-[0.08em] text-grey-200 hover:border-grey-500 hover:bg-grey-850"
                    >
                      {p.name}
                    </button>
                  ))
                )}
              </div>
              <Gallery />
            </Section>

            {/* PALETTE · MOOD */}
            <Section title="PALETTE · MOOD" id={SECTION_IDS.palette} {...sec("palette")}>
              <Segmented
                value={s.mood}
                options={["dark", "cream", "grey", "random"].map((v) => ({
                  value: v,
                  label: v.toUpperCase(),
                }))}
                onChange={(v) => set({ mood: v as typeof s.mood })}
              />
            </Section>

            {/* COMPOSITION (engine-specific) */}
            <Section title="COMPOSITION" id={SECTION_IDS.composition} {...sec("composition")}>
              {s.engine === "blob" && (
                <div>
                  <Slider label="BLOB DENSITY" min={0} max={100} value={s.density} onChange={(v) => set({ density: v })} />
                  <Slider label="SMEAR / BLUR" min={0} max={100} value={s.smear} onChange={(v) => set({ smear: v })} />
                  <Slider label="BLOB SIZE" min={0} max={100} value={s.blobSize} onChange={(v) => set({ blobSize: v })} />
                  <Slider label="GLOW" min={0} max={100} value={s.glow} onChange={(v) => set({ glow: v })} />
                  <Toggle label="DIAMOND ZONES" value={s.diamonds} onChange={(v) => set({ diamonds: v })} />
                  <Slider label="COUNT" min={0} max={4} sub value={s.diamondCount} onChange={(v) => set({ diamondCount: v })} />
                  <Slider label="SIZE" min={0} max={100} sub value={s.diamondSize} onChange={(v) => set({ diamondSize: v })} />
                  <Slider label="SHAPE&nbsp;WIDE–TALL" min={0} max={100} sub value={s.diamondShape} onChange={(v) => set({ diamondShape: v })} />
                  <GroupLabel>ACCENT STREAKS</GroupLabel>
                  <Slider label="INTENSITY" min={0} max={100} sub value={s.accent} onChange={(v) => set({ accent: v })} />
                  <Slider label="COUNT" min={0} max={4} sub last value={s.accentCount} onChange={(v) => set({ accentCount: v })} />
                </div>
              )}
              {s.engine === "grid" && (
                <div>
                  <Slider label="COLUMNS" min={3} max={18} value={s.gridCols} onChange={(v) => set({ gridCols: v })} />
                  <Slider label="FILL DENSITY" min={0} max={100} value={s.gridDensity} onChange={(v) => set({ gridDensity: v })} />
                  <Slider label="3D&nbsp;PLANE" min={0} max={100} value={s.gridPerspective} onChange={(v) => set({ gridPerspective: v })} />
                  <Slider label="MAGNET&nbsp;·&nbsp;SCATTER" min={0} max={100} last value={s.gridMagnet} onChange={(v) => set({ gridMagnet: v })} />
                </div>
              )}
              {s.engine === "waves" && (
                <div>
                  <Slider label="LINES" min={10} max={160} value={s.waveCount} onChange={(v) => set({ waveCount: v })} />
                  <Slider label="AMPLITUDE" min={0} max={100} value={s.waveAmp} onChange={(v) => set({ waveAmp: v })} />
                  <Slider label="DETAIL" min={0} max={100} value={s.waveDetail} onChange={(v) => set({ waveDetail: v })} />
                  <Slider label="TURBULENCE" min={0} max={100} value={s.waveTurbulence} onChange={(v) => set({ waveTurbulence: v })} />
                  <Slider label="PERSPECTIVE" min={0} max={100} last value={s.wavePerspective} onChange={(v) => set({ wavePerspective: v })} />
                </div>
              )}
              {s.engine === "orb" && (
                <div>
                  <Slider label="ORB SIZE" min={0} max={100} value={s.orbSize} onChange={(v) => set({ orbSize: v })} />
                  <Slider label="SOFTNESS" min={0} max={100} value={s.orbSoft} onChange={(v) => set({ orbSoft: v })} />
                  <Slider label="HALFTONE" min={0} max={100} value={s.orbHalftone} onChange={(v) => set({ orbHalftone: v })} />
                  <Slider label="MELT" min={0} max={100} value={s.orbMelt} onChange={(v) => set({ orbMelt: v })} />
                  <Slider label="3D&nbsp;SHADE" min={0} max={100} last value={s.orbShade} onChange={(v) => set({ orbShade: v })} />
                </div>
              )}

              <GroupLabel>FINISH</GroupLabel>
              <Slider label="CONTRAST" min={0} max={100} sub value={s.contrast} onChange={(v) => set({ contrast: v })} />
              <Slider label="SATURATION" min={0} max={100} sub value={s.saturation} onChange={(v) => set({ saturation: v })} />
              <Slider label="VIGNETTE" min={0} max={100} sub value={s.vignette} onChange={(v) => set({ vignette: v })} />
              <Slider label="BLOOM" min={0} max={100} sub value={s.bloom} onChange={(v) => set({ bloom: v })} />
              <Slider label="SOFTEN&nbsp;·&nbsp;BLUR" min={0} max={100} sub last value={s.soften} onChange={(v) => set({ soften: v })} />
            </Section>

            {/* TEXTURE */}
            <Section title="TEXTURE" id={SECTION_IDS.texture} {...sec("texture")}>
              <Slider label="FILM GRAIN" min={0} max={100} value={s.grain} onChange={(v) => set({ grain: v })} />
              <Slider label="GRAIN SIZE" min={0} max={100} value={s.grainSize} onChange={(v) => set({ grainSize: v })} />
              <Slider label="DUST / SPECKS" min={0} max={100} value={s.dust} onChange={(v) => set({ dust: v })} />
              <Toggle label="SCRATCH LINES" value={s.scratches} onChange={(v) => set({ scratches: v })} />
              <Slider label="COUNT" min={0} max={16} sub last value={s.scratchCount} onChange={(v) => set({ scratchCount: v })} />
            </Section>

            {/* SIGIL */}
            <Section title="SIGIL" id={SECTION_IDS.sigil} {...sec("sigil")}>
              <Toggle label="SIGIL MARKS" value={s.sigilMarks} onChange={(v) => set({ sigilMarks: v })} />
              <Slider label="DENSITY" min={0} max={20} sub value={s.sigilMarkCount} onChange={(v) => set({ sigilMarkCount: v })} />
              <Slider label="SIZE" min={0} max={100} sub value={s.sigilMarkSize} onChange={(v) => set({ sigilMarkSize: v })} />
              <Slider label="SCATTER" min={0} max={100} sub value={s.sigilMarkScatter} onChange={(v) => set({ sigilMarkScatter: v })} />
              <Divider />
              <Toggle label="BARB FRAME" value={s.sigilFrame} onChange={(v) => set({ sigilFrame: v })} />
              <Slider label="FRAME DENSITY" min={0} max={100} sub last value={s.sigilFrameDensity} onChange={(v) => set({ sigilFrameDensity: v })} />
            </Section>

            {/* TYPE OVERLAY */}
            <Section title="TYPE OVERLAY" id={SECTION_IDS.type} {...sec("type")}>
              <Toggle label="RENDER TEXT" value={s.showText} onChange={(v) => set({ showText: v })} />
              <TextInput value={s.title} placeholder="TITLE" onChange={(v) => set({ title: v })} />
              <TextInput value={s.artist} placeholder="ARTIST" artist onChange={(v) => set({ artist: v })} />
              <GroupLabel variant="sub">CASE</GroupLabel>
              <Segmented
                className="mb-[14px]"
                value={s.textCase}
                options={[
                  { value: "upper", label: "UPPER" },
                  { value: "lower", label: "lower" },
                  { value: "asis", label: "As-Is" },
                  { value: "manic", label: "ManIC" },
                ]}
                onChange={(v) => set({ textCase: v })}
              />
              <Slider label="DISTORT&nbsp;/&nbsp;GLITCH" min={0} max={100} sub value={s.distort} onChange={(v) => set({ distort: v })} />
              <GroupLabel variant="sub">COLOR</GroupLabel>
              <Segmented
                className="mb-[14px]"
                value={s.textColor}
                options={[
                  { value: "auto", label: "AUTO" },
                  { value: "light", label: "LIGHT" },
                  { value: "dark", label: "DARK" },
                ]}
                onChange={(v) => set({ textColor: v })}
              />
              <div className="mb-2 flex items-baseline justify-between">
                <span className="font-mono text-[9px] font-medium tracking-[0.14em] text-grey-350">
                  POSITION
                </span>
                <span className="font-mono text-[8px] tracking-[0.08em] text-grey-400">
                  or drag on canvas ⤢
                </span>
              </div>
              <div className="grid w-[108px] grid-cols-3 gap-[5px]">
                {POS_ROWS.map((ry, ri) =>
                  POS_COLS.map((cx, ci) => {
                    const active =
                      Math.abs(s.textX - cx.x) < 0.02 &&
                      Math.abs(s.textY - ry) < 0.02 &&
                      s.textAlign === cx.a;
                    return (
                      <button
                        key={`${ri}-${ci}`}
                        type="button"
                        onClick={() => set({ textX: cx.x, textY: ry, textAlign: cx.a })}
                        className={
                          "flex aspect-[1.4] rounded-[3px] border p-[5px] " +
                          (active
                            ? "border-grey-500 bg-grey-600"
                            : "border-grey-800 bg-grey-880 hover:border-grey-500")
                        }
                        style={{
                          alignItems:
                            cx.a === "left"
                              ? "flex-start"
                              : cx.a === "right"
                                ? "flex-end"
                                : "center",
                          justifyContent:
                            ri === 0
                              ? "flex-start"
                              : ri === 2
                                ? "flex-end"
                                : "center",
                        }}
                      >
                        <span
                          className={
                            "h-1 w-1 rounded-full " +
                            (active ? "bg-grey-100" : "bg-grey-400")
                          }
                        />
                      </button>
                    );
                  }),
                )}
              </div>
            </Section>
          </>
        ) : (
          /* ANIMATE PANEL */
          <div>
            <div className="px-5 pt-4 pb-1 font-mono text-[9px] leading-[1.7] tracking-[0.05em] text-grey-350">
              Beat-synced motion for techno. Set the BPM, dial the pump &amp;
              kick, then export a looping video (MP4 where supported, else WEBM).
            </div>
            <div className="px-5 pt-[14px] pb-[6px]">
              <GroupLabel variant="beat">BEAT</GroupLabel>
              <Slider label="BPM" min={90} max={160} value={s.animBPM} onChange={(v) => set({ animBPM: v })} />
              <Slider label="PUMP" min={0} max={100} value={s.animPump} onChange={(v) => set({ animPump: v })} />
              <Slider label="KICK" min={0} max={100} last value={s.animKick} onChange={(v) => set({ animKick: v })} />
              <Divider />
              <GroupLabel variant="beat">DRIFT</GroupLabel>
              <Slider label="SPEED" min={0} max={100} value={s.animSpeed} onChange={(v) => set({ animSpeed: v })} />
              <Slider label="WANDER" min={0} max={100} value={s.animDrift} onChange={(v) => set({ animDrift: v })} />
              <Slider label="SWIRL" min={0} max={100} last value={s.animSwirl} onChange={(v) => set({ animSwirl: v })} />
              {s.engine !== "blob" && (
                <>
                  <Divider />
                  <GroupLabel variant="beat">MOTION</GroupLabel>
                  {s.engine === "orb" && (
                    <>
                      <Slider label="SPIN" min={0} max={100} value={s.orbSpin} onChange={(v) => set({ orbSpin: v })} />
                      <Slider label="WOBBLE" min={0} max={100} value={s.orbWobble} onChange={(v) => set({ orbWobble: v })} />
                      <Slider label="BOUNCE" min={0} max={100} value={s.orbBounce} onChange={(v) => set({ orbBounce: v })} />
                      <Slider label="BREATH" min={0} max={100} value={s.orbBreath} onChange={(v) => set({ orbBreath: v })} />
                      <Slider label="CHURN" min={0} max={100} last value={s.orbChurn} onChange={(v) => set({ orbChurn: v })} />
                    </>
                  )}
                  {s.engine === "waves" && (
                    <>
                      <Slider label="FLOW" min={0} max={100} value={s.waveFlow} onChange={(v) => set({ waveFlow: v })} />
                      <Slider label="SWELL" min={0} max={100} value={s.waveSwell} onChange={(v) => set({ waveSwell: v })} />
                      <Slider label="SURGE" min={0} max={100} value={s.waveSurge} onChange={(v) => set({ waveSurge: v })} />
                      <Slider label="CHURN" min={0} max={100} value={s.waveChurn} onChange={(v) => set({ waveChurn: v })} />
                      <Slider label="UNDULATE" min={0} max={100} last value={s.waveUndulate} onChange={(v) => set({ waveUndulate: v })} />
                    </>
                  )}
                  {s.engine === "grid" && (
                    <>
                      <Slider label="RIPPLE" min={0} max={100} value={s.gridRipple} onChange={(v) => set({ gridRipple: v })} />
                      <Slider label="BOB" min={0} max={100} value={s.gridBob} onChange={(v) => set({ gridBob: v })} />
                      <Slider label="POP" min={0} max={100} value={s.gridPop} onChange={(v) => set({ gridPop: v })} />
                      <Slider label="ORBIT" min={0} max={100} value={s.gridOrbit} onChange={(v) => set({ gridOrbit: v })} />
                      <Slider label="FLOW" min={0} max={100} last value={s.gridFlow} onChange={(v) => set({ gridFlow: v })} />
                    </>
                  )}
                </>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Footer: STILL/ANIMATE + primary action */}
      <div className="flex flex-none flex-col gap-[9px] border-t border-border px-[18px] py-3">
        <Segmented
          value={s.mode}
          options={[
            { value: "still", label: "STILL" },
            { value: "animate", label: "ANIMATE" },
          ]}
          onChange={(v) => set({ mode: v as typeof s.mode })}
        />
        <button
          type="button"
          onClick={onExport}
          className="flex h-11 w-full items-center justify-center gap-[9px] rounded-[3px] bg-grey-100 font-mono text-[10px] font-semibold tracking-[0.16em] text-bg hover:bg-white"
        >
          {busy && (
            <span className="inline-block animate-[spin_0.8s_linear_infinite]">
              ◐
            </span>
          )}
          {primaryLabel}
        </button>
      </div>
    </aside>
  );
}
