import * as React from "react"
import { Input as InputPrimitive } from "@base-ui/react/input"

import { cn } from "@/lib/utils"

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <InputPrimitive
      type={type}
      data-slot="input"
      className={cn(
        // The one field recipe: edge border, grey-880 fill, +1 step on hover,
        // focus outline on the border edge. Placeholder colour is global.
        "h-8 w-full min-w-0 rounded-control border border-edge bg-grey-880 px-2.5 py-1 text-[12px]/[16px] transition-colors hover:border-edge-hover focus-field file:inline-flex file:h-6 file:border-0 file:bg-transparent file:text-[12px]/[16px] file:font-medium file:text-foreground disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40",
        className
      )}
      {...props}
    />
  )
}

export { Input }
