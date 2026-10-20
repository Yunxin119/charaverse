import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full text-sm font-semibold transition-[transform,box-shadow,background-color,color] duration-(--cv-dur-fast) ease-cv disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 outline-none focus-visible:ring-2 focus-visible:ring-cv-ring active:translate-y-px active:scale-[0.99] aria-invalid:ring-cv-danger/30",
  {
    variants: {
      variant: {
        default:
          "bg-cv-primary text-cv-primary-fg shadow-[0_10px_24px_-10px_var(--cv-primary),inset_0_1px_0_rgba(255,255,255,0.18)] hover:bg-cv-primary-hover",
        accent:
          "bg-cv-accent text-cv-accent-fg shadow-[0_10px_24px_-10px_var(--cv-accent)] hover:brightness-105",
        destructive:
          "bg-cv-danger text-white shadow-[0_10px_24px_-10px_var(--cv-danger)] hover:brightness-105",
        outline:
          "border border-cv-border-strong bg-transparent text-cv-fg hover:bg-[color-mix(in_oklab,var(--cv-fg)_6%,transparent)]",
        secondary:
          "bg-cv-secondary text-cv-secondary-fg hover:brightness-95",
        neu:
          "neu text-cv-fg hover:shadow-neu-sm active:shadow-neu-in-sm",
        glass:
          "glass-strong text-cv-fg hover:bg-cv-glass-strong",
        ghost:
          "text-cv-fg hover:bg-[color-mix(in_oklab,var(--cv-fg)_8%,transparent)]",
        link: "text-cv-accent underline-offset-4 hover:underline",
      },
      size: {
        default: "h-10 px-5 py-2 has-[>svg]:px-4",
        sm: "h-8 gap-1.5 px-3.5 text-xs has-[>svg]:px-3",
        lg: "h-12 px-7 text-base has-[>svg]:px-5",
        icon: "size-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
  }) {
  const Comp = asChild ? Slot : "button"

  return (
    <Comp
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
