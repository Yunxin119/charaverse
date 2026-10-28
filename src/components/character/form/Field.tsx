import * as React from 'react'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'

interface FieldProps {
  id?: string
  label: React.ReactNode
  hint?: React.ReactNode
  error?: string
  required?: boolean
  className?: string
  children: React.ReactNode
}

/** Label + control + hint/error, the one layout every form field uses. */
export function Field({ id, label, hint, error, required, className, children }: FieldProps) {
  return (
    <div className={cn('space-y-1.5', className)}>
      <Label htmlFor={id} className="flex items-center gap-1 text-xs font-semibold tracking-wide text-cv-fg-muted">
        {label}
        {required && <span aria-hidden className="text-cv-accent">*</span>}
      </Label>
      {children}
      {error ? (
        <p role="alert" className="text-xs text-cv-danger">{error}</p>
      ) : hint ? (
        <p className="text-xs text-cv-fg-subtle">{hint}</p>
      ) : null}
    </div>
  )
}

interface SectionHeaderProps {
  title: string
  description?: React.ReactNode
  /** poster-style running number, e.g. "01" */
  index?: string
  /** id for the heading (aria-labelledby) */
  id?: string
  action?: React.ReactNode
  /** small chip next to the title */
  badge?: React.ReactNode
  className?: string
}

/** Heading of one section of the editor document: accent numeral, display title, one-line description. */
export function SectionHeader({ title, description, index, id, action, badge, className }: SectionHeaderProps) {
  return (
    <header className={cn('mb-5 flex flex-wrap items-end justify-between gap-3', className)}>
      <div className="flex min-w-0 items-start gap-3">
        {index && <span aria-hidden className="mt-1.5 font-display text-sm font-semibold tabular-nums tracking-widest text-cv-accent">{index}</span>}
        <div className="min-w-0">
          <h2 id={id} className="flex items-center gap-2 font-display text-2xl font-semibold tracking-tight">
            {title}
            {badge}
          </h2>
          {description && <p className="mt-1 text-sm text-cv-fg-muted">{description}</p>}
        </div>
      </div>
      {action}
    </header>
  )
}
