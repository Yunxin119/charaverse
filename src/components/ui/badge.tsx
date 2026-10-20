import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-semibold leading-5 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-cv-ring",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-cv-primary text-cv-primary-fg",
        secondary:
          "border-transparent bg-cv-secondary text-cv-secondary-fg",
        accent:
          "border-transparent bg-cv-accent text-cv-accent-fg",
        destructive:
          "border-transparent bg-cv-danger text-white",
        outline: "border-cv-border-strong text-cv-fg-muted",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  )
}

export { Badge, badgeVariants }
