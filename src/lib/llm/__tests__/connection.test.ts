import { describe, expect, it } from 'vitest'
import { decodeConnection, encodeConnection, type Connection } from '../connection'

describe('connection header codec', () => {
  const conn: Connection = { kind: 'openai-compatible', apiKey: 'sk-test-键', baseUrl: 'https://relay.example.com', model: 'gpt-4o', label: '中转' }
  it('round-trips unicode and is base64url', () => {
    const h = encodeConnection(conn)
    expect(h).toMatch(/^[A-Za-z0-9_-]+$/)
    expect(decodeConnection(h)).toEqual(conn)
  })
  it('rejects garbage, missing header and schema violations', () => {
    expect(decodeConnection(null)).toBeNull()
    expect(decodeConnection('!!!')).toBeNull()
    expect(decodeConnection(encodeConnection({ ...conn, kind: 'nope' as Connection['kind'] }))).toBeNull()
    expect(decodeConnection(encodeConnection({ ...conn, apiKey: '' }))).toBeNull()
  })
})
