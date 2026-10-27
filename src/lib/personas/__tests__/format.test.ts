import { describe, expect, it } from 'vitest'
import { formatPersonaText, resolvePersonaId } from '../format'

describe('formatPersonaText', () => {
  it('renders gender / age / details, skipping blanks', () => {
    expect(formatPersonaText({ name: '阿黎', gender: 'female', age: '24', details: '实习生。' })).toBe('性别：女\n年龄：24\n实习生。')
    expect(formatPersonaText({ name: '阿黎', gender: '', age: ' ', details: '' })).toBeUndefined()
    expect(formatPersonaText({ name: '阿黎', details: '  嘴硬心软  ' })).toBe('嘴硬心软')
  })
})

describe('resolvePersonaId', () => {
  const exists = (id: string) => ['a', 'b', 'd'].includes(id)
  it('null means no persona even when a default exists', () => {
    expect(resolvePersonaId(null, 'b', 'd', exists)).toBeNull()
  })
  it('session pick wins, then the character binding, then the default', () => {
    expect(resolvePersonaId('a', 'b', 'd', exists)).toBe('a')
    expect(resolvePersonaId(undefined, 'b', 'd', exists)).toBe('b')
    expect(resolvePersonaId(undefined, undefined, 'd', exists)).toBe('d')
    expect(resolvePersonaId(undefined, null, null, exists)).toBeNull()
  })
  it('falls through when the picked / bound persona was deleted', () => {
    expect(resolvePersonaId('gone', 'b', 'd', exists)).toBe('b')
    expect(resolvePersonaId('gone', 'gone', 'd', exists)).toBe('d')
    expect(resolvePersonaId('gone', 'gone', 'gone', exists)).toBeNull()
  })
})
