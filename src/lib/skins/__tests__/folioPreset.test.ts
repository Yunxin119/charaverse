import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { sanitizeCss } from '../sanitizeCss'
import { CSS_PRESETS } from '../docs'

const FOLIO = readFileSync(resolve(process.cwd(), 'docs/design/skins/folio-paper.css'), 'utf8')

describe('skin CSS samples', () => {
  it('docs/design/skins/folio-paper.css passes the sanitizer untouched and stays scoped', () => {
    const r = sanitizeCss(FOLIO)
    expect(r.warnings).toEqual([])
    expect(r.css).toContain('#cv_chat_root:is(.dark *,[data-theme="dark"] *)')
    expect(r.css).toContain('#cv_chat_root .cv_message_row_ai>div{display:contents}')
    expect(r.css).toContain('#cv_chat_root #cv_background_image{opacity:var(--f-bg-show)!important')
    for (const rule of r.css.split('}')) {
      const sel = rule.split('{')[0].trim()
      if (!sel || sel.startsWith('@')) continue
      expect(sel.startsWith('#cv_chat_root')).toBe(true)
    }
  })
  it('every built-in starter preset sanitizes cleanly', () => {
    for (const p of CSS_PRESETS) expect(sanitizeCss(p.css).warnings).toEqual([])
  })
})
