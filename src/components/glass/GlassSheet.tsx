'use client'

import * as React from 'react'
import * as DialogPrimitive from '@radix-ui/react-dialog'
import { XIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * Bottom sheet on small screens, side panel on large screens. Glass surface.
 * Composable like shadcn Dialog: <GlassSheet><GlassSheetTrigger/><GlassSheetContent/></GlassSheet>
 */
export const GlassSheet = DialogPrimitive.Root
export const GlassSheetTrigger = DialogPrimitive.Trigger
export const GlassSheetClose = DialogPrimitive.Close

export function GlassSheetContent({
  className,
  children,
  side = 'bottom',
  title,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Content> & { side?: 'bottom' | 'right'; title: string }) {
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-[color-mix(in_oklab,var(--cv-ink-900)_45%,transparent)] backdrop-blur-[2px] data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0" />
      <DialogPrimitive.Content
        className={cn(
          'fixed z-50 glass-strong flex flex-col gap-4 p-5 shadow-glass outline-none duration-(--cv-dur) ease-cv',
          side === 'bottom'
            ? 'inset-x-0 bottom-0 max-h-[88dvh] rounded-t-cv-xl safe-pb data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=open]:slide-in-from-bottom data-[state=closed]:slide-out-to-bottom sm:inset-x-auto sm:left-1/2 sm:bottom-6 sm:w-[min(560px,calc(100%-2rem))] sm:-translate-x-1/2 sm:rounded-cv-xl'
            : 'inset-y-3 right-3 w-[min(420px,calc(100%-1.5rem))] rounded-cv-xl data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=open]:slide-in-from-right data-[state=closed]:slide-out-to-right',
          className
        )}
        {...props}
      >
        {side === 'bottom' && <span aria-hidden className="mx-auto -mt-1 h-1.5 w-10 rounded-full bg-cv-fg/20 sm:hidden" />}
        <div className="flex items-center justify-between gap-3">
          <DialogPrimitive.Title className="font-display text-lg font-semibold">{title}</DialogPrimitive.Title>
          <DialogPrimitive.Close className="rounded-full p-1.5 text-cv-fg-muted hover:bg-cv-fg/10 focus-visible:ring-2 focus-visible:ring-cv-ring outline-none" aria-label="关闭">
            <XIcon className="size-4" />
          </DialogPrimitive.Close>
        </div>
        <div className="min-h-0 overflow-y-auto">{children}</div>
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  )
}
