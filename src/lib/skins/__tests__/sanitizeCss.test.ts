import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { sanitizeCss } from '../sanitizeCss'

const S = '#cv_chat_root'

describe('sanitizeCss', () => {
  it('unwraps <style> and strips other html tags', () => {
    const { css, warnings } = sanitizeCss('<div><style type="text/css">.a{color:red}</style></div>')
    expect(css).toBe(`${S} .a{color:red}`)
    expect(warnings).toEqual([])
  })

  it('returns empty for empty / whitespace input', () => {
    expect(sanitizeCss('')).toEqual({ css: '', warnings: [] })
    expect(sanitizeCss('   \n')).toEqual({ css: '', warnings: [] })
  })

  it('drops @import, @charset, @namespace, @page, @layer with warnings', () => {
    const raw = `@import url("https://evil.com/x.css"); @charset "utf-8"; @namespace svg url(http://www.w3.org/2000/svg); @page{margin:0} @layer base{.a{color:red}} .b{color:blue}`
    const { css, warnings } = sanitizeCss(raw)
    expect(css).toBe(`${S} .b{color:blue}`)
    expect(warnings).toContain('已移除不支持的 @import 规则')
    expect(warnings).toContain('已移除不支持的 @layer 规则')
    expect(warnings.some((w) => w.includes('@charset'))).toBe(true)
  })

  it('drops behavior / -moz-binding / expression / javascript: declarations', () => {
    const raw = `.a{behavior:url(#default#time2);-moz-binding:url(x.xml);width:expression(alert(1));color:red;background:url(javascript:alert(1))}`
    const { css, warnings } = sanitizeCss(raw)
    expect(css).toBe(`${S} .a{color:red}`)
    expect(warnings).toContain('已移除危险属性 behavior')
    expect(warnings).toContain('已移除危险属性 -moz-binding')
    expect(warnings).toContain('已移除包含 expression( 的声明')
  })

  it('catches escaped expression(', () => {
    const { css } = sanitizeCss(`.a{width:expr\\65ssion(1);color:red}`)
    expect(css).toBe(`${S} .a{color:red}`)
  })

  it('rewrites position: fixed to absolute with a single warning', () => {
    const { css, warnings } = sanitizeCss(`.a{position:fixed} .b{position:fixed !important} .c{position:sticky}`)
    expect(css).toBe(`${S} .a{position:absolute}${S} .b{position:absolute!important}${S} .c{position:sticky}`)
    expect(warnings.filter((w) => w.includes('fixed'))).toHaveLength(1)
  })

  it('scopes selector lists and pseudo-classes', () => {
    const { css } = sanitizeCss(`.a, .b:hover > span::before, [data-x="1"] ~ p{color:red}`)
    expect(css).toBe(`${S} .a,${S} .b:hover>span::before,${S} [data-x="1"]~p{color:red}`)
  })

  it('replaces leading body / :root / html with the scope', () => {
    expect(sanitizeCss(`body{color:red}`).css).toBe(`${S}{color:red}`)
    expect(sanitizeCss(`:root{--x:1}`).css).toBe(`${S}{--x:1}`)
    expect(sanitizeCss(`html{color:red}`).css).toBe(`${S}{color:red}`)
    expect(sanitizeCss(`body.dark .msg{color:red}`).css).toBe(`${S}.dark .msg{color:red}`)
    expect(sanitizeCss(`html body .msg{color:red}`).css).toBe(`${S} .msg{color:red}`)
    expect(sanitizeCss(`body > .msg{color:red}`).css).toBe(`${S}>.msg{color:red}`)
  })

  it('does not double-prefix selectors that already start with the scope', () => {
    expect(sanitizeCss(`${S} .a{color:red}`).css).toBe(`${S} .a{color:red}`)
    expect(sanitizeCss(`${S}{color:red}`).css).toBe(`${S}{color:red}`)
    // a different id that merely shares the prefix IS scoped
    expect(sanitizeCss(`${S}x .a{color:red}`).css).toBe(`${S} ${S}x .a{color:red}`)
  })

  it('supports a custom scope', () => {
    expect(sanitizeCss(`body{color:red} .a{color:blue}`, { scope: '.skin' }).css).toBe(`.skin{color:red}.skin .a{color:blue}`)
  })

  it('keeps @keyframes selectors unscoped', () => {
    const { css } = sanitizeCss(`@keyframes spin{from{transform:rotate(0)}50%{opacity:.5}to{transform:rotate(360deg)}} .a{animation:spin 1s}`)
    expect(css).toBe(`@keyframes spin{from{transform:rotate(0)}50%{opacity:.5}to{transform:rotate(360deg)}}${S} .a{animation:spin 1s}`)
  })

  it('recurses into @media / @supports / @container and scopes nested rules', () => {
    const { css } = sanitizeCss(
      `@media (max-width:600px){.a{color:red} @supports (display:grid){body{display:grid}}} @container (min-width:1px){.b{color:blue}}`,
    )
    expect(css).toBe(
      `@media (max-width:600px){${S} .a{color:red}@supports (display:grid){${S}{display:grid}}}@container (min-width:1px){${S} .b{color:blue}}`,
    )
  })

  it('drops a @media block that ends up empty', () => {
    const { css } = sanitizeCss(`@media print{@import url(x.css);}`)
    expect(css).toBe('')
  })

  describe('url() allowlist', () => {
    const ENV = 'NEXT_PUBLIC_SUPABASE_URL'
    let prev: string | undefined
    beforeEach(() => {
      prev = process.env[ENV]
      process.env[ENV] = 'https://abcxyz.supabase.co'
    })
    afterEach(() => {
      if (prev === undefined) delete process.env[ENV]
      else process.env[ENV] = prev
    })

    it('allows data:image, data:font, relative paths and allowlisted hosts', () => {
      const raw = [
        `.a{background:url(data:image/png;base64,AAAA)}`,
        `.b{background:url("/skins/bg.png")}`,
        `.c{background:url(https://i.imgur.com/x.png)}`,
        `.d{background:url("https://abcxyz.supabase.co/storage/v1/object/public/skins/x.png")}`,
        `.e{background:url(https://my.cdn.example/x.png)}`,
      ].join('')
      const { css, warnings } = sanitizeCss(raw, { allowedUrlHosts: ['my.cdn.example'] })
      expect(css).toBe(
        `${S} .a{background:url(data:image/png;base64,AAAA)}` +
          `${S} .b{background:url(/skins/bg.png)}` +
          `${S} .c{background:url(https://i.imgur.com/x.png)}` +
          `${S} .d{background:url(https://abcxyz.supabase.co/storage/v1/object/public/skins/x.png)}` +
          `${S} .e{background:url(https://my.cdn.example/x.png)}`,
      )
      expect(warnings).toEqual([])
    })

    it('denies random https hosts, http, protocol-relative and non-image data uris', () => {
      const raw = [
        `.a{background:url(https://evil.example/x.png);color:red}`,
        `.b{background:url(http://i.imgur.com/x.png)}`,
        `.c{background:url(//evil.example/x.png)}`,
        `.d{background:url(data:text/html;base64,AAAA)}`,
        `.e{--bg:url(https://evil.example/x.png)}`,
        `.f{background:image-set("https://evil.example/x.png" 1x)}`,
      ].join('')
      const { css, warnings } = sanitizeCss(raw)
      expect(css).toBe(`${S} .a{color:red}`)
      expect(warnings).toContain('url() 域名不在白名单: evil.example')
      expect(warnings).toContain('url() 不允许协议相对地址（//）')
      expect(warnings.some((w) => w.includes('https'))).toBe(true)
    })

    it('keeps @font-face with allowed src and drops it with a bad src', () => {
      const good = `@font-face{font-family:"X";src:url(https://fonts.gstatic.com/x.woff2) format("woff2")}`
      // css-tree re-generates compactly (no space before format()).
      expect(sanitizeCss(good).css).toBe(`@font-face{font-family:"X";src:url(https://fonts.gstatic.com/x.woff2)format("woff2")}`)
      const bad = `@font-face{font-family:"X";src:url(https://evil.example/x.woff2)} .a{color:red}`
      const { css, warnings } = sanitizeCss(bad)
      expect(css).toBe(`${S} .a{color:red}`)
      expect(warnings).toContain('已移除 @font-face：其 src 包含不在白名单内的地址')
    })

    it('tolerates a missing supabase env', () => {
      delete process.env[ENV]
      const { css } = sanitizeCss(`.a{background:url(https://abcxyz.supabase.co/x.png);color:red}`)
      expect(css).toBe(`${S} .a{color:red}`)
    })
  })

  it('rejects oversize input', () => {
    expect(sanitizeCss('.a{color:red}', { maxChars: 5 })).toEqual({ css: '', warnings: ['CSS 超过大小限制'] })
    expect(sanitizeCss('x'.repeat(100_001))).toEqual({ css: '', warnings: ['CSS 超过大小限制'] })
  })

  it('deduplicates warnings', () => {
    const { warnings } = sanitizeCss(`@import url(a.css); @import url(b.css);`)
    expect(warnings).toEqual(['已移除不支持的 @import 规则'])
  })

  it('survives garbage input without throwing', () => {
    expect(() => sanitizeCss('}}}{{{ .a{ color: ; } @@@ ')).not.toThrow()
  })
})
