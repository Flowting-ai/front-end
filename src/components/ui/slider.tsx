"use client"

import * as React from "react"
import * as SliderPrimitive from "@radix-ui/react-slider"
import { cn } from "@/lib/utils"

const Slider = React.forwardRef<
  React.ElementRef<typeof SliderPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof SliderPrimitive.Root>
>(
  (
    {
      className,
      defaultValue = [0],
      min = 0,
      max = 100,
      step = 1,
      ...props
    },
    ref
  ) => (
    <SliderPrimitive.Root
      ref={ref}
      defaultValue={defaultValue}
      min={min}
      max={max}
      step={step}
      className={cn(
        "relative flex w-full touch-none select-none items-center",
        className
      )}
      {...props}
    >
      {/* Track (always gray) */}
      <SliderPrimitive.Track className="relative h-[7px] w-full grow overflow-hidden rounded-full bg-[#D4D4D4]">
        {/* Range (fills from left → thumb) */}
        <SliderPrimitive.Range className="absolute h-full bg-[#0A0A0A]" />
      </SliderPrimitive.Track>

      {/* Thumb */}
      <SliderPrimitive.Thumb
        className="
          block h-3.5 w-3.5 rounded-full
          border-2 border-black
          bg-white
          ring-offset-background
          transition
          focus-visible:outline-none
          focus-visible:ring-2
          focus-visible:ring-black
          focus-visible:ring-offset-2
          disabled:pointer-events-none
          disabled:opacity-50
        "
      />
    </SliderPrimitive.Root>
  )
)

Slider.displayName = "Slider"

export { Slider }
