import * as React from "react"

import { cn } from "@/lib/utils"

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "neu-in flex field-sizing-content min-h-20 w-full rounded-cv-md border border-transparent px-4 py-3 text-base text-cv-fg placeholder:text-cv-fg-subtle transition-[box-shadow,border-color] duration-(--cv-dur-fast) outline-none focus-visible:border-cv-ring focus-visible:ring-2 focus-visible:ring-cv-ring aria-invalid:border-cv-danger aria-invalid:ring-cv-danger/30 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
        className
      )}
      {...props}
    />
  )
}

export { Textarea }
