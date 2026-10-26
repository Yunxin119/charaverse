'use client'

import { ChevronDown, ChevronUp, Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { GlassPanel, IconButton, NeuSurface } from '@/components/glass'
import { WriterField } from './WriterField'
import { newExtra, type DraftExtra } from './types'

interface Props {
  value: DraftExtra[]
  onChange: (next: DraftExtra[]) => void
}

/** 补充设定：named blocks for anything the fixed fields don't cover (world, glossary, relationships…). */
export function ExtrasSection({ value, onChange }: Props) {
  const patch = (id: string, p: Partial<DraftExtra>) => onChange(value.map((e) => (e.id === id ? { ...e, ...p } : e)))
  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir
    if (j < 0 || j >= value.length) return
    const next = [...value]
    ;[next[i], next[j]] = [next[j], next[i]]
    onChange(next)
  }
  return (
    <div className="space-y-4">
      {value.length === 0 && (
        <GlassPanel className="flex flex-col items-start gap-3 text-sm text-cv-fg-muted sm:flex-row sm:items-center sm:justify-between">
          <span>世界观、术语表、关系网、剧情线……凡是固定字段放不下的，都可以起个名字放在这里，按顺序注入提示词。</span>
          <Button type="button" size="sm" variant="neu" onClick={() => onChange([newExtra()])}><Plus /> 添加一块</Button>
        </GlassPanel>
      )}
      {value.map((e, i) => (
        <NeuSurface key={e.id} padding="none" className="overflow-hidden">
          <div className="flex items-center gap-2 border-b border-cv-border px-4 py-2.5">
            <Input value={e.name} onChange={(ev) => patch(e.id, { name: ev.target.value })} placeholder={`名称，例如：世界观 / 术语表（第 ${i + 1} 块）`} maxLength={60} className="h-8 flex-1 border-0 bg-transparent px-1 font-semibold shadow-none focus-visible:ring-0" />
            <IconButton label="上移" size="sm" disabled={i === 0} onClick={() => move(i, -1)}><ChevronUp /></IconButton>
            <IconButton label="下移" size="sm" disabled={i === value.length - 1} onClick={() => move(i, 1)}><ChevronDown /></IconButton>
            <IconButton label="删除这块" size="sm" className="text-cv-danger" onClick={() => { if (!e.content.trim() || confirm(`删除「${e.name.trim() || `第 ${i + 1} 块`}」？`)) onChange(value.filter((x) => x.id !== e.id)) }}><Trash2 /></IconButton>
          </div>
          <div className="p-4">
            <WriterField id={`cf-extra-${e.id}`} label="内容" value={e.content} onChange={(v) => patch(e.id, { content: v })} placeholder="写下这一块的内容" minRows={4} macros />
          </div>
        </NeuSurface>
      ))}
      {value.length > 0 && (
        <Button type="button" size="sm" variant="neu" disabled={value.length >= 30} onClick={() => onChange([...value, newExtra()])}><Plus /> 再加一块</Button>
      )}
    </div>
  )
}
