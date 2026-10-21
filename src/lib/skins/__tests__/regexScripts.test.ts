import { describe, expect, it } from 'vitest'
import {
  HTML_BLOCK_CLOSE,
  HTML_BLOCK_OPEN,
  applyRegexScripts,
  importRegexJson,
  importExternalRegex,
  parseRegexScripts,
  regexScriptSchema,
  splitSlashRegex,
  type RegexScript,
} from '../regexScripts'

function mk(partial: Partial<RegexScript> & { find: string }): RegexScript {
  return regexScriptSchema.parse({ id: partial.id ?? 'x', ...partial })
}

describe('splitSlashRegex', () => {
  it('splits /pattern/flags', () => {
    expect(splitSlashRegex('/foo/gi')).toEqual({ pattern: 'foo', flags: 'gi' })
    expect(splitSlashRegex('/foo/')).toEqual({ pattern: 'foo', flags: '' })
  })
  it('handles escaped slashes inside the pattern', () => {
    expect(splitSlashRegex('/a\\/b/g')).toEqual({ pattern: 'a\\/b', flags: 'g' })
    expect(splitSlashRegex('/a\\//')).toEqual({ pattern: 'a\\/', flags: '' })
  })
  it('returns null for non-slash form', () => {
    expect(splitSlashRegex('foo')).toBeNull()
    expect(splitSlashRegex('/foo/zz')).toBeNull()
  })
})

describe('importExternalRegex', () => {
  it('imports a single external script with slashes, flags, {{match}}, placement, trimStrings', () => {
    const res = importExternalRegex({
      scriptName: 'Thoughts',
      findRegex: '/<think>([\\s\\S]*?)<\\/think>/gi',
      replaceString: '<details>{{match}} :: $1</details>',
      trimStrings: ['<think>', '</think>'],
      placement: [2],
      disabled: false,
    })
    expect(res.ok).toBe(true)
    if (!res.ok) return
    expect(res.scripts).toHaveLength(1)
    const s = res.scripts[0]
    expect(s.find).toBe('<think>([\\s\\S]*?)<\\/think>')
    expect(s.flags).toBe('gi')
    expect(s.replace).toBe('<details>$& :: $1</details>')
    expect(s.trimStrings).toEqual(['<think>', '</think>'])
    expect(s.target).toBe('ai')
    expect(s.enabled).toBe(true)
    expect(s.name).toBe('Thoughts')
    expect(s.id).toMatch(/^ext-thoughts-0$/)
  })

  it('maps placement to target', () => {
    const run = (placement?: number[]) =>
      importExternalRegex({ scriptName: 'p', findRegex: 'x', replaceString: '', placement })
    const t = (r: ReturnType<typeof run>) => (r.ok ? r.scripts[0].target : 'ERR')
    expect(t(run([1]))).toBe('user')
    expect(t(run([2]))).toBe('ai')
    expect(t(run([1, 2]))).toBe('both')
    expect(t(run(undefined))).toBe('ai')
    expect(t(run([0]))).toBe('both')
  })

  it('uses flags g for non-slash findRegex and keeps given id', () => {
    const res = importExternalRegex({ id: 'keep-me', scriptName: 'n', findRegex: 'a+', replaceString: 'b' })
    expect(res.ok && res.scripts[0].flags).toBe('g')
    expect(res.ok && res.scripts[0].id).toBe('keep-me')
  })

  it('respects disabled and promptOnly', () => {
    const res = importExternalRegex([
      { scriptName: 'off', findRegex: 'a', replaceString: '', disabled: true },
      { scriptName: 'po', findRegex: 'a', replaceString: '', promptOnly: true },
    ])
    expect(res.ok).toBe(true)
    if (!res.ok) return
    expect(res.scripts[0].enabled).toBe(false)
    expect(res.scripts[1].enabled).toBe(false)
    expect(res.scripts[1].name).toBe('po (promptOnly, 未支持)')
  })

  it('accepts array, single object and { scripts } wrappers', () => {
    const one = { scriptName: 'a', findRegex: 'a', replaceString: '' }
    expect(importExternalRegex(one).ok && (importExternalRegex(one) as { scripts: unknown[] }).scripts.length).toBe(1)
    const arr = importExternalRegex([one, one])
    expect(arr.ok && arr.scripts.length).toBe(2)
    const wrapped = importExternalRegex({ scripts: [one, one, one] })
    expect(wrapped.ok && wrapped.scripts.length).toBe(3)
    // derived ids are unique
    expect(wrapped.ok && new Set(wrapped.scripts.map((s) => s.id)).size).toBe(3)
  })

  it('rejects entries without findRegex', () => {
    const res = importExternalRegex({ scriptName: 'x', replaceString: '' })
    expect(res.ok).toBe(false)
    expect(!res.ok && res.error).toContain('findRegex')
    expect(importExternalRegex('nope').ok).toBe(false)
  })
})

describe('parseRegexScripts / importRegexJson', () => {
  it('parses our format and fills defaults + missing ids', () => {
    const res = parseRegexScripts([{ name: 'Hello World', find: 'a' }])
    expect(res.ok).toBe(true)
    if (!res.ok) return
    expect(res.scripts[0]).toMatchObject({ id: 'rx-hello-world-0', flags: 'g', enabled: true, target: 'ai', renderAsHtml: false, replace: '', trimStrings: [] })
  })

  it('reports validation errors', () => {
    const res = parseRegexScripts([{ id: 'x', find: 'a', flags: 'xyz' }])
    expect(res.ok).toBe(false)
    expect(!res.ok && res.error).toContain('flags')
  })

  it('importRegexJson detects external vs our format and bad JSON', () => {
    const ext = importRegexJson(JSON.stringify({ scriptName: 'a', findRegex: '/a/g', replaceString: 'b' }))
    expect(ext.ok && ext.scripts[0]).toMatchObject({ find: 'a', replace: 'b' })
    const ours = importRegexJson(JSON.stringify({ scripts: [{ id: 'q', find: 'a', replace: 'b' }] }))
    expect(ours.ok && ours.scripts[0].id).toBe('q')
    expect(importRegexJson('{not json').ok).toBe(false)
  })
})

describe('applyRegexScripts', () => {
  const ai = { role: 'assistant' as const }
  const user = { role: 'user' as const }

  it('applies enabled scripts in order, filtered by target', () => {
    const scripts = [
      mk({ id: '1', find: 'a', replace: 'b', target: 'ai' }),
      mk({ id: '2', find: 'b', replace: 'c', target: 'both' }),
      mk({ id: '3', find: 'c', replace: 'd', target: 'user' }),
      mk({ id: '4', find: 'd', replace: 'e', enabled: false, target: 'both' }),
    ]
    expect(applyRegexScripts('aaa', scripts, ai)).toBe('ccc')
    expect(applyRegexScripts('abc', scripts, user)).toBe('add')
  })

  it('supports $1 / $& / $0 / $$ / named groups', () => {
    expect(applyRegexScripts('foo bar', [mk({ find: '(\\w+) (\\w+)', replace: '$2 $1 [$&] ($0) $$' })], ai)).toBe('bar foo [foo bar] (foo bar) $')
    expect(applyRegexScripts('x=1', [mk({ find: '(?<k>\\w)=(?<v>\\d)', replace: '$<v>=$<k>' })], ai)).toBe('1=x')
  })

  it('removes trimStrings from the match and groups before substitution', () => {
    const script = mk({
      find: '<think>([\\s\\S]*?)</think>',
      replace: '[$&|$1]',
      trimStrings: ['<think>', '</think>', 'secret'],
    })
    expect(applyRegexScripts('a<think>secret hi</think>b', [script], ai)).toBe('a[ hi| hi]b')
  })

  it('skips invalid regexes', () => {
    const scripts = [mk({ id: 'bad', find: '(unclosed', replace: 'X' }), mk({ id: 'ok', find: 'a', replace: 'b' })]
    expect(applyRegexScripts('aa', scripts, ai)).toBe('bb')
  })

  it('wraps renderAsHtml output in sentinels per match', () => {
    const script = mk({ find: '\\[(\\w+)\\]', replace: '<b>$1</b>', renderAsHtml: true })
    expect(applyRegexScripts('x [a] y [b]', [script], ai)).toBe(
      `x ${HTML_BLOCK_OPEN}<b>a</b>${HTML_BLOCK_CLOSE} y ${HTML_BLOCK_OPEN}<b>b</b>${HTML_BLOCK_CLOSE}`,
    )
  })

  it('substitutes {{char}} / {{user}} (escaped on the find side)', () => {
    const script = mk({ find: '^{{char}}:', replace: '**{{char}}** ({{user}}):' })
    const ctx = { role: 'assistant' as const, char: 'A.B (x)', user: 'Me' }
    expect(applyRegexScripts('A.B (x): hi', [script], ctx)).toBe('**A.B (x)** (Me): hi')
    expect(applyRegexScripts('AxB (x): hi', [script], ctx)).toBe('AxB (x): hi')
  })

  it('honors flags (no g → first match only)', () => {
    expect(applyRegexScripts('aaa', [mk({ find: 'a', replace: 'b', flags: '' })], ai)).toBe('baa')
    expect(applyRegexScripts('AaA', [mk({ find: 'a', replace: 'b', flags: 'gi' })], ai)).toBe('bbb')
  })

  it('skips scripts on texts over the length guard', () => {
    const long = 'a'.repeat(60_001)
    expect(applyRegexScripts(long, [mk({ find: 'a', replace: 'b' })], ai)).toBe(long)
    const ok = 'a'.repeat(60_000)
    expect(applyRegexScripts(ok, [mk({ find: 'a', replace: 'b' })], ai)).toBe('b'.repeat(60_000))
  })

  it('leaves text untouched with no scripts', () => {
    expect(applyRegexScripts('hello', [], ai)).toBe('hello')
  })
})
