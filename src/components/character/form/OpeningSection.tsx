'use client'

import { useRef } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { Chip, GlassPanel, IconButton } from '@/components/glass'
import { Field, SectionHeader } from './Field'

interface Props {
  value: string
  onChange: (v: string) => void
  alternates: string[]
  onAlternatesChange: (v: string[]) => void
}

const MACROS: { token: string; label: string }[] = [
  { token: '{{char}}', label: '角色名' },
  { token: '{{user}}', label: '用户名' },
]

export function OpeningSection({ value, onChange, alternates, onAlternatesChange }: Props) {
  const ref = useRef<HTMLTextAreaElement>(null)

  const insert = (token: string) => {
    const el = ref.current
    if (!el) { onChange(value + token); return }
    const start = el.selectionStart ?? value.length
    const end = el.selectionEnd ?? value.length
    onChange(value.slice(0, start) + token + value.slice(end))
    requestAnimationFrame(() => { el.focus(); el.setSelectionRange(start + token.length, start + token.length) })
  }

  const setAlt = (i: number, v: string) => onAlternatesChange(alternates.map((a, j) => (j === i ? v : a)))

  return (
    <section aria-labelledby="sec-opening">
      <SectionHeader title="开场白" description="每个新对话的第一条消息，由角色说出。可以写多个备选，开新对话时第一条消息能左右切换。留空则由 AI 自己开口。" />
      <GlassPanel className="space-y-4">
        <Field id="cf-initial" label="开场白 1" hint={<>支持宏：<code className="font-mono text-cv-accent">{'{{char}}'}</code> 会替换成角色名，<code className="font-mono text-cv-accent">{'{{user}}'}</code> 会替换成对话里用户的名字。</>}>
          <Textarea ref={ref} id="cf-initial" value={value} onChange={(e) => onChange(e.target.value)} placeholder="例如：雨还没停。{{user}}，你要是不急着走，我这儿还有半壶热茶。" className="min-h-40" />
        </Field>
        <div className="flex flex-wrap items-center gap-2 text-xs text-cv-fg-muted">
          <span>插入：</span>
          {MACROS.map((m) => (
            <Chip key={m.token} tone="outline" interactive onClick={() => insert(m.token)}>
              <code className="font-mono">{m.token}</code> {m.label}
            </Chip>
          ))}
        </div>

        {alternates.map((alt, i) => (
          <Field key={i} id={`cf-alt-${i}`} label={`开场白 ${i + 2}`}>
            <div className="flex items-start gap-2">
              <Textarea id={`cf-alt-${i}`} value={alt} onChange={(e) => setAlt(i, e.target.value)} className="min-h-28 flex-1" placeholder="另一个版本的开场…" />
              <IconButton label="删除这条开场白" variant="ghost" size="sm" onClick={() => onAlternatesChange(alternates.filter((_, j) => j !== i))}><Trash2 /></IconButton>
            </div>
          </Field>
        ))}
        <Button type="button" size="sm" variant="neu" disabled={alternates.length >= 20} onClick={() => onAlternatesChange([...alternates, ''])}><Plus /> 添加备选开场白</Button>
      </GlassPanel>
    </section>
  )
}
