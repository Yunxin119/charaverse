'use client'

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { applyUserTheme } from '@/lib/theme/applyTheme'
import { parseTheme, type ThemeFile } from '@/lib/theme/schema'

export type ThemeMode = 'light' | 'dark' | 'system'
export type ResolvedTheme = 'light' | 'dark'

const MODE_KEY = 'cv.theme.mode'
const USER_THEME_KEY = 'cv.theme.user'

interface ThemeContextType {
  /** light / dark / system */
  theme: ThemeMode
  resolvedTheme: ResolvedTheme
  setTheme: (mode: ThemeMode) => void
  /** currently applied user-imported theme (null = built-in Warm Glass) */
  userTheme: ThemeFile | null
  setUserTheme: (theme: ThemeFile | null) => void
  /** parse + apply a theme JSON string; returns an error message on failure */
  importThemeJson: (json: string) => string | null
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined)

function systemTheme(): ResolvedTheme {
  if (typeof window === 'undefined') return 'light'
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

function applyMode(resolved: ResolvedTheme) {
  const root = document.documentElement
  root.dataset.theme = resolved
  root.classList.toggle('dark', resolved === 'dark')
  const meta = document.querySelector('meta[name="theme-color"]')
  if (meta) meta.setAttribute('content', resolved === 'dark' ? '#1c1410' : '#f2dece')
}

function readStoredMode(): ThemeMode {
  try {
    const v = localStorage.getItem(MODE_KEY)
    if (v === 'light' || v === 'dark' || v === 'system') return v
  } catch {}
  return 'system'
}

function readStoredUserTheme(): ThemeFile | null {
  try {
    const raw = localStorage.getItem(USER_THEME_KEY)
    if (!raw) return null
    const r = parseTheme(JSON.parse(raw))
    return r.ok ? r.theme : null
  } catch {
    return null
  }
}

/**
 * Inline script rendered in <head> so the first paint already has the right
 * data-theme / .dark class (no flash of the wrong theme). Keep in sync with applyMode().
 */
export function ThemeScript() {
  const js = `(function(){try{var m=localStorage.getItem('${MODE_KEY}');var d=m==='dark'||(m!=='light'&&matchMedia('(prefers-color-scheme: dark)').matches);var r=document.documentElement;r.dataset.theme=d?'dark':'light';if(d)r.classList.add('dark');}catch(e){}})();`
  return <script dangerouslySetInnerHTML={{ __html: js }} />
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<ThemeMode>('system')
  const [resolvedTheme, setResolvedTheme] = useState<ResolvedTheme>('light')
  const [userTheme, setUserThemeState] = useState<ThemeFile | null>(null)

  // hydrate from storage once
  useEffect(() => {
    const mode = readStoredMode()
    const resolved = mode === 'system' ? systemTheme() : mode
    setThemeState(mode)
    setResolvedTheme(resolved)
    applyMode(resolved)
    const ut = readStoredUserTheme()
    setUserThemeState(ut)
    applyUserTheme(ut)
  }, [])

  // follow the OS while in system mode
  useEffect(() => {
    if (theme !== 'system') return
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const onChange = () => {
      const r = systemTheme()
      setResolvedTheme(r)
      applyMode(r)
    }
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [theme])

  const setTheme = useCallback((mode: ThemeMode) => {
    setThemeState(mode)
    try { localStorage.setItem(MODE_KEY, mode) } catch {}
    const r = mode === 'system' ? systemTheme() : mode
    setResolvedTheme(r)
    applyMode(r)
  }, [])

  const setUserTheme = useCallback((t: ThemeFile | null) => {
    setUserThemeState(t)
    applyUserTheme(t)
    try {
      if (t) localStorage.setItem(USER_THEME_KEY, JSON.stringify(t))
      else localStorage.removeItem(USER_THEME_KEY)
    } catch {}
    if (t) setTheme(t.mode)
  }, [setTheme])

  const importThemeJson = useCallback((json: string): string | null => {
    let parsed: unknown
    try { parsed = JSON.parse(json) } catch { return 'JSON 格式错误' }
    const r = parseTheme(parsed)
    if (!r.ok) return r.error
    setUserTheme(r.theme)
    return null
  }, [setUserTheme])

  const value = useMemo(
    () => ({ theme, resolvedTheme, setTheme, userTheme, setUserTheme, importThemeJson }),
    [theme, resolvedTheme, setTheme, userTheme, setUserTheme, importThemeJson]
  )

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export function useTheme() {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme must be used within a ThemeProvider')
  return ctx
}
