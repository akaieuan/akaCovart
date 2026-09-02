"use client"

import { Slider as SliderPrimitive } from "@base-ui/react/slider"

import { cn } from "@/lib/utils"

// ── Slider ────────────────────────────────────────────────────────────────
// Restyled @base-ui slider for the akaCOVART studio. Designed to sit on a
// muted, glassy panel: the rail is a faint white-alpha bar (its extent is
// deliberately below 3:1 — the 10:1 fill and 16:1 thumb carry the state), the
// min→value fill is grey-200 → grey-100 on hover, and the handle is a dot with
// a knockout ring so it separates from the fill, plus a generous invisible hit
// area (the `before:` pseudo, wider on phones). Drag = a crisp 2px ring; no
// scale, no shadow, no halo.
//
// The whole `Control` row is the pointer target (base-ui lets you click /
// drag anywhere on the track), and the nested <input type="range"> inside the
// Thumb keeps full keyboard accessibility (arrows / home / end) — keyboard
// focus is keyed to that inner input via `has-[:focus-visible]`.
function Slider({
  className,
  defaultValue,
  value,
  min = 0,
  max = 100,
  ...props
}: SliderPrimitive.Root.Props) {
  const _values = Array.isArray(value)
    ? value
    : Array.isArray(defaultValue)
      ? defaultValue
      : [min, max]

  return (
    <SliderPrimitive.Root
      className={cn(
        "group/slider data-horizontal:w-full data-vertical:h-full",
        className,
      )}
      data-slot="slider"
      defaultValue={defaultValue}
      value={value}
      min={min}
      max={max}
      thumbAlignment="edge"
      {...props}
    >
      {/* 24px control row: tall enough that clicking near the bar still works. */}
      <SliderPrimitive.Control className="relative flex h-6 w-full cursor-pointer touch-none items-center py-0 select-none data-disabled:pointer-events-none data-disabled:opacity-50 data-vertical:h-full data-vertical:min-h-40 data-vertical:w-auto data-vertical:flex-col data-vertical:py-0">
        <SliderPrimitive.Track
          data-slot="slider-track"
          className={cn(
            "relative grow overflow-hidden rounded-full bg-white/[0.12] transition-colors select-none",
            "group-hover/slider:bg-white/[0.16] group-data-dragging/slider:bg-white/[0.16]",
            "data-horizontal:h-[3px] data-horizontal:w-full data-vertical:h-full data-vertical:w-[3px]",
          )}
        >
          <SliderPrimitive.Indicator
            data-slot="slider-range"
            className={cn(
              "rounded-full bg-grey-200 transition-colors select-none",
              "group-hover/slider:bg-grey-100 group-data-dragging/slider:bg-grey-100",
              "data-horizontal:h-full data-vertical:w-full",
            )}
          />
        </SliderPrimitive.Track>
        {Array.from({ length: _values.length }, (_, index) => (
          <SliderPrimitive.Thumb
            data-slot="slider-thumb"
            key={index}
            className={cn(
              // The visible handle: idle knockout ring (grey-600, 7.5:1 vs the
              // grey-200 fill) so the dot reads as a separate object.
              "relative block size-[13px] shrink-0 cursor-grab rounded-full bg-grey-100 outline-none select-none",
              "ring-1 ring-grey-600 transition-[box-shadow,background-color]",
              // Invisible grab area: 33px on desktop, 41px on phones.
              "before:absolute before:-inset-2.5 before:content-[''] max-md:before:-inset-3.5",
              // Hover ring = +1 step; drag = crisp 2px ring, white dot.
              "group-hover/slider:ring-grey-400",
              "data-dragging:cursor-grabbing data-dragging:bg-white data-dragging:ring-2 data-dragging:ring-grey-100",
              // Keyboard focus lives on base-ui's inner <input type="range">.
              "has-[:focus-visible]:outline-solid has-[:focus-visible]:outline-1 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-focus",
              "data-disabled:pointer-events-none",
            )}
          />
        ))}
      </SliderPrimitive.Control>
    </SliderPrimitive.Root>
  )
}

export { Slider }
