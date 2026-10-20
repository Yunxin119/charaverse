import { HTML_BLOCK_CLOSE, HTML_BLOCK_OPEN } from './regexScripts'

export type Segment = { type: 'md'; text: string } | { type: 'html'; html: string }

/**
 * Tags that start a raw HTML block when `renderHtml` is on. Inline tags (b/i/em) stay markdown.
 */
const BLOCK_TAGS = ['div', 'section', 'article', 'details', 'table', 'figure', 'center', 'style', 'aside', 'header', 'footer', 'nav', 'main', 'svg', 'font', 'template']
const OPEN_RE = new RegExp(`<(${BLOCK_TAGS.join('|')})(\\s[^>]*)?>`, 'i')

/**
 * Split message text into markdown and HTML segments.
 * 1. Sentinel-wrapped output from regex scripts is always HTML.
 * 2. When `allowRawHtml`, contiguous raw HTML blocks (div/section/style/… with their closing tags) are HTML too.
 */
export function splitHtmlBlocks(text: string, allowRawHtml: boolean): Segment[] {
  const out: Segment[] = []
  const push = (s: Segment) => {
    if (s.type === 'md' && !s.text.trim()) return
    const last = out[out.length - 1]
    if (last && last.type === 'html' && s.type === 'html') last.html += s.html
    else out.push(s)
  }

  // pass 1: sentinels
  const parts: Segment[] = []
  let rest = text
  for (;;) {
    const i = rest.indexOf(HTML_BLOCK_OPEN)
    if (i < 0) { parts.push({ type: 'md', text: rest }); break }
    const j = rest.indexOf(HTML_BLOCK_CLOSE, i + HTML_BLOCK_OPEN.length)
    if (j < 0) { parts.push({ type: 'md', text: rest.replaceAll(HTML_BLOCK_OPEN, '') }); break }
    parts.push({ type: 'md', text: rest.slice(0, i) })
    parts.push({ type: 'html', html: rest.slice(i + HTML_BLOCK_OPEN.length, j) })
    rest = rest.slice(j + HTML_BLOCK_CLOSE.length)
  }

  // pass 2: raw html inside md parts
  for (const p of parts) {
    if (p.type === 'html' || !allowRawHtml) { push(p); continue }
    let t = p.text
    for (;;) {
      const m = OPEN_RE.exec(t)
      if (!m) { push({ type: 'md', text: t }); break }
      const start = m.index
      const end = findBlockEnd(t, start, m[1].toLowerCase())
      if (end < 0) { push({ type: 'md', text: t }); break }
      push({ type: 'md', text: t.slice(0, start) })
      push({ type: 'html', html: t.slice(start, end) })
      t = t.slice(end)
    }
  }
  return out
}

/** Find the index just after the closing tag that balances the block opened at `start`. */
function findBlockEnd(text: string, start: number, tag: string): number {
  const tagRe = new RegExp(`<(/?)(${tag})(\\s[^>]*)?/?>`, 'gi')
  tagRe.lastIndex = start
  let depth = 0
  let m: RegExpExecArray | null
  while ((m = tagRe.exec(text))) {
    const selfClosing = m[0].endsWith('/>')
    if (m[1] === '/') {
      depth--
      if (depth === 0) {
        // swallow directly following block tags (e.g. <style> then <div>) handled by the outer loop
        return m.index + m[0].length
      }
    } else if (!selfClosing) {
      depth++
    }
  }
  return -1
}
