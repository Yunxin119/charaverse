import type { ThemeFile } from './schema'

const STYLE_ID = 'cv-user-theme'

/** Font stacks are user strings; keep them to safe characters before they enter CSS. */
function safeFont(v: string): string {
  return v.replace(/[^\w\s,'"\-]/g, '')
}

/**
 * Turn a validated theme file into a <style> block that overrides --cv-* tokens on :root.
 * Scoped to the theme's `mode` so a dark theme only overrides the dark branch.
 */
export function themeToCss(theme: ThemeFile): string {
  const decl: string[] = []
  for (const [k, v] of Object.entries(theme.tokens)) decl.push(`--cv-${k}: ${v};`)
  if (theme.glass.blur !== undefined) decl.push(`--cv-glass-blur: ${theme.glass.blur}px;`)
  if (theme.glass.saturate !== undefined) decl.push(`--cv-glass-saturate: ${Math.round(theme.glass.saturate * 100)}%;`)
  for (const [k, v] of Object.entries(theme.radius)) if (v !== undefined) decl.push(`--cv-radius-${k}: ${v}px;`)
  if (theme.fonts.body) decl.push(`--cv-font-sans: ${safeFont(theme.fonts.body)};`)
  if (theme.fonts.display) decl.push(`--cv-font-display: ${safeFont(theme.fonts.display)};`)
  if (theme.fonts.mono) decl.push(`--cv-font-mono: ${safeFont(theme.fonts.mono)};`)
  if (decl.length === 0) return ''
  const selector = theme.mode === 'dark' ? ':root[data-theme="dark"]' : ':root[data-theme="light"]'
  return `${selector} {\n  ${decl.join('\n  ')}\n}`
}

export function applyUserTheme(theme: ThemeFile | null): void {
  if (typeof document === 'undefined') return
  let el = document.getElementById(STYLE_ID) as HTMLStyleElement | null
  if (!theme) {
    el?.remove()
    return
  }
  if (!el) {
    el = document.createElement('style')
    el.id = STYLE_ID
    document.head.appendChild(el)
  }
  el.textContent = themeToCss(theme)
}
