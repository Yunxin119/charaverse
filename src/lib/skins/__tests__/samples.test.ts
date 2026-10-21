import { describe, expect, it } from 'vitest'
import { sanitizeCss } from '../sanitizeCss'
import { splitHtmlBlocks } from '../htmlBlocks'

/**
 * An original end-to-end sample in the shape authors actually ship: a big
 * `<style>` block (imports, fixed overlays, remote assets, keyframes, media
 * queries) followed by an HTML status bar and a collapsible panel. The whole
 * thing must survive the sanitizer + html splitter pipeline.
 */
const SAMPLE = `
<style>
@import url('https://fonts.example.com/css2?family=Inter&display=swap');
@font-face { font-family: 'CvMono'; src: url('https://cdn.example.com/fonts/cvmono.woff2') format('woff2'); }
:root { --cv-sample-accent: #c9643b; --cv-sample-ink: #33251b; }
body { background: #0c0c0e; }
#cv_chat_root { background: radial-gradient(600px 300px at 50% -5%, rgba(201,100,59,.18), transparent 60%), #0c0c0e !important; color: #f2dece; }
#cv_chat_header > div { background: rgba(20,20,22,.85) !important; border-bottom: 1px solid rgba(242,222,206,.12); }
.cv_ai_message_bubble { background: rgba(12,12,14,.8) !important; border: 1px solid rgba(242,222,206,.14); border-radius: 14px; }
.cv_user_message_bubble { background: rgba(201,100,59,.16) !important; border: 1px solid rgba(201,100,59,.4); border-radius: 14px; }
.cv_message_avatar { border-radius: 8px; box-shadow: 0 0 0 1px rgba(201,100,59,.3); }
.cv_message_avatar img { object-fit: cover; }
#cv_chat_input_box { background: rgba(20,20,22,.9) !important; border: 1px solid rgba(242,222,206,.14); }
#cv_send_button { background: var(--cv-sample-accent) !important; color: #1a1208; }
.cv-sample-status { display: flex; gap: 12px; padding: 10px 14px; border-radius: 12px; background: rgba(20,20,22,.92); border: 1px solid rgba(201,100,59,.35); font-family: 'CvMono', monospace; }
.cv-sample-status .label { opacity: .6; font-size: 11px; letter-spacing: .08em; text-transform: uppercase; }
.cv-sample-status .value { color: var(--cv-sample-accent); font-weight: 600; }
.cv-sample-status .bar { position: relative; height: 6px; flex: 1; background: rgba(242,222,206,.1); border-radius: 3px; overflow: hidden; }
.cv-sample-status .bar > i { position: absolute; inset: 0; width: 64%; background: linear-gradient(90deg, #c9643b, #f2dece); animation: cv-sample-pulse 2.4s ease-in-out infinite; }
.cv-sample-toast { position: fixed; top: 12px; right: 12px; z-index: 9999; padding: 8px 12px; background: #41140e; color: #f2dece; border-radius: 10px; }
.cv-sample-backdrop { position: fixed; inset: 0; background: url('https://cdn.example.com/img/noise.png') repeat; opacity: .08; pointer-events: none; }
.cv-sample-panel { margin-top: 10px; border: 1px solid rgba(242,222,206,.14); border-radius: 12px; }
.cv-sample-panel summary { cursor: pointer; padding: 8px 12px; list-style: none; color: var(--cv-sample-accent); }
.cv-sample-panel summary::-webkit-details-marker { display: none; }
.cv-sample-panel .body { padding: 8px 12px 12px; font-size: 13px; line-height: 1.6; }
.cv-sample-panel .body p + p { margin-top: 6px; }
.cv-sample-panel .tag { display: inline-block; padding: 1px 6px; border-radius: 999px; background: rgba(201,100,59,.2); font-size: 11px; }
@keyframes cv-sample-pulse { 0%, 100% { opacity: 1; } 50% { opacity: .55; } }
@media (max-width: 640px) {
  .cv-sample-status { flex-direction: column; gap: 6px; }
  .cv-sample-panel .body { font-size: 12px; }
}
@media (prefers-reduced-motion: reduce) {
  .cv-sample-status .bar > i { animation: none; }
}
</style>

<div class="cv-sample-status">
  <span class="label">心情</span><span class="value">平静</span>
  <span class="label">好感</span><span class="bar"><i></i></span>
  <span class="label">时间</span><span class="value">21:40</span>
</div>

她把杯子推到你面前，热气在两人之间慢慢散开。"今天也辛苦了。"

<details class="cv-sample-panel" open>
  <summary>内心独白</summary>
  <div class="body">
    <p><span class="tag">想法</span> 其实没什么好说的，只是想多坐一会儿。</p>
    <p><span class="tag">计划</span> 明天早一点起来，把阳台的花浇了。</p>
  </div>
</details>
`

describe('skin sample end-to-end', () => {
  const styles = [...SAMPLE.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/gi)].map((m) => m[1])
  const css = styles.join('\n')

  it('css sanitizes: most rules survive, every selector is scoped, @import is dropped', () => {
    expect(styles.length).toBe(1)
    const r = sanitizeCss(css)
    expect(r.css.length).toBeGreaterThan(css.length * 0.5)
    expect(r.css).not.toMatch(/@import/)
    expect(r.css).toContain('#cv_chat_root')
    // Only scoped selectors remain: nothing starts a rule from `body`.
    expect(r.css).not.toMatch(/(^|\n)\s*body\s*\{/)
  })

  it('html splits into html + markdown segments', () => {
    const segs = splitHtmlBlocks(SAMPLE, true)
    const html = segs.filter((s) => s.type === 'html')
    const md = segs.filter((s) => s.type !== 'html')
    expect(html.length).toBeGreaterThan(0)
    expect(md.some((s) => s.type === 'md' && s.text.includes('今天也辛苦了'))).toBe(true)
  })
})
