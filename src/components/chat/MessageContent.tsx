'use client'

import { memo, useMemo } from 'react'
import { Markdown } from './Markdown'
import { HtmlBlockFrame } from './HtmlBlockFrame'
import { applyRegexScripts, type RegexScript } from '@/lib/skins/regexScripts'
import { splitHtmlBlocks } from '@/lib/skins/htmlBlocks'

export interface RenderSkin {
  regexScripts: RegexScript[]
  renderHtml: boolean
  char?: string
  user?: string
}

/**
 * Message text → display: regex scripts (display-only), then markdown with
 * any HTML blocks rendered in sandboxed iframes.
 */
export const MessageContent = memo(function MessageContent({ text, role, skin, className }: { text: string; role: 'user' | 'assistant' | 'system'; skin?: RenderSkin | null; className?: string }) {
  const segments = useMemo(() => {
    const r = role === 'user' ? 'user' : 'assistant'
    const rewritten = skin?.regexScripts?.length ? applyRegexScripts(text, skin.regexScripts, { role: r, char: skin.char, user: skin.user }) : text
    return splitHtmlBlocks(rewritten, !!skin?.renderHtml && r === 'assistant')
  }, [text, role, skin])

  if (segments.length === 1 && segments[0].type === 'md') return <Markdown text={segments[0].text} className={className} />
  return (
    <div className={className}>
      {segments.map((s, i) => (s.type === 'md' ? <Markdown key={i} text={s.text} /> : <HtmlBlockFrame key={i} html={s.html} />))}
    </div>
  )
})
