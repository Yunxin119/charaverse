'use client'

import { Toaster } from 'sonner'
import { useTheme } from '@/app/contexts/ThemeContext'

/** App-wide toasts (sonner) styled on the tokens; use `toast` from 'sonner' anywhere. */
export function AppToaster() {
  const { resolvedTheme } = useTheme()
  return (
    <Toaster
      theme={resolvedTheme}
      position="top-center"
      closeButton
      toastOptions={{
        className: 'glass-strong !rounded-cv-md !border-cv-glass-border !text-cv-fg !shadow-glass',
        descriptionClassName: '!text-cv-fg-muted',
      }}
    />
  )
}
