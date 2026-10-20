import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const glassPanelVariants = cva('rounded-cv-lg', {
  variants: {
    strength: { soft: 'glass', strong: 'glass-strong' },
    padding: { none: '', sm: 'p-3', md: 'p-5', lg: 'p-7' },
  },
  defaultVariants: { strength: 'soft', padding: 'md' },
})

export interface GlassPanelProps extends React.ComponentProps<'div'>, VariantProps<typeof glassPanelVariants> {}

/** Frosted panel: floating layers, sidebars, AI bubbles, headers. */
export function GlassPanel({ className, strength, padding, ...props }: GlassPanelProps) {
  return <div data-slot="glass-panel" className={cn(glassPanelVariants({ strength, padding }), className)} {...props} />
}
