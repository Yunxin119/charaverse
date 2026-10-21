'use client'

import { useState, type DragEvent } from 'react'
import { ChevronDown, ChevronUp, GripVertical, Trash2 } from 'lucide-react'
import { Switch } from '@/components/ui/switch'
import { Chip, IconButton } from '@/components/glass'
import { MARKER_LABELS, isMarkerId, type PresetPrompt } from '@/lib/prompt/presets'
import { cn } from '@/lib/utils'

interface Props {
  prompts: PresetPrompt[]
  selectedIndex: number | null
  readOnly?: boolean
  onSelect: (index: number) => void
  onToggle: (index: number, enabled: boolean) => void
  onMove: (from: number, to: number) => void
  onDelete: (index: number) => void
}

const ROLE_TONE: Record<PresetPrompt['role'], 'primary' | 'info' | 'flat'> = {
  system: 'flat',
  user: 'primary',
  assistant: 'info',
}

export function PromptList({ prompts, selectedIndex, readOnly, onSelect, onToggle, onMove, onDelete }: Props) {
  const [dragFrom, setDragFrom] = useState<number | null>(null)
  const [dragOver, setDragOver] = useState<number | null>(null)

  const handleDragStart = (i: number) => (e: DragEvent<HTMLLIElement>) => {
    if (readOnly) return
    setDragFrom(i)
    e.dataTransfer.effectAllowed = 'move'
    // Firefox needs data to start a drag.
    e.dataTransfer.setData('text/plain', String(i))
  }
  const handleDragOver = (i: number) => (e: DragEvent<HTMLLIElement>) => {
    if (dragFrom === null) return
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    if (dragOver !== i) setDragOver(i)
  }
  const handleDrop = (i: number) => (e: DragEvent<HTMLLIElement>) => {
    e.preventDefault()
    if (dragFrom !== null && dragFrom !== i) onMove(dragFrom, i)
    setDragFrom(null)
    setDragOver(null)
  }
  const handleDragEnd = () => {
    setDragFrom(null)
    setDragOver(null)
  }

  if (prompts.length === 0) {
    return (
      <div className="neu-in rounded-cv-md px-4 py-8 text-center text-sm text-cv-fg-muted">
        还没有任何条目，点「添加条目」或「添加占位」开始。
      </div>
    )
  }

  return (
    <ol className="space-y-2">
      {prompts.map((p, i) => {
        const marker = !!p.marker
        const markerLabel = marker && isMarkerId(p.id) ? MARKER_LABELS[p.id] : null
        const selected = selectedIndex === i
        const absolute = p.injection?.position === 'absolute'
        return (
          <li
            key={p.id}
            draggable={!readOnly}
            onDragStart={handleDragStart(i)}
            onDragOver={handleDragOver(i)}
            onDrop={handleDrop(i)}
            onDragEnd={handleDragEnd}
            onClick={() => onSelect(i)}
            onKeyDown={(e) => {
              if (e.target !== e.currentTarget) return
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                onSelect(i)
              }
            }}
            tabIndex={0}
            role="button"
            aria-pressed={selected}
            className={cn(
              'group flex items-center gap-2 rounded-cv-md px-2 py-2 sm:px-3 cursor-pointer outline-none transition-[box-shadow,background-color,transform] duration-(--cv-dur-fast) ease-cv focus-visible:ring-2 focus-visible:ring-cv-ring',
              selected ? 'neu-in bg-[color-mix(in_oklab,var(--cv-accent)_10%,transparent)]' : 'neu hover:shadow-neu-sm',
              !p.enabled && 'opacity-60',
              dragFrom === i && 'opacity-40',
              dragOver === i && dragFrom !== null && dragFrom !== i && 'ring-2 ring-cv-accent'
            )}
          >
            <span
              aria-hidden
              className={cn('hidden sm:flex shrink-0 text-cv-fg-subtle', readOnly ? 'opacity-30' : 'cursor-grab active:cursor-grabbing')}
            >
              <GripVertical className="size-4" />
            </span>

            <span onClick={(e) => e.stopPropagation()} className="shrink-0 flex">
              <Switch
                checked={p.enabled}
                disabled={readOnly}
                onCheckedChange={(v) => onToggle(i, v)}
                aria-label={`${p.enabled ? '停用' : '启用'} ${p.name || p.id}`}
                className="scale-90"
              />
            </span>

            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5 min-w-0">
                <span className={cn('truncate text-sm font-medium', marker && 'italic')}>{p.name || p.id}</span>
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-1">
                {marker ? (
                  <>
                    <Chip tone="warning" className="px-2 py-0.5 text-[10px]">占位</Chip>
                    <span className="text-[11px] text-cv-fg-muted truncate">将填入：{markerLabel ?? p.id}</span>
                  </>
                ) : (
                  <>
                    <Chip tone={ROLE_TONE[p.role]} className="px-2 py-0.5 text-[10px] font-mono">{p.role}</Chip>
                    {absolute && (
                      <Chip tone="info" className="px-2 py-0.5 text-[10px]">深度 {p.injection?.depth ?? 0}</Chip>
                    )}
                    {!p.content.trim() && <span className="text-[11px] text-cv-fg-subtle">空内容</span>}
                  </>
                )}
              </div>
            </div>

            {!readOnly && (
              <div
                className="flex shrink-0 items-center gap-0.5 opacity-70 sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100 transition-opacity"
                onClick={(e) => e.stopPropagation()}
              >
                <IconButton label="上移" size="sm" disabled={i === 0} onClick={() => onMove(i, i - 1)} className="size-7">
                  <ChevronUp className="size-4" />
                </IconButton>
                <IconButton label="下移" size="sm" disabled={i === prompts.length - 1} onClick={() => onMove(i, i + 1)} className="size-7">
                  <ChevronDown className="size-4" />
                </IconButton>
                <IconButton label="删除条目" size="sm" onClick={() => onDelete(i)} className="size-7 text-cv-danger hover:bg-cv-danger/10">
                  <Trash2 className="size-4" />
                </IconButton>
              </div>
            )}
          </li>
        )
      })}
    </ol>
  )
}
