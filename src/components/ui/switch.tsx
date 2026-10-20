"use client"

import * as React from "react"
import * as SwitchPrimitive from "@radix-ui/react-switch"

import { cn } from "@/lib/utils"

function Switch({
  className,
  ...props
}: React.ComponentProps<typeof SwitchPrimitive.Root>) {
  return (
    <SwitchPrimitive.Root
      data-slot="switch"
      className={cn(
        "peer data-[state=checked]:bg-cv-accent data-[state=unchecked]:bg-[color-mix(in_oklab,var(--cv-fg)_18%,transparent)] inline-flex h-6 w-11 shrink-0 items-center rounded-full border border-transparent shadow-neu-in-sm transition-colors duration-(--cv-dur-fast) outline-none focus-visible:ring-2 focus-visible:ring-cv-ring disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb
        data-slot="switch-thumb"
        className={cn(
          "pointer-events-none block size-5 rounded-full bg-white shadow-[0_2px_6px_rgba(0,0,0,0.25)] ring-0 transition-transform duration-(--cv-dur-fast) ease-cv data-[state=checked]:translate-x-[calc(100%+2px)] data-[state=unchecked]:translate-x-0.5"
        )}
      />
    </SwitchPrimitive.Root>
  )
}

export { Switch }
