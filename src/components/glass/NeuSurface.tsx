import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const neuVariants = cva('rounded-cv-lg transition-shadow duration-(--cv-dur) ease-cv', {
  variants: {
    inset: { false: 'neu', true: 'neu-in' },
    padding: { none: '', sm: 'p-3', md: 'p-5', lg: 'p-7' },
  },
  defaultVariants: { inset: false, padding: 'md' },
})

export interface NeuSurfaceProps extends React.ComponentProps<'div'>, VariantProps<typeof neuVariants> {}

/** Soft-extruded surface: inputs, settings cards, pressed state via `inset`. */
export function NeuSurface({ className, inset, padding, ...props }: NeuSurfaceProps) {
  return <div data-slot="neu-surface" className={cn(neuVariants({ inset, padding }), className)} {...props} />
}
