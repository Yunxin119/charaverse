import { describe, expect, it } from 'vitest'
import { sanitizeCss } from '../sanitizeCss'
import { FOLIO_PAPER_CSS } from '../folioPreset'
import { CSS_PRESETS } from '../docs'
import { REGEX_TEMPLATES } from '../regexTest'

describe('Folio paper preset', () => {
  it('passes the sanitizer untouched and keeps its key rules', () => {
    const r = sanitizeCss(FOLIO_PAPER_CSS)
    expect(r.warnings).toEqual([])
    expect(r.css).toContain('#cv_chat_root:is(.dark *,[data-theme="dark"] *)')
    expect(r.css).toContain('#cv_chat_root .cv_message_row_ai>div{display:contents}')
    expect(r.css).toContain('#cv_chat_root #cv_background_image{opacity:var(--f-bg-show)!important')
    expect(r.css).toContain('@media (max-width:640px)')
    // nothing escaped the scope
    for (const rule of r.css.split('}')) {
      const sel = rule.split('{')[0].trim()
      if (!sel || sel.startsWith('@')) continue
      expect(sel.startsWith('#cv_chat_root')).toBe(true)
    }
  })
  it('every starter preset sanitizes cleanly and the Folio one brings a real regex template', () => {
    for (const p of CSS_PRESETS) expect(sanitizeCss(p.css).warnings).toEqual([])
    const folio = CSS_PRESETS.find((p) => p.name.startsWith('Folio'))!
    expect(REGEX_TEMPLATES.some((t) => t.id === folio.regexTemplateId)).toBe(true)
  })
})
