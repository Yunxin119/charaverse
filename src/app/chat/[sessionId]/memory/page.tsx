'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { ArrowLeft, FileText, Brain, BarChart3, Cpu, X } from 'lucide-react'
import { useAuth } from '@/providers/AuthProvider'
import { useCharacter, useSession, useMemories, useUpsertMemory, useDeleteMemory, useToggleMemory, useSummaries, useGenerateSummary, useUpdateSummary, useDeleteSummary, useMessageRange } from '@/queries'
import type { SummaryRow } from '@/queries/useSummaries'
import { parseSessionSettings } from '@/lib/chat/settings'
import { useConnection } from '@/lib/llm/useConnection'
import { type MemoryEntry, type MemoryInput, type TaskStatus } from '@/lib/memory/types'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Chip, IconButton, StatusDot } from '@/components/glass'
import { MemoryForm, MemoryGrid, SummaryTimeline, ContextCoverage } from '@/components/memory'
import { cn } from '@/lib/utils'

type Notice = { tone: 'success' | 'danger' | 'info'; text: string }

export default function MemoryManagePage() {
  const { sessionId } = useParams<{ sessionId: string }>()
  const router = useRouter()
  const { user } = useAuth()
  const userId = user?.id

  const { data: session } = useSession(sessionId)
  const { data: character } = useCharacter(session?.character_id)
  const characterName = character?.name ?? '角色'

  const conn = useConnection()
  const model = parseSessionSettings(session?.settings).model ?? conn.defaultModel ?? null
  const headers = conn.headersFor(model)
  const canGenerate = !!headers && !!userId
  const modelLabel = model ? conn.displayName(model) : null

  const summaries = useSummaries(sessionId, userId)
  const memories = useMemories(sessionId, userId)
  const range = useMessageRange(sessionId)

  const generate = useGenerateSummary()
  const updateSummary = useUpdateSummary()
  const deleteSummary = useDeleteSummary()
  const upsertMemory = useUpsertMemory(sessionId, userId)
  const deleteMemory = useDeleteMemory(sessionId)
  const toggleMemory = useToggleMemory(sessionId)

  const [notice, setNotice] = useState<Notice | null>(null)
  const [useMemoryTable, setUseMemoryTable] = useState(true)
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<MemoryEntry | null>(null)
  const [busyMemoryId, setBusyMemoryId] = useState<string | null>(null)
  const [regeneratingId, setRegeneratingId] = useState<number | null>(null)
  const [deletingId, setDeletingId] = useState<number | null>(null)

  const ids = range.data?.ids
  const indexOf = useMemo(() => {
    const map = new Map<number, number>()
    ids?.forEach((id, i) => map.set(id, i + 1))
    return (id: number) => map.get(id) ?? null
  }, [ids])

  const fail = (e: unknown, fallback: string) => setNotice({ tone: 'danger', text: (e as Error)?.message || fallback })

  /* ---- summaries ---- */
  const runGenerate = async (startMessageId: number, endMessageId: number, summaryId?: number) => {
    if (!headers || !userId) throw new Error('没有可用的 API 连接')
    const result = await generate.mutateAsync({ sessionId, userId, startMessageId, endMessageId, characterName, useMemoryTable, summaryId, headers })
    const n = result.memories?.length ?? 0
    setNotice({ tone: 'success', text: summaryId ? `摘要已重新生成${n ? `，更新了 ${n} 条记忆` : ''}` : `摘要已生成${n ? `，提取了 ${n} 条记忆` : ''}` })
  }

  const onRegenerate = async (s: SummaryRow) => {
    if (!s.start_message_id || !s.end_message_id) return
    setRegeneratingId(s.id)
    try { await runGenerate(s.start_message_id, s.end_message_id, s.id) }
    finally { setRegeneratingId(null) }
  }

  const onSaveSummary = async (s: SummaryRow, content: string) => {
    if (!userId) return
    await updateSummary.mutateAsync({ sessionId, summaryId: s.id, userId, content })
    setNotice({ tone: 'success', text: '摘要已保存' })
  }

  const onDeleteSummary = async (s: SummaryRow) => {
    setDeletingId(s.id)
    try {
      const r = await deleteSummary.mutateAsync({ sessionId, summaryId: s.id })
      setNotice({ tone: 'success', text: `摘要已删除：${r.reverted} 条记忆回退到上一版本，${r.disabled} 条记忆已停用` })
    } catch (e) { fail(e, '删除摘要失败') }
    finally { setDeletingId(null) }
  }

  /* ---- memories ---- */
  const onSubmitMemory = async (values: MemoryInput) => {
    await upsertMemory.mutateAsync({ ...values, id: editing?.id })
    setNotice({ tone: 'success', text: editing ? '记忆已更新' : '记忆已添加' })
  }

  const withBusy = async (m: MemoryEntry, fn: () => Promise<unknown>, fallback: string) => {
    setBusyMemoryId(m.id)
    try { await fn() } catch (e) { fail(e, fallback) } finally { setBusyMemoryId(null) }
  }
  const onDeleteMemory = (m: MemoryEntry) => withBusy(m, () => deleteMemory.mutateAsync(m.id), '删除记忆失败')
  const onToggleMemory = (m: MemoryEntry, enabled: boolean) => void withBusy(m, () => toggleMemory.mutateAsync({ memoryId: m.id, isEnabled: enabled }), '切换状态失败')
  const onTaskStatus = (m: MemoryEntry, status: TaskStatus) =>
    void withBusy(m, () => upsertMemory.mutateAsync({ id: m.id, type: m.type, title: m.title, content: m.content, importance: m.importance, metadata: { ...(m.metadata ?? {}), status } }), '更新任务状态失败')

  const summaryCount = summaries.data?.length ?? 0
  const memoryCount = memories.data?.length ?? 0

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6">
      <header className="mb-6 flex flex-wrap items-center gap-3">
        <IconButton label="返回对话" variant="glass" onClick={() => router.push(`/chat/${sessionId}`)}><ArrowLeft /></IconButton>
        <div className="min-w-0 flex-1">
          <h1 className="font-display text-2xl font-semibold leading-tight sm:text-3xl">记忆与摘要</h1>
          <p className="mt-0.5 truncate text-sm text-cv-fg-muted">{characterName}{session?.title ? ` · ${session.title}` : ''}</p>
        </div>
        <div className="flex items-center gap-2">
          {headers && modelLabel ? (
            <Chip tone="glass" title="摘要生成使用的模型（跟随会话设置）"><Cpu className="size-3.5" />{modelLabel}</Chip>
          ) : (
            <Button asChild size="sm" variant="outline"><Link href="/settings/connections"><Cpu />未配置 API 连接</Link></Button>
          )}
          <Button asChild size="sm" variant="neu" className="hidden sm:inline-flex"><Link href={`/chat/${sessionId}`}><ArrowLeft />返回对话</Link></Button>
        </div>
      </header>

      {notice && (
        <div role="status" className={cn('glass mb-4 flex items-start gap-3 rounded-cv-md px-4 py-3 text-sm', notice.tone === 'danger' && 'text-cv-danger')}>
          <StatusDot tone={notice.tone === 'danger' ? 'danger' : notice.tone === 'success' ? 'success' : 'info'} className="mt-1.5" />
          <span className="flex-1">{notice.text}</span>
          <IconButton label="关闭提示" size="sm" onClick={() => setNotice(null)}><X /></IconButton>
        </div>
      )}

      <Tabs defaultValue="summaries">
        <TabsList className="mb-4 w-full sm:w-fit">
          <TabsTrigger value="summaries"><FileText />摘要{summaryCount ? <span className="font-mono text-xs opacity-70">{summaryCount}</span> : null}</TabsTrigger>
          <TabsTrigger value="memories"><Brain />记忆{memoryCount ? <span className="font-mono text-xs opacity-70">{memoryCount}</span> : null}</TabsTrigger>
          <TabsTrigger value="context"><BarChart3 />上下文</TabsTrigger>
        </TabsList>

        <TabsContent value="summaries">
          {summaries.isError && <p className="mb-3 text-sm text-cv-danger">摘要加载失败：{(summaries.error as Error).message}</p>}
          <SummaryTimeline
            summaries={summaries.data}
            loading={summaries.isPending}
            indexOf={indexOf}
            canGenerate={canGenerate}
            regeneratingId={regeneratingId}
            deletingId={deletingId}
            onSave={onSaveSummary}
            onRegenerate={onRegenerate}
            onDelete={onDeleteSummary}
          />
        </TabsContent>

        <TabsContent value="memories">
          {memories.isError && <p className="mb-3 text-sm text-cv-danger">记忆加载失败：{(memories.error as Error).message}</p>}
          <MemoryGrid
            memories={memories.data}
            loading={memories.isPending}
            busyId={busyMemoryId}
            onAdd={() => { setEditing(null); setFormOpen(true) }}
            onEdit={(m) => { setEditing(m); setFormOpen(true) }}
            onDelete={onDeleteMemory}
            onToggle={onToggleMemory}
            onTaskStatus={onTaskStatus}
          />
        </TabsContent>

        <TabsContent value="context">
          {range.isError && <p className="mb-3 text-sm text-cv-danger">消息范围加载失败：{(range.error as Error).message}</p>}
          <ContextCoverage
            range={range.data}
            summaries={summaries.data}
            loading={range.isPending || summaries.isPending}
            canGenerate={canGenerate}
            generating={generate.isPending && regeneratingId === null}
            useMemoryTable={useMemoryTable}
            onUseMemoryTableChange={setUseMemoryTable}
            onGenerate={(start, end) => runGenerate(start, end)}
          />
        </TabsContent>
      </Tabs>

      <MemoryForm open={formOpen} onOpenChange={setFormOpen} initial={editing} saving={upsertMemory.isPending} onSubmit={onSubmitMemory} />
    </div>
  )
}
