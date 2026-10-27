import { describe, expect, it } from 'vitest'
import { importChatText, toChatLog, toJsonl, toMarkdown, toPlainText } from '../format'

const input = {
  title: '雨夜',
  characterName: '冉澄',
  userName: '阿黎',
  settings: { model: 'c1/gpt-4o' },
  messages: [
    { role: 'assistant' as const, content: '你来了。', created_at: '2026-10-21T10:00:00.000Z', swipes: ['你来了。', '雨还没停。'], swipe_index: 0 },
    { role: 'user' as const, content: '不急。', created_at: '2026-10-21T10:01:00.000Z' },
    { role: 'system' as const, content: 'hidden' },
  ],
}

describe('chat log formats', () => {
  it('round-trips our json losslessly', () => {
    const json = JSON.stringify(toChatLog(input))
    const r = importChatText(json)
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.chat.source).toBe('charaverse')
    expect(r.chat.title).toBe('雨夜')
    expect(r.chat.messages).toHaveLength(3)
    expect(r.chat.messages[0].swipes).toEqual(['你来了。', '雨还没停。'])
    expect(r.chat.settings).toEqual({ model: 'c1/gpt-4o' })
  })
  it('exports and imports jsonl (system rows dropped, swipes kept)', () => {
    const jsonl = toJsonl(input)
    const lines = jsonl.trim().split('\n')
    expect(lines).toHaveLength(3)
    expect(JSON.parse(lines[0]).character_name).toBe('冉澄')
    const r = importChatText(jsonl)
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.chat.source).toBe('jsonl')
    expect(r.chat.userName).toBe('阿黎')
    expect(r.chat.messages.map((m) => m.role)).toEqual(['assistant', 'user'])
    expect(r.chat.messages[0].swipes).toHaveLength(2)
  })
  it('renders markdown and rejects junk', () => {
    const md = toMarkdown(input)
    expect(md).toContain('# 雨夜')
    expect(md).toContain('## 阿黎')
    expect(md).not.toContain('hidden')
    expect(importChatText('nope').ok).toBe(false)
    expect(importChatText('').ok).toBe(false)
  })
  it('markdown / plain text leave rerolls out unless asked', () => {
    const md = toMarkdown(input)
    expect(md).toContain('## 冉澄')
    expect(md).not.toContain('雨还没停')
    const mdAll = toMarkdown(input, { includeSwipes: true })
    expect(mdAll).toContain('<details><summary>备选回复 2/2</summary>')
    expect(mdAll).toContain('雨还没停。')
    expect(mdAll).not.toContain('hidden')
    const txt = toPlainText(input, { includeSwipes: true })
    expect(txt.startsWith('雨夜\n')).toBe(true)
    expect(txt).toContain('冉澄：\n你来了。')
    expect(txt).toContain('阿黎：\n不急。')
    expect(txt).toContain('（备选回复 2/2）\n雨还没停。')
    expect(toPlainText(input)).not.toContain('备选回复')
  })
})
