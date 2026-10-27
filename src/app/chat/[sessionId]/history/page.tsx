'use client'

import { useEffect, useMemo, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { ArrowLeft, Download, Loader2 } from 'lucide-react'
import type { ChatMessage } from '@/app/lib/supabase'
import { Button } from '@/components/ui/button'
import { CardSkeleton, IconButton, PosterCard, PosterTitle } from '@/components/glass'
import { EditMessageDialog, HistoryMessageRow, HistoryToolbar, InlineNotice, useMessageCount, type RoleFilter } from '@/components/history'
import { useCharacter, useSession, useMessages, useEditMessage, useDeleteMessages } from '@/queries'
import { parseSessionSettings } from '@/lib/chat/settings'
import { parseCharacterCard } from '@/lib/chat/characterCard'
import { ExportChatDialog } from '@/components/chat/ExportChatDialog'

const MAX_JUMP_PAGES = 60

export default function ChatHistoryPage() {
  const router = useRouter()
  const sessionId = useParams().sessionId as string

  const session = useSession(sessionId)
  const character = useCharacter(session.data?.character_id)
  const messages = useMessages(sessionId)
  const count = useMessageCount(sessionId)
  const edit = useEditMessage(sessionId)
  const del = useDeleteMessages(sessionId)

  const [query, setQuery] = useState('')
  const [role, setRole] = useState<RoleFilter>('all')
  const [editing, setEditing] = useState<ChatMessage | null>(null)
  const [editError, setEditError] = useState<string | null>(null)
  const [highlight, setHighlight] = useState<number | null>(null)
  const [jumping, setJumping] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const [exportOpen, setExportOpen] = useState(false)

  const characterLabel = character.data?.name ?? '角色'
  const userLabel = useMemo(
    () => parseSessionSettings(session.data?.settings).userName ?? (character.data ? parseCharacterCard(character.data).userName : '用户'),
    [session.data?.settings, character.data]
  )

  // newest first, as the pages arrive
  const loaded = useMemo(() => (messages.data?.pages ?? []).flat(), [messages.data])
  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()
    return loaded.filter((m) => (role === 'all' || m.role === role) && (!q || m.content.toLowerCase().includes(q)))
  }, [loaded, query, role])

  useEffect(() => {
    if (highlight === null) return
    const el = document.getElementById(`msg-${highlight}`)
    el?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    const t = setTimeout(() => setHighlight(null), 2400)
    return () => clearTimeout(t)
  }, [highlight])

  const jumpTo = async (id: number) => {
    setJumping(true)
    setNotice(null)
    try {
      let found = loaded.some((m) => m.id === id)
      let r = messages
      let guard = 0
      while (!found && r.hasNextPage && guard++ < MAX_JUMP_PAGES) {
        r = await messages.fetchNextPage()
        found = (r.data?.pages ?? []).flat().some((m) => m.id === id)
      }
      if (!found) {
        setNotice(`没有找到消息 #${id}，它可能已被删除或不属于这个会话。`)
        return
      }
      setQuery('')
      setRole('all')
      setHighlight(id)
    } finally {
      setJumping(false)
    }
  }

  const save = (content: string) => {
    if (!editing) return
    setEditError(null)
    edit.mutate({ message: editing, content }, {
      onSuccess: () => setEditing(null),
      onError: (e) => setEditError(e instanceof Error ? e.message : '保存失败，请重试'),
    })
  }

  const total = count.data
  const back = () => router.push(`/chat/${sessionId}`)

  return (
    <div className="mx-auto max-w-4xl px-4 py-6 sm:px-6">
      <header className="mb-5 flex items-center gap-3">
        <IconButton label="返回对话" variant="glass" onClick={back}><ArrowLeft /></IconButton>
        <div className="min-w-0 flex-1">
          <h1 className="truncate font-display text-2xl font-semibold leading-tight sm:text-3xl">完整历史</h1>
          <p className="mt-0.5 truncate text-xs text-cv-fg-muted sm:text-sm">
            {session.data?.title?.trim() || `与 ${characterLabel} 的对话`}
            {typeof total === 'number' && ` · 共 ${total} 条`}
            {loaded.length > 0 && ` · 已加载 ${loaded.length} 条`}
          </p>
        </div>
        <Button variant="glass" size="sm" onClick={() => setExportOpen(true)} disabled={!session.data}><Download />导出</Button>
      </header>

      {session.data && (
        <ExportChatDialog
          open={exportOpen}
          onOpenChange={setExportOpen}
          sessionId={sessionId}
          title={session.data.title}
          characterName={characterLabel}
          characterId={session.data.character_id}
          userName={userLabel}
          settings={(session.data.settings ?? undefined) as Record<string, unknown> | undefined}
        />
      )}

      <HistoryToolbar
        query={query}
        onQueryChange={setQuery}
        role={role}
        onRoleChange={setRole}
        userLabel={userLabel}
        characterLabel={characterLabel}
        onJump={(id) => void jumpTo(id)}
        jumping={jumping}
      />

      {notice && <InlineNotice className="mb-4" onClose={() => setNotice(null)}>{notice}</InlineNotice>}

      {messages.isLoading && (
        <div className="space-y-3">
          {Array.from({ length: 6 }).map((_, i) => <CardSkeleton key={i} variant="row" />)}
        </div>
      )}

      {messages.isError && (
        <PosterCard tone="ink" className="text-center">
          <PosterTitle>加载失败</PosterTitle>
          <p className="mt-2 text-sm opacity-80">网络或权限问题，稍后再试。</p>
          <Button variant="glass" size="sm" className="mt-4" onClick={() => messages.refetch()}>重试</Button>
        </PosterCard>
      )}

      {messages.data && loaded.length === 0 && (
        <PosterCard tone="secondary" className="text-center">
          <PosterTitle>还没有消息</PosterTitle>
          <p className="mt-2 text-sm opacity-80">回到对话里说点什么吧。</p>
        </PosterCard>
      )}

      {loaded.length > 0 && visible.length === 0 && (
        <p className="py-10 text-center text-sm text-cv-fg-muted">
          已加载的 {loaded.length} 条里没有匹配的消息{messages.hasNextPage ? '，可以加载更早的消息再找找' : ''}。
        </p>
      )}

      {visible.length > 0 && (
        <ul className="space-y-3">
          {visible.map((m) => (
            <HistoryMessageRow
              key={m.id}
              message={m}
              userLabel={userLabel}
              characterLabel={characterLabel}
              highlighted={highlight === m.id}
              deleting={del.isPending && (del.variables?.includes(m.id) ?? false)}
              onEdit={() => { setEditError(null); setEditing(m) }}
              onDelete={() => del.mutate([m.id], { onError: (e) => setNotice(e instanceof Error ? e.message : '删除失败，请重试') })}
            />
          ))}
        </ul>
      )}

      {messages.hasNextPage && (
        <div className="mt-6 flex flex-col items-center gap-2">
          <Button variant="neu" onClick={() => messages.fetchNextPage()} disabled={messages.isFetchingNextPage || jumping}>
            {(messages.isFetchingNextPage || jumping) && <Loader2 className="animate-spin" />}
            {jumping ? '正在定位…' : '加载更早的消息'}
          </Button>
          {query.trim() && <p className="text-xs text-cv-fg-subtle">搜索只覆盖已加载的消息</p>}
        </div>
      )}
      {!messages.hasNextPage && loaded.length > 0 && (
        <p className="mt-6 text-center text-xs text-cv-fg-subtle">已经是最早的消息了</p>
      )}

      <EditMessageDialog
        message={editing}
        userLabel={userLabel}
        characterLabel={characterLabel}
        saving={edit.isPending}
        error={editError}
        onClose={() => setEditing(null)}
        onSave={save}
      />
    </div>
  )
}
