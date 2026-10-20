'use client'

import { useEffect, useRef } from 'react'
import { useAuth } from '@/providers/AuthProvider'
import { useTheme } from '@/app/contexts/ThemeContext'
import { useUserThemes } from '@/queries/useThemes'
import { parseTheme } from '@/lib/theme/schema'

/**
 * Once per login, pull the user's active theme from the DB and apply it
 * (localStorage is only a cache for the first paint).
 */
export function ThemeSync() {
  const { user } = useAuth()
  const { setUserTheme, userTheme } = useTheme()
  const themes = useUserThemes(user?.id)
  const applied = useRef<string | null>(null)

  useEffect(() => {
    if (!themes.data) return
    const active = themes.data.find((t) => t.is_active) ?? null
    const sig = active ? `${active.id}:${active.updated_at}` : 'none'
    if (applied.current === sig) return
    applied.current = sig
    if (!active) {
      if (userTheme) setUserTheme(null)
      return
    }
    const r = parseTheme(active.data)
    if (r.ok) setUserTheme(r.theme)
  }, [themes.data, setUserTheme, userTheme])

  return null
}
