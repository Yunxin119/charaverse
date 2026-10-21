import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const chipVariants = cva(
  'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold leading-none whitespace-nowrap transition-colors',
  {
    variants: {
      tone: {
        flat: 'bg-cv-secondary text-cv-secondary-fg',
        primary: 'bg-cv-primary text-cv-primary-fg',
        accent: 'bg-cv-accent text-cv-accent-fg',
        glass: 'glass-strong text-cv-fg',
        outline: 'border border-cv-border-strong text-cv-fg-muted',
        success: 'bg-[color-mix(in_oklab,var(--cv-success)_18%,transparent)] text-cv-success',
        warning: 'bg-[color-mix(in_oklab,var(--cv-warning)_18%,transparent)] text-cv-warning',
        danger: 'bg-[color-mix(in_oklab,var(--cv-danger)_16%,transparent)] text-cv-danger',
        info: 'bg-[color-mix(in_oklab,var(--cv-info)_16%,transparent)] text-cv-info',
      },
      interactive: { true: 'cursor-pointer hover:brightness-95 active:scale-[0.97]', false: '' },
    },
    defaultVariants: { tone: 'flat', interactive: false },
  }
)

export interface ChipProps extends React.ComponentProps<'span'>, VariantProps<typeof chipVariants> {}

/** Tag / status pill. Use `tone` for semantic colours. */
export function Chip({ className, tone, interactive, ...props }: ChipProps) {
  return <span data-slot="chip" className={cn(chipVariants({ tone, interactive }), className)} {...props} />
}
