import { describe, expect, it } from 'vitest'
import { regexScriptSchema, type RegexScriptInput } from '../regexScripts'
import { REGEX_TEMPLATES, testRegexScript } from '../regexTest'

const mk = (over: Partial<RegexScriptInput> & { find: string }) =>
  regexScriptSchema.parse({ id: 'x', name: 'x', replace: '', ...over })

describe('regex test bench', () => {
  it('reports matches and the cumulative output', () => {
    const scripts = [mk({ id: 'a', find: 'foo', replace: 'bar' }), mk({ id: 'b', find: 'bar', replace: 'baz' })]
    const r0 = testRegexScript(scripts, 0, 'foo foo', { role: 'assistant' })
    expect(r0.matches.map((m) => m.text)).toEqual(['foo', 'foo'])
    expect(r0.output).toBe('bar bar')
    const r1 = testRegexScript(scripts, 1, 'foo foo', { role: 'assistant' })
    expect(r1.input).toBe('bar bar')
    expect(r1.matches).toHaveLength(2)
    expect(r1.output).toBe('baz baz')
  })

  it('flags invalid regex and skipped scripts without throwing', () => {
    const bad = mk({ find: '(' })
    const r = testRegexScript([bad], 0, 'x', { role: 'assistant' })
    expect(r.ok).toBe(false)
    expect(r.error).toBeTruthy()
    const off = mk({ find: 'x', enabled: false })
    expect(testRegexScript([off], 0, 'x', { role: 'assistant' }).skipped).toBe('disabled')
    const userOnly = mk({ find: 'x', target: 'user' })
    expect(testRegexScript([userOnly], 0, 'x', { role: 'assistant' }).skipped).toBe('role')
  })

  it('every template matches its own sample', () => {
    for (const t of REGEX_TEMPLATES) {
      const script = regexScriptSchema.parse({ id: t.id, ...t.script })
      const r = testRegexScript([script], 0, t.sample, { role: 'assistant', char: '澄', user: '你' })
      expect(r.ok, t.id).toBe(true)
      expect(r.matches.length, t.id).toBeGreaterThan(0)
      expect(r.output, t.id).not.toBe(t.sample)
    }
  })
})
