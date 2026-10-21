import { describe, expect, it } from 'vitest'
import { importExternalLorebook, importLorebookJson, lorebookSchema, parseLorebook } from '../schema'
import { activateLorebooks } from '../activate'

const external = {
  entries: {
    '0': { uid: 0, key: ['雨夜', 'rain'], keysecondary: [], comment: '天气', content: '这座城市一年有二百天在下雨。', constant: false, selective: false, order: 10, position: 0, disable: false, probability: 100, useProbability: true },
    '1': { uid: 1, key: ['车库'], keysecondary: ['钥匙'], comment: '车库', content: '车库里停着一辆没上牌的 GT3。', selective: true, order: 5, position: 1, disable: false },
    '2': { uid: 2, key: [], comment: '世界观', content: '故事发生在 2031 年。', constant: true, order: 0, position: 0 },
    '3': { uid: 3, key: ['禁用'], content: '不该出现', disable: true },
    '4': { uid: 4, key: ['空'], content: '   ' },
  },
}

describe('lorebook import', () => {
  it('imports the external object-map format', () => {
    const r = importExternalLorebook(external)
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.book.entries).toHaveLength(4) // empty-content entry dropped
    const byName = Object.fromEntries(r.book.entries.map((e) => [e.name, e]))
    expect(byName['天气'].position).toBe('before')
    expect(byName['车库'].position).toBe('after')
    expect(byName['车库'].selective).toBe(true)
    expect(byName['车库'].secondaryKeys).toEqual(['钥匙'])
    expect(byName['世界观'].constant).toBe(true)
    expect(r.book.entries.find((e) => e.id === '3')?.enabled).toBe(false)
  })
  it('imports a card-embedded array format and our own format', () => {
    const card = { name: '内嵌', entries: [{ keys: ['酒吧'], secondary_keys: [], content: '老板娘认识所有人。', enabled: true, insertion_order: 3, position: 'before_char', constant: false }] }
    const r = importLorebookJson(JSON.stringify(card))
    expect(r.ok && r.book.entries[0].position).toBe('before')
    const own = importLorebookJson(JSON.stringify(lorebookSchema.parse({ name: 'x', entries: [{ id: 'a', keys: ['k'], content: 'v' }] })))
    expect(own.ok && own.book.entries[0].id).toBe('a')
    expect(importLorebookJson('{').ok).toBe(false)
    expect(parseLorebook({ entries: [{ id: 'a', keys: ['k'], content: 'v', position: 'sideways' }] }).ok).toBe(false)
  })
})

describe('activateLorebooks', () => {
  const book = (importExternalLorebook(external) as { ok: true; book: ReturnType<typeof lorebookSchema.parse> }).book
  it('fires constant entries and keyword matches within scan depth', () => {
    const r = activateLorebooks({ books: [book], recent: [{ role: 'user', content: '雨夜，我走进了车库。' }], random: () => 0 })
    expect(r.before).toContain('2031')
    expect(r.before).toContain('二百天')
    expect(r.after).toBe('') // 车库 is selective and 钥匙 is missing
    const r2 = activateLorebooks({ books: [book], recent: [{ role: 'assistant', content: '车库的钥匙在你手里。' }], random: () => 0 })
    expect(r2.after).toContain('GT3')
  })
  it('respects scan depth, disabled entries and the character budget', () => {
    const old = { role: 'user' as const, content: '雨夜' }
    const filler = Array.from({ length: 10 }, () => ({ role: 'assistant' as const, content: '……' }))
    const r = activateLorebooks({ books: [{ ...book, scanDepth: 3 }], recent: [old, ...filler], random: () => 0 })
    expect(r.before).not.toContain('二百天')
    expect(r.before).toContain('2031')
    const r3 = activateLorebooks({ books: [book], recent: [{ role: 'user', content: '禁用' }], random: () => 0 })
    expect(r3.after + r3.before).not.toContain('不该出现')
    const tiny = { ...book, tokenBudget: 100, entries: book.entries.map((e) => ({ ...e, content: e.content + 'x'.repeat(90) })) }
    const r4 = activateLorebooks({ books: [tiny], recent: [{ role: 'user', content: '雨夜 车库 钥匙' }], random: () => 0 })
    expect(r4.droppedForBudget).toBeGreaterThan(0)
  })
  it('supports /regex/ keys and probability', () => {
    const b = lorebookSchema.parse({ name: 'r', entries: [
      { id: 'rx', keys: ['/第[一二三]天/'], content: '日程' },
      { id: 'coin', keys: ['硬币'], content: '正面', probability: 50 },
    ] })
    expect(activateLorebooks({ books: [b], recent: [{ role: 'user', content: '第二天早上' }], random: () => 0 }).after).toContain('日程')
    expect(activateLorebooks({ books: [b], recent: [{ role: 'user', content: '硬币' }], random: () => 0.9 }).after).toBe('')
    expect(activateLorebooks({ books: [b], recent: [{ role: 'user', content: '硬币' }], random: () => 0.1 }).after).toContain('正面')
  })
})
