import * as React from 'react'
import { cn } from '@/lib/utils'

export interface PosterCardProps extends React.ComponentProps<'div'> {
  /** background tone */
  tone?: 'primary' | 'ink' | 'accent' | 'secondary'
  /** optional full-bleed image behind the shapes */
  image?: string
}

const tones: Record<NonNullable<PosterCardProps['tone']>, string> = {
  primary: 'bg-cv-primary text-cv-primary-fg',
  ink: 'bg-[var(--cv-ink-700)] text-[var(--cv-cream-200)]',
  accent: 'bg-cv-accent text-white',
  secondary: 'bg-cv-secondary text-cv-secondary-fg',
}

/**
 * Flat "poster" card: solid colour block with geometric accents and a display-serif title.
 * Used for character covers, empty states and onboarding.
 */
export function PosterCard({ className, tone = 'primary', image, children, style, ...props }: PosterCardProps) {
  return (
    <div
      data-slot="poster-card"
      className={cn('relative overflow-hidden rounded-cv-lg p-6 min-h-44 isolate', tones[tone], className)}
      style={image ? { ...style, backgroundImage: `url(${image})`, backgroundSize: 'cover', backgroundPosition: 'center' } : style}
      {...props}
    >
      {image && <div aria-hidden className="absolute inset-0 -z-10 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />}
      {!image && (
        <>
          <span aria-hidden className="pointer-events-none absolute -right-10 -bottom-16 size-52 rounded-full bg-cv-accent opacity-85 -z-10" />
          <span aria-hidden className="pointer-events-none absolute right-14 -top-12 size-28 rounded-full bg-cv-secondary opacity-90 -z-10" />
        </>
      )}
      <div className="relative">{children}</div>
    </div>
  )
}

export function PosterTitle({ className, ...props }: React.ComponentProps<'h3'>) {
  return <h3 className={cn('font-display text-2xl font-semibold leading-tight tracking-tight', className)} {...props} />
}
