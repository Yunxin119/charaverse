'use client'

import { useMemo, useState } from 'react'
import { Plus, Search } from 'lucide-react'
import { Chip, PosterCard, PosterTitle, CardSkeleton } from '@/components/glass'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { MEMORY_TYPES, isMemoryEnabled, type MemoryEntry, type MemoryType, type TaskStatus } from '@/lib/memory/types'
import { MemoryCard } from './MemoryCard'

type SortKey = 'importance' | 'created_at' | 'type'

interface Props {
  memories: MemoryEntry[] | undefined
  loading?: boolean
  busyId?: string | null
  onAdd: () => void
  onEdit: (memory: MemoryEntry) => void
  onDelete: (memory: MemoryEntry) => Promise<void> | void
  onToggle: (memory: MemoryEntry, enabled: boolean) => void
  onTaskStatus: (memory: MemoryEntry, status: TaskStatus) => void
}

const SORTS: { id: SortKey; label: string }[] = [
  { id: 'importance', label: '按重要度' },
  { id: 'created_at', label: '按时间' },
  { id: 'type', label: '按类型' },
]

/** Toolbar (search / type chips / sort) + responsive grid of `MemoryCard`s. */
export function MemoryGrid({ memories, loading, busyId, onAdd, onEdit, onDelete, onToggle, onTaskStatus }: Props) {
  const [q, setQ] = useState('')
  const [types, setTypes] = useState<Set<MemoryType>>(() => new Set())
  const [sort, setSort] = useState<SortKey>('importance')
  const [showDisabled, setShowDisabled] = useState(true)

  const counts = useMemo(() => {
    const c = {} as Record<MemoryType, number>
    for (const m of memories ?? []) c[m.type] = (c[m.type] ?? 0) + 1
    return c
  }, [memories])

  const list = useMemo(() => {
    const needle = q.trim().toLowerCase()
    const out = (memories ?? []).filter((m) => {
      if (types.size && !types.has(m.type)) return false
      if (!showDisabled && !isMemoryEnabled(m)) return false
      if (!needle) return true
      return m.title.toLowerCase().includes(needle) || m.content.toLowerCase().includes(needle)
    })
    out.sort((a, b) => {
      if (sort === 'importance') return b.importance - a.importance || b.created_at.localeCompare(a.created_at)
      if (sort === 'created_at') return b.created_at.localeCompare(a.created_at)
      return a.type.localeCompare(b.type) || b.importance - a.importance
    })
    return out
  }, [memories, q, types, sort, showDisabled])

  const toggleType = (t: MemoryType) =>
    setTypes((s) => { const n = new Set(s); if (n.has(t)) n.delete(t); else n.add(t); return n })

  const total = memories?.length ?? 0
  const avg = total ? Math.round((memories!.reduce((s, m) => s + m.importance, 0) / total) * 10) / 10 : 0

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-cv-fg-subtle" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="搜索标题或内容" className="pl-10" aria-label="搜索记忆" />
        </div>
        <div className="flex items-center gap-2">
          <Select value={sort} onValueChange={(v) => setSort(v as SortKey)}>
            <SelectTrigger aria-label="排序" className="min-w-28"><SelectValue /></SelectTrigger>
            <SelectContent>{SORTS.map((s) => <SelectItem key={s.id} value={s.id}>{s.label}</SelectItem>)}</SelectContent>
          </Select>
          <Button variant="accent" onClick={onAdd}><Plus />添加记忆</Button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        <button type="button" onClick={() => setTypes(new Set())}>
          <Chip tone={types.size ? 'outline' : 'primary'} interactive>全部 {total}</Chip>
        </button>
        {MEMORY_TYPES.map((t) => (
          <button key={t.id} type="button" onClick={() => toggleType(t.id)} aria-pressed={types.has(t.id)}>
            <Chip tone={types.has(t.id) ? t.tone : 'outline'} interactive>{t.emoji} {t.label}{counts[t.id] ? ` ${counts[t.id]}` : ''}</Chip>
          </button>
        ))}
        <button type="button" className="ml-auto" onClick={() => setShowDisabled((v) => !v)} aria-pressed={!showDisabled}>
          <Chip tone={showDisabled ? 'outline' : 'flat'} interactive>{showDisabled ? '隐藏已停用' : '显示已停用'}</Chip>
        </button>
      </div>

      {total > 0 && (
        <p className="text-xs text-cv-fg-subtle">共 {total} 条 · 平均重要度 {avg} · 当前显示 {list.length} 条</p>
      )}

      {loading ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{Array.from({ length: 6 }).map((_, i) => <CardSkeleton key={i} />)}</div>
      ) : total === 0 ? (
        <PosterCard tone="secondary" className="min-h-52">
          <PosterTitle>还没有记忆</PosterTitle>
          <p className="mt-2 max-w-sm text-sm opacity-90">生成摘要时会自动提取人物、事件、关系等记忆；也可以手动添加。</p>
          <Button variant="default" className="mt-4" onClick={onAdd}><Plus />添加第一条记忆</Button>
        </PosterCard>
      ) : list.length === 0 ? (
        <div className="neu-in rounded-cv-lg p-8 text-center text-sm text-cv-fg-muted">没有匹配的记忆，换个关键词或类型试试。</div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {list.map((m) => (
            <MemoryCard key={m.id} memory={m} busy={busyId === m.id} onEdit={onEdit} onDelete={onDelete} onToggle={onToggle} onTaskStatus={onTaskStatus} />
          ))}
        </div>
      )}
    </div>
  )
}
