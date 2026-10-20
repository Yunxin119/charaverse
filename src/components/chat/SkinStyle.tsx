'use client'

import { useEffect, useMemo } from 'react'
import { sanitizeCss } from '@/lib/skins/sanitizeCss'

const STYLE_ID = 'cv-character-skin'

/**
 * Injects an author's chat skin CSS, sanitized and scoped to #cv_chat_root.
 * Replaces the regex-based CharacterStyleInjector.
 */
export function SkinStyle({ css, allowedUrlHosts }: { css: string; allowedUrlHosts?: string[] }) {
  const safe = useMemo(() => (css?.trim() ? sanitizeCss(css, { allowedUrlHosts }).css : ''), [css, allowedUrlHosts])
  useEffect(() => {
    let el = document.getElementById(STYLE_ID) as HTMLStyleElement | null
    if (!safe) { el?.remove(); return }
    if (!el) {
      el = document.createElement('style')
      el.id = STYLE_ID
      document.head.appendChild(el)
    }
    el.textContent = safe
    return () => { document.getElementById(STYLE_ID)?.remove() }
  }, [safe])
  return null
}
