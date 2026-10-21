'use client'

import { useRef } from 'react'
import { Textarea } from '@/components/ui/textarea'
import { Chip, GlassPanel } from '@/components/glass'
import { Field, SectionHeader } from './Field'

interface Props {
  value: string
  onChange: (v: string) => void
}

const MACROS: { token: string; label: string }[] = [
  { token: '{{char}}', label: '角色名' },
  { token: '{{user}}', label: '用户名' },
]

export function OpeningSection({ value, onChange }: Props) {
  const ref = useRef<HTMLTextAreaElement>(null)

  const insert = (token: string) => {
    const el = ref.current
    if (!el) { onChange(value + token); return }
    const start = el.selectionStart ?? value.length
    const end = el.selectionEnd ?? value.length
    const next = value.slice(0, start) + token + value.slice(end)
    onChange(next)
    requestAnimationFrame(() => { el.focus(); el.setSelectionRange(start + token.length, start + token.length) })
  }

  return (
    <section aria-labelledby="sec-opening">
      <SectionHeader title="开场白" description="每个新会话的第一条消息，由角色说出。留空则由 AI 自己开口。" />
      <GlassPanel className="space-y-4">
        <Field id="cf-initial" label="第一条消息" hint={<>支持宏：<code className="font-mono text-cv-accent">{'{{char}}'}</code> 会替换成角色名，<code className="font-mono text-cv-accent">{'{{user}}'}</code> 会替换成对话里用户的名字。</>}>
          <Textarea ref={ref} id="cf-initial" value={value} onChange={(e) => onChange(e.target.value)} placeholder="例如：雨还没停。{{user}}，你要是不急着走，我这儿还有半壶热茶。" className="min-h-40" />
        </Field>
        <div className="flex flex-wrap items-center gap-2 text-xs text-cv-fg-muted">
          <span>插入：</span>
          {MACROS.map((m) => (
            <Chip key={m.token} tone="outline" interactive role="button" tabIndex={0} onClick={() => insert(m.token)} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); insert(m.token) } }}>
              <code className="font-mono">{m.token}</code>
              <span className="opacity-70">{m.label}</span>
            </Chip>
          ))}
        </div>
      </GlassPanel>
    </section>
  )
}
