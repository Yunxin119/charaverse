'use client'

import { ChevronDown, ChevronUp, Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { IconButton, NeuSurface } from '@/components/glass'
import { WriterField } from './WriterField'
import { newExtra, type DraftExtra } from './types'

interface Props {
  value: DraftExtra[]
  onChange: (next: DraftExtra[]) => void
}

export const EXTRAS_MAX = 30

/**
 * 补充设定: named blocks for anything the fixed fields don't cover (world, glossary,
 * relationships…), injected in order after the fixed fields. Lives at the end of 「设定」.
 */
export function ExtrasSection({ value, onChange }: Props) {
  const patch = (id: string, p: Partial<DraftExtra>) => onChange(value.map((e) => (e.id === id ? { ...e, ...p } : e)))
  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir
    if (j < 0 || j >= value.length) return
    const next = [...value]
    ;[next[i], next[j]] = [next[j], next[i]]
    onChange(next)
  }
  const add = () => onChange([...value, newExtra()])

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <h3 className="text-xs font-semibold tracking-wide text-cv-fg-muted">补充设定</h3>
          <p className="mt-0.5 text-xs text-cv-fg-subtle">世界观、术语表、关系网、剧情线……固定字段放不下的，起个名字放这里，按顺序注入。</p>
        </div>
        <Button type="button" size="sm" variant="neu" disabled={value.length >= EXTRAS_MAX} onClick={add}><Plus /> 加一块</Button>
      </div>
      {value.map((e, i) => (
        <NeuSurface key={e.id} padding="none" className="overflow-hidden">
          <div className="flex items-center gap-1 border-b border-cv-border py-1.5 pl-3 pr-2">
            <Input value={e.name} onChange={(ev) => patch(e.id, { name: ev.target.value })} placeholder={`这一块叫什么，例如：世界观 / 术语表`} maxLength={60} aria-label={`第 ${i + 1} 块的名称`} className="h-8 flex-1 border-0 bg-transparent px-1 font-semibold shadow-none focus-visible:ring-0" />
            <IconButton label="上移" size="sm" disabled={i === 0} onClick={() => move(i, -1)}><ChevronUp /></IconButton>
            <IconButton label="下移" size="sm" disabled={i === value.length - 1} onClick={() => move(i, 1)}><ChevronDown /></IconButton>
            <IconButton label="删除这块" size="sm" className="text-cv-fg-subtle hover:text-cv-danger" onClick={() => { if (!e.content.trim() || confirm(`删除「${e.name.trim() || `第 ${i + 1} 块`}」？`)) onChange(value.filter((x) => x.id !== e.id)) }}><Trash2 /></IconButton>
          </div>
          <div className="p-3 pt-2">
            <WriterField id={`cf-extra-${e.id}`} label="内容" value={e.content} onChange={(v) => patch(e.id, { content: v })} placeholder="写下这一块的内容" minRows={3} macros />
          </div>
        </NeuSurface>
      ))}
    </div>
  )
}
