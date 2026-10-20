import * as React from "react"

import { cn } from "@/lib/utils"

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "neu-in flex h-11 w-full min-w-0 rounded-cv-md border border-transparent px-4 py-2 text-base text-cv-fg placeholder:text-cv-fg-subtle file:text-cv-fg file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium transition-[box-shadow,border-color] duration-(--cv-dur-fast) outline-none disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
        "focus-visible:border-cv-ring focus-visible:ring-2 focus-visible:ring-cv-ring",
        "aria-invalid:border-cv-danger aria-invalid:ring-cv-danger/30",
        className
      )}
      {...props}
    />
  )
}

export { Input }
