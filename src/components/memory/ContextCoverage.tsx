'use client'

import { useMemo, useState } from 'react'
import { Sparkles, Loader2, Wand2 } from 'lucide-react'
import { Chip, NeuSurface, Skeleton } from '@/components/glass'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { cn } from '@/lib/utils'
import type { SummaryRow, MessageRange } from '@/queries/useSummaries'

/* ---------------------------------------------------------------------------
 * Pure coverage maths (exported for the page / tests)
 * ------------------------------------------------------------------------- */

export interface IdRange { start: number; end: number }

/** Active summary ranges merged when overlapping or adjacent, ascending. */
export function mergeRanges(summaries: Pick<SummaryRow, 'start_message_id' | 'end_message_id'>[] | undefined): IdRange[] {
  const raw = (summaries ?? [])
    .filter((s): s is typeof s & { start_message_id: number; end_message_id: number } => !!s.start_message_id && !!s.end_message_id)
    .map((s) => ({ start: s.start_message_id, end: s.end_message_id }))
    .sort((a, b) => a.start - b.start)
  const out: IdRange[] = []
  for (const r of raw) {
    const last = out[out.length - 1]
    if (last && r.start <= last.end + 1) last.end = Math.max(last.end, r.end)
    else out.push({ ...r })
  }
  return out
}

const inRanges = (id: number, ranges: IdRange[]) => ranges.some((r) => id >= r.start && id <= r.end)

export interface Segment { covered: boolean; count: number; firstId: number; lastId: number }

/** Runs of consecutive messages with the same covered state, in session order. */
export function coverageSegments(ids: number[], ranges: IdRange[]): Segment[] {
  const out: Segment[] = []
  for (const id of ids) {
    const covered = inRanges(id, ranges)
    const last = out[out.length - 1]
    if (last && last.covered === covered) { last.count += 1; last.lastId = id }
    else out.push({ covered, count: 1, firstId: id, lastId: id })
  }
  return out
}

export interface RangeCheck { ok: boolean; message: string }

/** Manual range rules: real ids, start < end, ≥2 messages, no overlap, and after everything already covered. */
export function validateRange(start: number, end: number, ids: number[], ranges: IdRange[]): RangeCheck {
  if (!Number.isInteger(start) || !Number.isInteger(end)) return { ok: false, message: '请输入起止消息 ID' }
  const a = ids.indexOf(start)
  const b = ids.indexOf(end)
  if (a < 0 || b < 0) return { ok: false, message: `消息 ID 不在本会话中（范围 #${ids[0]}–#${ids[ids.length - 1]}）` }
  if (start >= end) return { ok: false, message: '起始 ID 必须小于结束 ID' }
  if (b - a + 1 < 2) return { ok: false, message: '至少需要 2 条消息' }
  const overlap = ranges.find((r) => start <= r.end && end >= r.start)
  if (overlap) return { ok: false, message: `与已有摘要 #${overlap.start}–#${overlap.end} 重叠` }
  const lastCovered = ranges.length ? ranges[ranges.length - 1].end : null
  if (lastCovered !== null && start <= lastCovered) return { ok: false, message: `新摘要必须从已覆盖范围之后开始（> #${lastCovered}）` }
  return { ok: true, message: `将摘要 ${b - a + 1} 条消息` }
}

/* ---------------------------------------------------------------------------
 * Component
 * ------------------------------------------------------------------------- */

interface Props {
  range: MessageRange | undefined
  summaries: SummaryRow[] | undefined
  loading?: boolean
  canGenerate: boolean
  generating?: boolean
  useMemoryTable: boolean
  onUseMemoryTableChange: (v: boolean) => void
  onGenerate: (startMessageId: number, endMessageId: number) => Promise<void>
}

function Stat({ label, value, tone }: { label: string; value: string | number; tone?: 'accent' | 'muted' }) {
  return (
    <div className="neu-in rounded-cv-md px-3 py-2">
      <div className="text-[11px] text-cv-fg-subtle">{label}</div>
      <div className={cn('font-display text-xl font-semibold leading-tight', tone === 'accent' ? 'text-cv-accent' : 'text-cv-fg')}>{value}</div>
    </div>
  )
}

export function ContextCoverage({ range, summaries, loading, canGenerate, generating, useMemoryTable, onUseMemoryTableChange, onGenerate }: Props) {
  const ids = useMemo(() => range?.ids ?? [], [range])
  const ranges = useMemo(() => mergeRanges(summaries), [summaries])
  const segments = useMemo(() => coverageSegments(ids, ranges), [ids, ranges])
  const covered = segments.reduce((n, s) => n + (s.covered ? s.count : 0), 0)
  const total = ids.length
  const uncovered = total - covered
  const pct = total ? Math.round((covered / total) * 100) : 0
  const indexOf = (id: number) => { const i = ids.indexOf(id); return i < 0 ? null : i + 1 }

  // suggestion: first uncovered message after the last covered id → last message
  const lastCovered = ranges.length ? ranges[ranges.length - 1].end : null
  const firstUncovered = ids.find((id) => (lastCovered === null || id > lastCovered) && !inRanges(id, ranges)) ?? null
  const suggestion = firstUncovered !== null && range?.maxId && validateRange(firstUncovered, range.maxId, ids, ranges).ok
    ? { start: firstUncovered, end: range.maxId } : null

  const [startText, setStartText] = useState('')
  const [endText, setEndText] = useState('')
  const [error, setError] = useState<string | null>(null)
  const manual = startText && endText ? validateRange(Number(startText), Number(endText), ids, ranges) : null

  const run = async (start: number, end: number) => {
    setError(null)
    try { await onGenerate(start, end); setStartText(''); setEndText('') }
    catch (e) { setError((e as Error).message || '生成失败') }
  }

  if (loading) {
    return <div className="space-y-4"><Skeleton className="h-6 w-full" /><div className="grid grid-cols-2 gap-3 sm:grid-cols-5">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-14" />)}</div><Skeleton className="h-48" /></div>
  }

  return (
    <div className="space-y-5">
      <section className="glass rounded-cv-lg p-4 sm:p-5">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-display text-lg font-semibold">上下文覆盖</h2>
          <span className="text-xs text-cv-fg-muted">{total ? `#${range?.minId}–#${range?.maxId}` : '暂无消息'}</span>
        </div>
        <div className="neu-in flex h-5 w-full overflow-hidden rounded-full p-0.5" role="img" aria-label={`已覆盖 ${covered} / ${total} 条消息`}>
          {segments.length === 0 && <div className="flex-1" />}
          {segments.map((s, i) => (
            <div key={i} style={{ flexGrow: s.count }} title={`${s.covered ? '已覆盖' : '未覆盖'} #${s.firstId}–#${s.lastId}（${s.count} 条）`}
              className={cn('h-full min-w-[3px] first:rounded-l-full last:rounded-r-full', s.covered ? 'bg-cv-accent' : 'bg-[color-mix(in_oklab,var(--cv-secondary)_45%,transparent)]')} />
          ))}
        </div>
        <div className="mt-2 flex items-center gap-4 text-[11px] text-cv-fg-subtle">
          <span className="flex items-center gap-1.5"><span className="size-2 rounded-full bg-cv-accent" />已摘要</span>
          <span className="flex items-center gap-1.5"><span className="size-2 rounded-full bg-[color-mix(in_oklab,var(--cv-secondary)_45%,transparent)]" />原文进入上下文</span>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-5">
          <Stat label="消息总数" value={total} />
          <Stat label="已覆盖" value={covered} tone="accent" />
          <Stat label="未覆盖" value={uncovered} />
          <Stat label="摘要数" value={ranges.length} />
          <Stat label="覆盖率" value={`${pct}%`} />
        </div>
      </section>

      <NeuSurface padding="md" className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-display text-lg font-semibold">生成摘要</h2>
          <label className="flex items-center gap-2 text-xs text-cv-fg-muted">
            记忆表格格式
            <Switch checked={useMemoryTable} onCheckedChange={onUseMemoryTableChange} aria-label="生成时同时提取记忆表格" />
          </label>
        </div>
        <p className="text-xs text-cv-fg-muted">摘要按顺序生成：每份新摘要必须紧跟在已覆盖范围之后，且不能与已有摘要重叠。开启记忆表格格式时会同时提取人物、事件等记忆。</p>

        <div className="glass flex flex-wrap items-center gap-3 rounded-cv-md p-3">
          <Sparkles className="size-4 shrink-0 text-cv-accent" />
          {suggestion ? (
            <>
              <div className="min-w-0 flex-1 text-sm">
                <span className="font-semibold">建议范围</span>{' '}
                <Chip tone="primary" className="font-mono">#{suggestion.start}–#{suggestion.end}</Chip>{' '}
                <span className="text-cv-fg-muted">第 {indexOf(suggestion.start)}–{indexOf(suggestion.end)} 条，共 {(indexOf(suggestion.end) ?? 0) - (indexOf(suggestion.start) ?? 0) + 1} 条消息</span>
              </div>
              <div className="flex gap-2">
                <Button size="sm" variant="ghost" onClick={() => { setStartText(String(suggestion.start)); setEndText(String(suggestion.end)) }}>填入手动范围</Button>
                <Button size="sm" variant="accent" disabled={!canGenerate || generating} onClick={() => void run(suggestion.start, suggestion.end)}>
                  {generating ? <Loader2 className="animate-spin" /> : <Wand2 />}生成建议范围
                </Button>
              </div>
            </>
          ) : (
            <span className="text-sm text-cv-fg-muted">{total < 2 ? '消息不足，至少需要 2 条消息。' : '所有消息都已被摘要覆盖。'}</span>
          )}
        </div>

        <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
          <div className="space-y-1.5">
            <Label htmlFor="cv-range-start">起始消息 ID</Label>
            <Input id="cv-range-start" type="number" inputMode="numeric" value={startText} placeholder={range?.minId ? `如 ${range.minId}` : ''} onChange={(e) => setStartText(e.target.value)} />
            <p className="text-[11px] text-cv-fg-subtle">{startText ? (indexOf(Number(startText)) ? `第 ${indexOf(Number(startText))} 条` : '不在本会话') : ' '}</p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cv-range-end">结束消息 ID</Label>
            <Input id="cv-range-end" type="number" inputMode="numeric" value={endText} placeholder={range?.maxId ? `如 ${range.maxId}` : ''} onChange={(e) => setEndText(e.target.value)} />
            <p className="text-[11px] text-cv-fg-subtle">{endText ? (indexOf(Number(endText)) ? `第 ${indexOf(Number(endText))} 条` : '不在本会话') : ' '}</p>
          </div>
          <div className="space-y-1.5">
            <Button variant="default" disabled={!canGenerate || generating || !manual?.ok} onClick={() => void run(Number(startText), Number(endText))}>
              {generating ? <Loader2 className="animate-spin" /> : <Sparkles />}生成手动范围
            </Button>
            <p className="text-[11px] text-cv-fg-subtle sm:hidden"> </p>
          </div>
        </div>
        {manual && <p role="status" className={cn('text-xs', manual.ok ? 'text-cv-success' : 'text-cv-danger')}>{manual.message}</p>}
        {!canGenerate && <p className="text-xs text-cv-warning">没有可用的 API 连接，无法生成。</p>}
        {error && <p role="alert" className="text-sm text-cv-danger">{error}</p>}
      </NeuSurface>
    </div>
  )
}
