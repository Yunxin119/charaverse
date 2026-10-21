import { describe, expect, it } from 'vitest'
import { applyMacros } from '../macros'

const ctx = { char: '小玉', user: '阿云' }

describe('applyMacros', () => {
  it('replaces {{char}} and {{user}} case-insensitively', () => {
    expect(applyMacros('{{char}} 和 {{USER}} 还有 {{ Char }}', ctx)).toBe('小玉 和 阿云 还有 小玉')
  })

  it('handles newline and trim', () => {
    expect(applyMacros('a{{newline}}b{{trim}}c', ctx)).toBe('a\nbc')
  })

  it('fills date and time with non-empty strings', () => {
    const out = applyMacros('{{date}}|{{time}}', ctx)
    const [date, time] = out.split('|')
    expect(date.length).toBeGreaterThan(0)
    expect(time.length).toBeGreaterThan(0)
    expect(out).not.toContain('{{')
  })

  it('random picks one option and is deterministic with a seed', () => {
    const options = ['红', '绿', '蓝']
    const out = applyMacros('{{random:红,绿,蓝}}', ctx)
    expect(options).toContain(out)
    const a = applyMacros('{{random:红,绿,蓝}}-{{random::x::y}}', { ...ctx, seed: 42 })
    const b = applyMacros('{{random:红,绿,蓝}}-{{random::x::y}}', { ...ctx, seed: 42 })
    expect(a).toBe(b)
    const [first, second] = a.split('-')
    expect(options).toContain(first)
    expect(['x', 'y']).toContain(second)
  })

  it('leaves unknown macros untouched', () => {
    expect(applyMacros('{{lastMessage}} {{setvar::a::1}}', ctx)).toBe('{{lastMessage}} {{setvar::a::1}}')
  })

  it('returns empty string for empty input', () => {
    expect(applyMacros('', ctx)).toBe('')
  })
})
