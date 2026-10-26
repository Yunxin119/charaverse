import { describe, expect, it } from 'vitest'
import { composeSkinCss, knobsToCss, skinKnobsSchema } from '../knobs'
import { parseSkin, skinIsEmpty } from '../schema'
import { sanitizeCss } from '../sanitizeCss'

describe('skin knobs', () => {
  it('compiles only the knobs that are set', () => {
    expect(knobsToCss({})).toBe('')
    const css = knobsToCss({ aiBubbleBg: '#112233', bubbleOpacity: 0.5, bubbleRadius: 8, fontSize: 16, fontFamily: 'serif', overlay: 0.4, metaColor: '#ffcc99' })
    expect(css).toContain('.cv_ai_message_bubble { background: color-mix(in oklab, #112233 50%, transparent); }')
    expect(css).toContain('.cv_user_message_bubble { background: color-mix(in oklab, var(--cv-primary) 50%, transparent); }')
    expect(css).toContain('border-radius: 8px')
    expect(css).toContain('font-size: 16px')
    expect(css).toContain('Noto Serif SC')
    expect(css).toContain('#cv_background_overlay { background: rgba(0, 0, 0, 0.4); }')
    expect(css).toContain('.cv_message_meta { color: #ffcc99; }')
  })

  it('survives the sanitizer with every selector scoped', () => {
    const out = sanitizeCss(knobsToCss({ aiBubbleBg: '#112233', fontFamily: 'mono', overlay: 0.2 }), {})
    expect(out.css).toContain('#cv_chat_root .cv_ai_message_bubble')
    expect(out.css).toContain('#cv_chat_root #cv_background_overlay')
    expect(out.warnings).toEqual([])
  })

  it('puts knob css before the advanced css and rejects bad values', () => {
    expect(composeSkinCss({ bubbleRadius: 4 }, '.x { color: red }')).toMatch(/^\/\* knobs \*\/[\s\S]*\n\n\.x \{ color: red \}$/)
    expect(skinKnobsSchema.safeParse({ aiBubbleBg: 'red' }).success).toBe(false)
    expect(skinKnobsSchema.safeParse({ fontSize: 40 }).success).toBe(false)
    const s = parseSkin({ knobs: { bubbleRadius: 12 } })
    expect(s.knobs.bubbleRadius).toBe(12)
    expect(skinIsEmpty(s)).toBe(false)
    expect(skinIsEmpty(parseSkin({}))).toBe(true)
  })
})
