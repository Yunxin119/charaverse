import { describe, expect, it } from 'vitest'
import { assertSafeBaseUrl, assertSafeModel, summarizeUpstreamError, GuardError } from '../llmGuards'

describe('assertSafeBaseUrl (SSRF guard)', () => {
  it('accepts public https hosts and normalizes', () => {
    expect(assertSafeBaseUrl('https://api.example.com/v1/')).toBe('https://api.example.com/v1')
    expect(assertSafeBaseUrl('  https://relay.example.org  ')).toBe('https://relay.example.org')
  })
  it.each([
    ['http://api.example.com', 'https'],
    ['https://127.0.0.1/v1', 'IP'],
    ['https://10.0.0.5', 'IP'],
    ['https://[::1]/v1', 'IP'],
    ['https://169.254.169.254/latest/meta-data', 'IP'],
    ['https://localhost:3000', '内部'],
    ['https://foo.localhost', '内部'],
    ['https://metadata.google.internal', '内部'],
    ['https://api.example.com/v1?x=1', '查询'],
    ['https://api.example.com/v1#frag', '查询'],
    ['https://user:pw@api.example.com', '账号'],
    ['https://intranet', '主机名'],
    ['not a url', '合法'],
    ['file:///etc/passwd', 'https'],
  ])('rejects %s', (url, fragment) => {
    expect(() => assertSafeBaseUrl(url)).toThrow(GuardError)
    expect(() => assertSafeBaseUrl(url)).toThrow(fragment)
  })
})

describe('assertSafeModel', () => {
  it('accepts normal ids', () => {
    expect(assertSafeModel(' gpt-4o ')).toBe('gpt-4o')
    expect(assertSafeModel('claude-sonnet-4-5')).toBe('claude-sonnet-4-5')
    expect(assertSafeModel('vendor/model:latest')).toBe('vendor/model:latest')
  })
  it('rejects path tricks and junk', () => {
    expect(() => assertSafeModel('../admin')).toThrow(GuardError)
    expect(() => assertSafeModel('gpt 4o')).toThrow(GuardError)
    expect(() => assertSafeModel('')).toThrow(GuardError)
    expect(() => assertSafeModel('x'.repeat(200))).toThrow(GuardError)
  })
})

describe('summarizeUpstreamError', () => {
  it('extracts error.message from JSON and truncates', () => {
    expect(summarizeUpstreamError(429, JSON.stringify({ error: { message: 'Rate limit exceeded' } }))).toBe('HTTP 429: Rate limit exceeded')
    const long = JSON.stringify({ message: 'x'.repeat(1000) })
    expect(summarizeUpstreamError(500, long).length).toBeLessThan(320)
  })
  it('never echoes a non-JSON body', () => {
    expect(summarizeUpstreamError(502, '<html>internal admin page with secrets</html>')).toBe('HTTP 502')
  })
})
