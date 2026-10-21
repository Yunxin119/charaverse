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
      <Label htmlFor={id} className="flex items-center gap-1">
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

export function SectionHeader({ title, description, action }: { title: string; description?: string; action?: React.ReactNode }) {
  return (
    <header className="mb-4 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h2 className="font-display text-xl font-semibold">{title}</h2>
        {description && <p className="mt-0.5 text-sm text-cv-fg-muted">{description}</p>}
      </div>
      {action}
    </header>
  )
}
