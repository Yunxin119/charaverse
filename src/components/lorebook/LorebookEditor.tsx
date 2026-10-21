'use client'

import { memo, useCallback, useEffect, useRef, useState } from 'react'
import { ChevronDown, Download, Plus, Trash2, Upload } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Chip, GlassPanel, IconButton } from '@/components/glass'
import { cn } from '@/lib/utils'
import type { Lorebook, LorebookEntry } from '@/lib/lorebook/schema'
import { TagInput } from './TagInput'
import { LorebookImportDialog, type LorebookImportMode } from './LorebookImportDialog'
import { downloadLorebookJson, mergeEntries, newEntry } from './utils'

const CONTENT_MAX = 20000
const ENTRY_MAX = 500

interface Props {
  value: Lorebook
  onChange: (next: Lorebook) => void
  /** file name for 导出 (falls back to the book's own name) */
  exportName?: string
  /** after a 替换 import that carries a name: lets the host adopt it (e.g. the library page's name field) */
  onImportedName?: (name: string) => void
  className?: string
}

/**
 * Editor for one world book. Controlled: every change goes out through `onChange`
 * as a new `Lorebook` object. Reused by the character form and the settings library.
 */
export function LorebookEditor({ value, onChange, exportName, onImportedName, className }: Props) {
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set())
  const [confirming, setConfirming] = useState<string | null>(null)
  const [importOpen, setImportOpen] = useState(false)
  const listEnd = useRef<HTMLDivElement>(null)

  // Stable callbacks so the memoized entry cards only re-render when their own entry changes.
  const valueRef = useRef(value)
  const onChangeRef = useRef(onChange)
  useEffect(() => { valueRef.current = value; onChangeRef.current = onChange })

  const setBook = useCallback((patch: Partial<Lorebook>) => onChangeRef.current({ ...valueRef.current, ...patch }), [])
  const patchEntry = useCallback((id: string, patch: Partial<LorebookEntry>) => {
    const v = valueRef.current
    onChangeRef.current({ ...v, entries: v.entries.map((e) => (e.id === id ? { ...e, ...patch } : e)) })
  }, [])
  const removeEntry = useCallback((id: string) => {
    const v = valueRef.current
    onChangeRef.current({ ...v, entries: v.entries.filter((e) => e.id !== id) })
    setConfirming((c) => (c === id ? null : c))
  }, [])
  const toggleExpanded = useCallback((id: string) => {
    setExpanded((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n })
  }, [])
  const askRemove = useCallback((id: string | null) => setConfirming(id), [])

  const addEntry = () => {
    if (value.entries.length >= ENTRY_MAX) return
    const e = newEntry()
    onChange({ ...value, entries: [...value.entries, e] })
    setExpanded((s) => new Set(s).add(e.id))
    requestAnimationFrame(() => listEnd.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' }))
  }

  const onImport = (book: Lorebook, mode: LorebookImportMode) => {
    if (mode === 'append') {
      onChange({ ...value, entries: mergeEntries(value.entries, book.entries).slice(0, ENTRY_MAX) })
    } else {
      onChange({ ...book, name: value.name || book.name, description: value.description || book.description })
      if (book.name) onImportedName?.(book.name)
    }
    setExpanded(new Set())
    setConfirming(null)
  }

  const total = value.entries.length
  const enabledCount = value.entries.filter((e) => e.enabled).length

  return (
    <div className={cn('space-y-4', className)}>
      {/* book settings */}
      <GlassPanel padding="sm" className="sm:p-4">
        <div className="grid gap-3 sm:grid-cols-3">
          <NumField id="lb-scan" label="扫描深度" hint="检查最近几条消息里的关键词" value={value.scanDepth} min={1} max={100} onChange={(n) => setBook({ scanDepth: n })} />
          <NumField id="lb-budget" label="字符预算" hint="注入内容的总字符上限" value={value.tokenBudget} min={100} max={60000} step={100} onChange={(n) => setBook({ tokenBudget: n })} />
          <div className="space-y-1.5">
            <Label htmlFor="lb-recursive">递归扫描</Label>
            <div className="flex h-11 items-center gap-3">
              <Switch id="lb-recursive" checked={value.recursive} onCheckedChange={(v) => setBook({ recursive: v })} />
              <span className="text-xs text-cv-fg-subtle">触发条目的内容再扫描一轮</span>
            </div>
          </div>
        </div>
      </GlassPanel>

      {/* toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="mr-auto text-sm text-cv-fg-muted">
          {total ? <>{total} 条目 · {enabledCount} 启用</> : '还没有条目'}
        </span>
        <Button type="button" size="sm" variant="neu" onClick={() => setImportOpen(true)}><Upload /> 导入 JSON</Button>
        <Button type="button" size="sm" variant="neu" disabled={!total} onClick={() => downloadLorebookJson(exportName || value.name, value)}><Download /> 导出</Button>
        <Button type="button" size="sm" disabled={total >= ENTRY_MAX} onClick={addEntry}><Plus /> 添加条目</Button>
      </div>

      {/* entries */}
      {total === 0 ? (
        <div className="neu-in rounded-cv-lg px-4 py-8 text-center text-sm text-cv-fg-muted">
          添加一个条目，或导入已有的世界书 JSON。
        </div>
      ) : (
        <ul className="space-y-3">
          {value.entries.map((e, i) => (
            <li key={e.id}>
              <EntryCard
                entry={e}
                index={i}
                expanded={expanded.has(e.id)}
                confirming={confirming === e.id}
                onPatch={patchEntry}
                onRemove={removeEntry}
                onAskRemove={askRemove}
                onToggleExpanded={toggleExpanded}
              />
            </li>
          ))}
        </ul>
      )}
      <div ref={listEnd} />
      {total > 3 && (
        <div className="flex justify-center">
          <Button type="button" size="sm" variant="neu" disabled={total >= ENTRY_MAX} onClick={addEntry}><Plus /> 添加条目</Button>
        </div>
      )}

      <LorebookImportDialog open={importOpen} onOpenChange={setImportOpen} hasExisting={total > 0} onImport={onImport} />
    </div>
  )
}

/* ------------------------------------------------------------------------ */

interface EntryCardProps {
  entry: LorebookEntry
  index: number
  expanded: boolean
  confirming: boolean
  onPatch: (id: string, patch: Partial<LorebookEntry>) => void
  onRemove: (id: string) => void
  onAskRemove: (id: string | null) => void
  onToggleExpanded: (id: string) => void
}

const EntryCard = memo(function EntryCard({ entry, index, expanded, confirming, onPatch, onRemove, onAskRemove, onToggleExpanded }: EntryCardProps) {
  const id = entry.id
  const uid = `lb-e-${id}`
  const noTrigger = !entry.constant && entry.keys.length === 0

  return (
    <GlassPanel padding="none" className={cn('space-y-3 p-3 sm:p-4', !entry.enabled && 'opacity-70')}>
      {/* header */}
      <div className="flex items-center gap-2">
        <Switch aria-label="启用条目" checked={entry.enabled} onCheckedChange={(v) => onPatch(id, { enabled: v })} />
        <Input
          aria-label="条目名称"
          value={entry.name}
          maxLength={120}
          placeholder={`条目 ${index + 1}`}
          onChange={(e) => onPatch(id, { name: e.target.value })}
          className="h-9 min-w-0 flex-1 font-semibold"
        />
        <IconButton label={expanded ? '收起更多设置' : '更多设置'} size="sm" aria-expanded={expanded} onClick={() => onToggleExpanded(id)}>
          <ChevronDown className={cn('transition-transform duration-(--cv-dur-fast)', expanded && 'rotate-180')} />
        </IconButton>
        <IconButton label="删除条目" size="sm" className="text-cv-danger" onClick={() => onAskRemove(confirming ? null : id)}><Trash2 /></IconButton>
      </div>

      {confirming && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-cv-md bg-[color-mix(in_oklab,var(--cv-danger)_10%,transparent)] px-3 py-2 text-sm text-cv-danger">
          <span>删除这个条目？</span>
          <span className="flex gap-2">
            <Button type="button" size="sm" variant="ghost" onClick={() => onAskRemove(null)}>取消</Button>
            <Button type="button" size="sm" variant="destructive" onClick={() => onRemove(id)}>删除</Button>
          </span>
        </div>
      )}

      {/* keys */}
      <div className="space-y-1.5">
        <Label htmlFor={`${uid}-keys`} className="text-xs text-cv-fg-muted">关键词</Label>
        <TagInput id={`${uid}-keys`} value={entry.keys} onChange={(keys) => onPatch(id, { keys })} placeholder={entry.constant ? '常驻条目不需要关键词' : '输入关键词，回车添加；支持 /正则/'} />
        {noTrigger && <p className="text-xs text-cv-warning">没有关键词也不是常驻：这条永远不会触发。</p>}
      </div>
      {entry.selective && (
        <div className="space-y-1.5">
          <Label htmlFor={`${uid}-keys2`} className="text-xs text-cv-fg-muted">次要关键词（需同时出现其一）</Label>
          <TagInput id={`${uid}-keys2`} value={entry.secondaryKeys} onChange={(secondaryKeys) => onPatch(id, { secondaryKeys })} placeholder="次要关键词，回车添加" />
        </div>
      )}

      {/* content */}
      <div className="space-y-1">
        <Textarea
          aria-label="条目内容"
          value={entry.content}
          maxLength={CONTENT_MAX}
          onChange={(e) => onPatch(id, { content: e.target.value })}
          placeholder="触发时注入到提示词的内容…"
          className="max-h-80 min-h-24 text-sm"
        />
        <div className="text-right font-mono text-[11px] text-cv-fg-subtle">{entry.content.length} / {CONTENT_MAX}</div>
      </div>

      {/* summary when collapsed */}
      {!expanded && (
        <button type="button" onClick={() => onToggleExpanded(id)} className="flex flex-wrap items-center gap-1.5 text-left">
          <Chip tone="outline">{entry.position === 'before' ? '角色卡前' : '角色卡后'}</Chip>
          <Chip tone="outline">顺序 {entry.order}</Chip>
          {entry.constant && <Chip tone="accent">常驻</Chip>}
          {entry.selective && <Chip tone="info">选择性</Chip>}
          {entry.caseSensitive && <Chip tone="outline">区分大小写</Chip>}
          {entry.probability < 100 && <Chip tone="warning">{entry.probability}%</Chip>}
          {entry.depth > 0 && <Chip tone="outline">深度 {entry.depth}</Chip>}
        </button>
      )}

      {/* advanced */}
      {expanded && (
        <div className="space-y-3 border-t border-cv-border pt-3">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="space-y-1.5">
              <Label htmlFor={`${uid}-pos`} className="text-xs text-cv-fg-muted">位置</Label>
              <Select value={entry.position} onValueChange={(v) => onPatch(id, { position: v === 'before' ? 'before' : 'after' })}>
                <SelectTrigger id={`${uid}-pos`} size="sm" className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="before">角色卡前</SelectItem>
                  <SelectItem value="after">角色卡后</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <NumField id={`${uid}-order`} label="顺序" value={entry.order} min={-10000} max={10000} size="sm" onChange={(n) => onPatch(id, { order: n })} />
            <NumField id={`${uid}-prob`} label="概率 %" value={entry.probability} min={0} max={100} size="sm" onChange={(n) => onPatch(id, { probability: n })} />
            <NumField id={`${uid}-depth`} label="扫描深度" hint="0 = 用书的默认值" value={entry.depth} min={0} max={100} size="sm" onChange={(n) => onPatch(id, { depth: n })} />
          </div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            <SwitchRow id={`${uid}-const`} label="常驻" hint="不看关键词，总是注入" checked={entry.constant} onChange={(v) => onPatch(id, { constant: v })} />
            <SwitchRow id={`${uid}-sel`} label="选择性" hint="还需命中一个次要关键词" checked={entry.selective} onChange={(v) => onPatch(id, { selective: v })} />
            <SwitchRow id={`${uid}-case`} label="区分大小写" checked={entry.caseSensitive} onChange={(v) => onPatch(id, { caseSensitive: v })} />
          </div>
        </div>
      )}
    </GlassPanel>
  )
})

/* ------------------------------------------------------------------------ */

function SwitchRow({ id, label, hint, checked, onChange }: { id: string; label: string; hint?: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label htmlFor={id} className="neu-in flex cursor-pointer items-center gap-3 rounded-cv-md px-3 py-2">
      <Switch id={id} checked={checked} onCheckedChange={onChange} />
      <span className="min-w-0">
        <span className="block text-sm font-medium">{label}</span>
        {hint && <span className="block text-[11px] text-cv-fg-subtle">{hint}</span>}
      </span>
    </label>
  )
}

interface NumFieldProps {
  id: string
  label: string
  hint?: string
  value: number
  min: number
  max: number
  step?: number
  size?: 'sm' | 'md'
  onChange: (n: number) => void
}

/** Integer input that lets the user clear the field while typing; clamps on blur. */
function NumField({ id, label, hint, value, min, max, step = 1, size = 'md', onChange }: NumFieldProps) {
  const [text, setText] = useState(String(value))
  // resync the field when the prop changes from outside (e.g. an import), without clobbering in-progress typing
  const [prev, setPrev] = useState(value)
  if (prev !== value) {
    setPrev(value)
    if (Number(text) !== value) setText(String(value))
  }

  const commit = (raw: string) => {
    const n = Number(raw)
    if (raw.trim() === '' || !Number.isFinite(n)) { setText(String(value)); return }
    const clamped = Math.max(min, Math.min(max, Math.round(n)))
    setText(String(clamped))
    if (clamped !== value) onChange(clamped)
  }

  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} className="text-xs text-cv-fg-muted">{label}</Label>
      <Input
        id={id}
        type="number"
        inputMode="numeric"
        min={min}
        max={max}
        step={step}
        value={text}
        onChange={(e) => {
          setText(e.target.value)
          const n = Number(e.target.value)
          if (e.target.value.trim() !== '' && Number.isFinite(n) && n >= min && n <= max && Number.isInteger(n)) onChange(n)
        }}
        onBlur={(e) => commit(e.target.value)}
        className={cn('font-mono', size === 'sm' && 'h-9 px-3')}
      />
      {hint && <p className="text-[11px] text-cv-fg-subtle">{hint}</p>}
    </div>
  )
}
