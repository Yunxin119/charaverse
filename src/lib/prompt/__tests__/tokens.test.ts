import { describe, expect, it } from 'vitest'
import { estimateMessagesTokens, estimateTokens } from '../tokens'

describe('estimateTokens', () => {
  it('returns 0 for empty text', () => {
    expect(estimateTokens('')).toBe(0)
  })

  it('counts each CJK character as one token', () => {
    expect(estimateTokens('你好世界')).toBe(4)
    expect(estimateTokens('こんにちは')).toBe(5)
  })

  it('counts latin words times 1.3 rounded up', () => {
    expect(estimateTokens('hello world')).toBe(Math.ceil(2 * 1.3))
    expect(estimateTokens('one two three four five six seven eight nine ten')).toBe(13)
  })

  it('mixes CJK and words', () => {
    expect(estimateTokens('你好 hello')).toBe(2 + 2)
  })

  it('sums over messages', () => {
    expect(estimateMessagesTokens([{ content: '你好' }, { content: 'hi there' }])).toBe(2 + 3)
  })
})
