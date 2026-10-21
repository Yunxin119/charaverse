'use client'

import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const iconButtonVariants = cva(
  'inline-flex shrink-0 items-center justify-center rounded-full text-cv-fg transition-[transform,box-shadow,background-color] duration-(--cv-dur-fast) ease-cv outline-none focus-visible:ring-2 focus-visible:ring-cv-ring disabled:pointer-events-none disabled:opacity-50 active:scale-95 [&_svg]:shrink-0 [&_svg:not([class*=size-])]:size-[1.1em]',
  {
    variants: {
      variant: {
        glass: 'glass-strong hover:bg-cv-glass-strong',
        neu: 'neu hover:shadow-neu-sm active:shadow-neu-in-sm',
        ghost: 'hover:bg-[color-mix(in_oklab,var(--cv-fg)_8%,transparent)]',
        primary: 'bg-cv-primary text-cv-primary-fg hover:bg-cv-primary-hover shadow-[0_10px_24px_-10px_var(--cv-primary)]',
        accent: 'bg-cv-accent text-cv-accent-fg shadow-[0_10px_24px_-10px_var(--cv-accent)] hover:brightness-105',
      },
      size: { sm: 'size-8 text-sm', md: 'size-10 text-base', lg: 'size-12 text-lg' },
    },
    defaultVariants: { variant: 'ghost', size: 'md' },
  }
)

export interface IconButtonProps extends React.ComponentProps<'button'>, VariantProps<typeof iconButtonVariants> {
  /** accessible name (required: icon-only control) */
  label: string
}

export function IconButton({ className, variant, size, label, type = 'button', ...props }: IconButtonProps) {
  return (
    <button
      type={type}
      aria-label={label}
      title={label}
      data-slot="icon-button"
      className={cn(iconButtonVariants({ variant, size }), className)}
      {...props}
    />
  )
}
