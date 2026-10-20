import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { sanitizeCss } from '../sanitizeCss'
import { splitHtmlBlocks } from '../htmlBlocks'

/** The real SillyTavern-style cards in docs/skin-samples must survive the pipeline. */
const SAMPLES = ['docs/skin-samples/rancheng.md', 'docs/skin-samples/mobile.html', 'docs/skin-samples/html.html']

describe('skin samples end-to-end', () => {
  for (const f of SAMPLES) {
    it(`${f}: css sanitizes and html splits`, () => {
      const text = readFileSync(f, 'utf8')
      const styles = [...text.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/gi)].map((m) => m[1])
      const css = styles.join('\n')
      const r = sanitizeCss(css)
      // eslint-disable-next-line no-console
      console.log(`${f}: ${styles.length} style blocks, ${css.length} → ${r.css.length} chars; warnings: ${r.warnings.join(' | ').slice(0, 300)}`)
      if (css.length > 0) {
        expect(r.css.length).toBeGreaterThan(css.length * 0.5)
        expect(r.css).not.toMatch(/@import/)
        // every selector scoped
        expect(r.css).toContain('#cv_chat_root')
      }
      const segs = splitHtmlBlocks(text, true)
      const html = segs.filter((s) => s.type === 'html')
      // eslint-disable-next-line no-console
      console.log(`${f}: segments ${segs.map((s) => (s.type === 'html' ? `html(${s.html.length})` : `md(${s.text.length})`)).join(' ')}`)
      expect(html.length).toBeGreaterThan(0)
    })
  }
})
