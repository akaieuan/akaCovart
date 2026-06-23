"use client"

import { Slider as SliderPrimitive } from "@base-ui/react/slider"

import { cn } from "@/lib/utils"

// ── Slider ────────────────────────────────────────────────────────────────
// Restyled @base-ui slider for the akaCOVART studio. Designed to sit on a
// muted, glassy panel: the rail is a quiet hairline-ish bar, the min→value
// fill is near-white (grey-100), and the handle is a clear, grabbable dot
// with a generous invisible hit area (the `before:` pseudo) so it is easy to
// grab and drag. Hover / dragging / focus states are subtle, never neon.
//
// The whole `Control` row is the pointer target (base-ui lets you click /
// drag anywhere on the track), and the nested <input type="range"> inside the
// Thumb keeps full keyboard accessibility (arrows / home / end).
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
      {/* Tall, padded hit area so clicking/dragging near the bar still works. */}
      <SliderPrimitive.Control className="relative flex w-full cursor-pointer touch-none items-center py-2 select-none data-disabled:pointer-events-none data-disabled:opacity-50 data-vertical:h-full data-vertical:min-h-40 data-vertical:w-auto data-vertical:flex-col data-vertical:py-0">
        <SliderPrimitive.Track
          data-slot="slider-track"
          className={cn(
            "relative grow overflow-hidden rounded-full bg-grey-700/70 transition-colors select-none",
            "group-hover/slider:bg-grey-600 group-data-dragging/slider:bg-grey-600",
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
              // The visible handle.
              "relative block size-[13px] shrink-0 rounded-full bg-grey-100 shadow-sm outline-none select-none",
              "ring-1 ring-grey-500/60 transition-[transform,box-shadow,background-color] duration-100 ease-out",
              // Generous invisible grab area around the handle.
              "before:absolute before:-inset-2.5 before:content-['']",
              // Hover / focus / active feedback — a soft halo, no colour shift.
              "group-hover/slider:ring-grey-300",
              "hover:scale-[1.06]",
              "focus-visible:ring-[3px] focus-visible:ring-grey-200/40",
              "active:scale-95 active:ring-grey-200",
              "data-dragging:scale-95 data-dragging:ring-[3px] data-dragging:ring-grey-200/40",
              "data-disabled:pointer-events-none",
            )}
          />
        ))}
      </SliderPrimitive.Control>
    </SliderPrimitive.Root>
  )
}

export { Slider }
