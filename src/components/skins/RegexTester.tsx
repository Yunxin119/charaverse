'use client'

import { useMemo, useState } from 'react'
import { ChevronDown } from 'lucide-react'
import type { ApplyContext, RegexScript } from '@/lib/skins/regexScripts'
import { testRegexScript } from '@/lib/skins/regexTest'
import { Chip } from '@/components/glass'
import { cn } from '@/lib/utils'

interface Props {
  scripts: RegexScript[]
  index: number
  sample: string
  ctx: ApplyContext
}

/**
 * Test bench under each regex script: match count against the sample (after the scripts
 * before it), the sample with matches highlighted, and the text this script produces.
 */
export function RegexTester({ scripts, index, sample, ctx }: Props) {
  const [open, setOpen] = useState(false)
  const r = useMemo(() => testRegexScript(scripts, index, sample, ctx), [scripts, index, sample, ctx])

  const status = !r.ok
    ? { tone: 'danger' as const, text: `正则有误：${r.error}` }
    : r.skipped === 'disabled' ? { tone: 'flat' as const, text: '已停用' }
    : r.skipped === 'role' ? { tone: 'flat' as const, text: '不作用于这种消息' }
    : r.matches.length === 0 ? { tone: 'warning' as const, text: '测试文本里没有命中' }
    : { tone: 'success' as const, text: `命中 ${r.matches.length} 处` }

  const highlighted = useMemo(() => {
    const parts: { text: string; hit: boolean }[] = []
    let cursor = 0
    for (const m of r.matches) {
      if (m.start > cursor) parts.push({ text: r.input.slice(cursor, m.start), hit: false })
      parts.push({ text: r.input.slice(m.start, m.end), hit: true })
      cursor = m.end
    }
    if (cursor < r.input.length) parts.push({ text: r.input.slice(cursor), hit: false })
    return parts
  }, [r])

  return (
    <div className="mt-2 rounded-cv-md border border-cv-border/70">
      <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open} className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs">
        <Chip tone={status.tone} className="px-2 py-0.5 text-[11px]">{status.text}</Chip>
        <span className="min-w-0 flex-1 truncate text-cv-fg-subtle">用右侧「测试用的 AI 回复」测，前面的脚本先生效</span>
        <ChevronDown className={cn('size-3.5 shrink-0 text-cv-fg-subtle transition-transform', open && 'rotate-180')} />
      </button>
      {open && (
        <div className="grid gap-2 border-t border-cv-border/70 p-3 sm:grid-cols-2">
          <div>
            <div className="mb-1 text-[11px] font-semibold text-cv-fg-subtle">命中位置</div>
            <pre className="max-h-48 overflow-auto whitespace-pre-wrap rounded-cv-sm bg-cv-bg-elevated/60 p-2 font-mono text-[11px] leading-5 [overflow-wrap:anywhere]">
              {highlighted.length === 0 ? <span className="text-cv-fg-subtle">（空）</span> : highlighted.map((p, i) => p.hit ? <mark key={i} className="rounded-sm bg-cv-accent/35 text-cv-fg">{p.text}</mark> : <span key={i}>{p.text}</span>)}
            </pre>
          </div>
          <div>
            <div className="mb-1 text-[11px] font-semibold text-cv-fg-subtle">这一步之后的文本{scripts[index]?.renderAsHtml ? '（HTML 会在沙箱里渲染，见右侧预览）' : ''}</div>
            <pre className="max-h-48 overflow-auto whitespace-pre-wrap rounded-cv-sm bg-cv-bg-elevated/60 p-2 font-mono text-[11px] leading-5 [overflow-wrap:anywhere]">{r.output || <span className="text-cv-fg-subtle">（空）</span>}</pre>
          </div>
        </div>
      )}
    </div>
  )
}
