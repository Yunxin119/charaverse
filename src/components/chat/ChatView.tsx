'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Loader2, Sparkles, AlertCircle, X } from 'lucide-react'
import { toast } from 'sonner'
import { useAuth } from '@/providers/AuthProvider'
import { useCharacter, useMessages, useProfile, useSession, usePresets, usePersonas, usePersonaBindings } from '@/queries'
import { resolvePersonaId } from '@/lib/personas/format'
import {
  useBranchSession, useDeleteFrom, useDeleteMessages, useDeleteSwipe, useEditMessage, useSelectSwipe,
  useUpdateSessionSettings, useUpdateSessionTitle,
} from '@/queries/useChatMutations'
import { useChatStream } from '@/hooks/useChatStream'
import { useAutoSummary } from '@/hooks/useAutoSummary'
import { useConnection } from '@/lib/llm/useConnection'
import { parseSessionSettings, type SessionSettings } from '@/lib/chat/settings'
import { parseCharacterCard } from '@/lib/chat/characterCard'
import { BUILTIN_DEFAULT_PRESET } from '@/lib/prompt/presets'
import { parseSkin } from '@/lib/skins/schema'
import { composeSkinCss } from '@/lib/skins/knobs'
import { parseSnapshot } from '@/components/character/snapshot'
import { SkinStyle } from './SkinStyle'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { GlassSheet, GlassSheetContent, IconButton, PosterCard, PosterTitle } from '@/components/glass'
import { CommentThread } from '@/components/comments/CommentThread'
import { PublishNoteBanner } from './PublishNoteBanner'
import type { ChatMessage } from '@/app/lib/supabase'
import { ChatHeader } from './ChatHeader'
import { MessageList } from './MessageList'
import { Composer } from './Composer'
import { ChatSettingsSheet } from './ChatSettingsSheet'
import { VisualNovelStage } from './VisualNovelStage'
import { ExportChatDialog } from './ExportChatDialog'
import { SwipesSheet } from './SwipesSheet'
import type { MessageActionHandlers } from './MessageActions'

const COMMENTS_STORAGE_KEY = 'cv.chat.comments'
const LARGE_QUERY = '(min-width: 1024px)' // tailwind `lg`

function useIsLarge(): boolean {
  const [large, setLarge] = useState(false)
  useEffect(() => {
    const mq = window.matchMedia(LARGE_QUERY)
    const update = () => setLarge(mq.matches)
    update()
    mq.addEventListener('change', update)
    return () => mq.removeEventListener('change', update)
  }, [])
  return large
}

export function ChatView({ sessionId }: { sessionId: string }) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { user } = useAuth()
  const userId = user?.id

  const sessionQ = useSession(sessionId)
  const session = sessionQ.data
  const characterQ = useCharacter(session?.character_id)
  // Non-owners chat with the published snapshot, never the author's live draft (plan A12)
  const character = useMemo(() => {
    const row = characterQ.data
    if (!row || !userId || row.user_id === userId) return row
    const snap = parseSnapshot(row.published_snapshot)
    return snap ? { ...row, name: snap.name, avatar_url: snap.avatar_url ?? row.avatar_url, prompt_template: snap.prompt_template, skin: snap.skin ?? {} } : row
  }, [characterQ.data, userId])
  const profileQ = useProfile(userId)
  const presetsQ = usePresets(userId)
  const personasQ = usePersonas(userId)
  const bindingsQ = usePersonaBindings(userId)
  const messagesQ = useMessages(sessionId)

  const settings: SessionSettings = useMemo(() => parseSessionSettings(session?.settings), [session?.settings])
  const card = useMemo(() => (character ? parseCharacterCard(character) : null), [character])
  const skin = useMemo(() => parseSkin((character as { skin?: unknown } | undefined)?.skin), [character])

  const messages: ChatMessage[] = useMemo(() => {
    const all = (messagesQ.data?.pages ?? []).flat()
    return all.filter((m) => m.role !== 'system').sort((a, b) => a.id - b.id)
  }, [messagesQ.data])

  const conn = useConnection()
  const modelId = settings.model ?? conn.defaultModel
  const headers = useMemo(() => conn.headersFor(modelId), [conn, modelId])

  const stream = useChatStream(sessionId)
  const editMessage = useEditMessage(sessionId)
  const deleteMessages = useDeleteMessages(sessionId)
  const deleteFrom = useDeleteFrom(sessionId)
  const selectSwipe = useSelectSwipe(sessionId)
  const deleteSwipe = useDeleteSwipe(sessionId)
  const updateSettings = useUpdateSessionSettings(sessionId)
  const updateTitle = useUpdateSessionTitle(sessionId)
  const branch = useBranchSession()

  const [input, setInput] = useState('')
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [exportOpen, setExportOpen] = useState(false)
  // visual-novel layout: full message log lives in a sheet; the header floats and is revealed by a stage tap
  const [logOpen, setLogOpen] = useState(false)
  const [swipesId, setSwipesId] = useState<number | null>(null)
  const [headerPeek, setHeaderPeek] = useState(false)
  // comments side column (public characters only): lg+ aside persisted in localStorage, < lg a transient sheet
  const isLarge = useIsLarge()
  // lazy read is hydration-safe: the aside only mounts once `isLarge` flips after mount
  const [commentsOpen, setCommentsOpen] = useState(() => {
    try { return localStorage.getItem(COMMENTS_STORAGE_KEY) !== '0' } catch { return true }
  })
  const [commentsSheetOpen, setCommentsSheetOpen] = useState(false)
  const toggleComments = useCallback(() => {
    if (!isLarge) { setCommentsSheetOpen(true); return }
    setCommentsOpen((v) => {
      try { localStorage.setItem(COMMENTS_STORAGE_KEY, v ? '0' : '1') } catch { /* storage unavailable */ }
      return !v
    })
  }, [isLarge])
  const [inspiring, setInspiring] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const autoSummary = useAutoSummary({
    sessionId, userId, characterName: card?.name ?? '角色', every: settings.context.autoSummaryEvery, headers,
    onDone: (ok) => { if (ok) toast.success('已自动整理剧情摘要与记忆') },
  })

  const busy = stream.isStreaming || editMessage.isPending || deleteMessages.isPending || deleteFrom.isPending || selectSwipe.isPending || branch.isPending

  const requireHeaders = useCallback((): Record<string, string> | null => {
    if (!headers) {
      setNotice(conn.options.length ? '请先在会话设置里选择一个模型' : '还没有配置任何 API 连接，去「我的 → API 连接」添加')
      setSettingsOpen(true)
      return null
    }
    return headers
  }, [headers, conn.options.length])

  const runSafe = useCallback(async (opts: Parameters<typeof stream.run>[0]) => {
    try { return await stream.run(opts) } catch { return '' }
  }, [stream])

  // --- opening line when the character has none and the session was just created ---
  const openingTried = useRef(false)
  useEffect(() => {
    if (openingTried.current) return
    if (searchParams.get('opening') !== '1') return
    if (!session || messagesQ.isLoading || messages.length > 0 || !headers) return
    openingTried.current = true
    router.replace(`/chat/${sessionId}`)
    void runSafe({ action: 'opening', headers, render: settings.streaming })
  }, [searchParams, session, messagesQ.isLoading, messages.length, headers, router, sessionId, runSafe, settings.streaming])

  // --- actions ---
  const send = async () => {
    const text = input.trim()
    const h = requireHeaders()
    if (!text || !h) return
    setInput('')
    await runSafe({ action: 'send', text, headers: h, render: settings.streaming })
    void autoSummary.maybeRun(messagesRef.current)
  }

  // latest messages for callbacks that run after a stream finishes
  const messagesRef = useRef(messages)
  useEffect(() => { messagesRef.current = messages }, [messages])

  const inspire = async () => {
    const h = requireHeaders()
    if (!h) return
    setInspiring(true)
    try {
      const text = await stream.run({ action: 'inspire', headers: h, render: false })
      if (text.trim()) setInput(text.trim())
    } catch { /* error surfaced by stream.error */ } finally {
      setInspiring(false)
    }
  }

  const handlersFor = useCallback((m: ChatMessage, isLast: boolean): MessageActionHandlers => {
    const h = () => requireHeaders()
    return {
      onEdit: () => { setEditingId(m.id); setSelectedId(m.id) },
      onDelete: () => { if (confirm('删除这条消息？')) deleteMessages.mutate([m.id]) },
      onBranch: () => branch.mutate({ sessionId, messageId: m.id }, { onSuccess: (id) => router.push(`/chat/${id}`) }),
      onRegenerate: isLast && m.role === 'assistant' ? () => { const hh = h(); if (hh) void runSafe({ action: 'regenerate', messageId: m.id, headers: hh, render: settings.streaming }) } : undefined,
      onContinue: isLast && m.role === 'assistant' ? () => { const hh = h(); if (hh) void runSafe({ action: 'continue', headers: hh, render: settings.streaming }) } : undefined,
      onResend: isLast && m.role === 'user' ? async () => {
        const hh = h(); if (!hh) return
        await deleteFrom.mutateAsync(m.id)
        await runSafe({ action: 'send', text: m.content, headers: hh, render: settings.streaming })
      } : undefined,
    }
  }, [requireHeaders, deleteMessages, branch, sessionId, router, runSafe, deleteFrom, settings.streaming])

  const saveSettings = async (patch: { title?: string; settings: Partial<SessionSettings> }) => {
    if (patch.title !== undefined) await updateTitle.mutateAsync(patch.title)
    await updateSettings.mutateAsync(patch.settings)
    setNotice(null)
  }

  const clearMessages = async () => {
    if (!messages.length) return
    await deleteFrom.mutateAsync(messages[0].id)
  }

  // --- render ---
  if (sessionQ.isLoading || (session && characterQ.isLoading)) {
    return <div className="flex h-dvh items-center justify-center text-cv-fg-muted"><Loader2 className="mr-2 size-5 animate-spin" />加载对话…</div>
  }
  if (sessionQ.isError || !session || !character || !card || !userId) {
    return (
      <div className="flex h-dvh items-center justify-center p-6">
        <PosterCard tone="ink" className="max-w-md"><PosterTitle>找不到这个对话</PosterTitle><p className="mt-2 text-sm opacity-80">它可能已被删除，或者不属于当前账号。</p>
          <Button className="mt-5" variant="accent" onClick={() => router.push('/chat')}>返回对话列表</Button></PosterCard>
      </div>
    )
  }

  const characterSpeaker = { name: card.name, avatarUrl: character.avatar_url }
  // who 「你」 is: session pick → persona bound to this character → default persona (mirrors loadContext on the server)
  const personas = personasQ.data ?? []
  const inheritedPersonaId = resolvePersonaId(undefined, bindingsQ.data?.get(character.id), personas.find((p) => p.is_default)?.id, (x) => personas.some((p) => p.id === x))
  const personaId = resolvePersonaId(settings.personaId, bindingsQ.data?.get(character.id), personas.find((p) => p.is_default)?.id, (x) => personas.some((p) => p.id === x))
  const persona = personaId ? personas.find((p) => p.id === personaId) : undefined
  const userSpeaker = { name: settings.userName || persona?.name || profileQ.data?.username || card.userName, avatarUrl: persona?.avatar_url || profileQ.data?.avatar_url }
  const novel = settings.layout === 'novel'
  const toggleLayout = () => updateSettings.mutate({ layout: novel ? 'flow' : 'novel' })
  // backdrop: the session's own image, else the character's avatar (dimmed + blurred in flow mode, full in novel mode)
  const bg = settings.background
  const avatarFallback = !bg.url && bg.useAvatar && !!character.avatar_url
  const bgUrl = bg.url ?? (avatarFallback ? character.avatar_url! : undefined)
  const bgOpacity = avatarFallback ? (novel ? 1 : 0.5) : bg.opacity
  const bgBlur = avatarFallback ? (novel ? 0 : 16) : bg.blur
  const commentTarget = character.is_public ? { id: character.id, authorId: character.user_id } : null
  const commentsAvailable = !!commentTarget
  const isPlayer = character.user_id !== userId
  const presetLabel = settings.presetId ? presetsQ.data?.find((p) => p.id === settings.presetId)?.name : (presetsQ.data?.find((p) => p.is_default)?.name ?? BUILTIN_DEFAULT_PRESET.name)

  // --- pieces shared by both layouts ---
  const lastMessage = messages[messages.length - 1]
  const renderSkin = { regexScripts: skin.regexScripts, renderHtml: skin.renderHtml, char: card.name, user: userSpeaker.name }
  const streamingText = stream.isStreaming && stream.streamingAction !== 'inspire' ? stream.streamingText : null
  const composerProps = {
    value: input, onChange: setInput, onSend: send, onStop: stream.stop, onInspire: inspire,
    streaming: stream.isStreaming && stream.streamingAction !== 'inspire', inspiring, placeholder: `对 ${card.name} 说点什么…`,
  }
  const emptyState = (
    <div className="mx-auto mt-10 max-w-sm text-center">
      <div className="mx-auto mb-3 flex size-12 items-center justify-center rounded-cv-md bg-cv-accent text-white shadow-[0_10px_24px_-10px_var(--cv-accent)]"><Sparkles className="size-5" /></div>
      <h2 className="font-display text-xl font-semibold">和 {card.name} 的故事还没开始</h2>
      <p className="mt-1 text-sm text-cv-fg-muted">{card.introduction || '发一句话，或者让角色先开口。'}</p>
      {headers && <Button className="mt-4" variant="neu" size="sm" onClick={() => void runSafe({ action: 'opening', headers, render: settings.streaming })}>让 {card.name} 先说</Button>}
    </div>
  )
  const noticeEl = (stream.error || notice) ? (
    <div className="mx-auto mb-1 flex w-[min(100%-1.5rem,48rem)] items-center gap-2 rounded-cv-md border border-cv-danger/30 bg-[color-mix(in_oklab,var(--cv-danger)_10%,var(--cv-bg-elevated))] px-3 py-2 text-sm text-cv-danger">
      <AlertCircle className="size-4 shrink-0" />
      <span className="flex-1">{stream.error ?? notice}</span>
      <button type="button" aria-label="关闭" onClick={() => { stream.clearError(); setNotice(null) }} className="rounded-full p-1 hover:bg-cv-danger/10"><X className="size-4" /></button>
    </div>
  ) : null
  const messageList = (
    <MessageList
      messages={messages}
      character={characterSpeaker}
      user={userSpeaker}
      skin={renderSkin}
      streamingText={streamingText}
      busy={busy}
      selectedId={selectedId}
      editingId={editingId}
      onSelect={setSelectedId}
      handlersFor={handlersFor}
      onEditSave={(m, content) => editMessage.mutate({ message: m, content }, { onSuccess: () => setEditingId(null) })}
      onEditCancel={() => setEditingId(null)}
      onSwipe={(m, index) => selectSwipe.mutate({ messageId: m.id, index })}
      onOpenSwipes={(m) => setSwipesId(m.id)}
      hasOlder={!!messagesQ.hasNextPage}
      loadingOlder={messagesQ.isFetchingNextPage}
      onLoadOlder={() => void messagesQ.fetchNextPage()}
      emptyState={emptyState}
    />
  )

  return (
    <div id="cv_chat_root" className="relative flex h-dvh flex-col overflow-hidden">
      <SkinStyle css={composeSkinCss(skin.knobs, skin.css || card.customCss)} allowedUrlHosts={skin.allowedUrlHosts} />
      {bgUrl && (
        <>
          <div
            id="cv_background_image"
            aria-hidden
            data-source={bg.url ? 'custom' : 'avatar'}
            className="pointer-events-none absolute inset-0 -z-20 bg-cover"
            style={{ backgroundImage: `url(${bgUrl})`, backgroundPosition: novel ? 'center 18%' : 'center', opacity: bgOpacity, filter: bgBlur ? `blur(${bgBlur}px)` : undefined, transform: bgBlur ? 'scale(1.06)' : undefined }}
          />
          <div id="cv_background_overlay" aria-hidden className={cn('pointer-events-none absolute inset-0 -z-10 bg-gradient-to-b', novel ? 'from-cv-bg/35 via-transparent to-transparent' : 'from-cv-bg/40 via-transparent to-cv-bg/60')} />
        </>
      )}

      {/* row: chat column + optional comments aside. #cv_chat_root keeps `flex h-dvh flex-col` for skins. */}
      <div id="cv_chat_row" className="flex min-h-0 flex-1">
        <div id="cv_chat_column" data-layout={settings.layout} className="relative flex min-w-0 flex-1 flex-col">
          <ChatHeader
            sessionId={sessionId}
            character={{ id: character.id, ...characterSpeaker }}
            title={session.title}
            modelLabel={modelId ? conn.displayName(modelId) : undefined}
            presetLabel={presetLabel}
            onOpenSettings={() => setSettingsOpen(true)}
            onExport={() => setExportOpen(true)}
            commentsAvailable={commentsAvailable}
            commentsOpen={isLarge ? commentsOpen : commentsSheetOpen}
            onToggleComments={toggleComments}
            layout={settings.layout}
            onToggleLayout={toggleLayout}
            floating={novel}
            revealed={headerPeek}
            onNewBranchFromEnd={messages.length ? () => branch.mutate({ sessionId, messageId: messages[messages.length - 1].id }, { onSuccess: (id) => router.push(`/chat/${id}`) }) : undefined}
          />
          {isPlayer && character.is_public && character.published_at && (
            <PublishNoteBanner characterId={character.id} publishedAt={character.published_at} note={character.release_note ?? null} className={cn('mx-3 shrink-0 sm:mx-4', novel ? 'mt-20' : 'mt-2')} />
          )}

          {novel ? (
            <VisualNovelStage
              messages={messages}
              character={characterSpeaker}
              user={userSpeaker}
              skin={renderSkin}
              streamingText={streamingText}
              busy={busy}
              onSwipe={(m, index) => selectSwipe.mutate({ messageId: m.id, index })}
              onOpenSwipes={(m) => setSwipesId(m.id)}
              onRegenerate={lastMessage?.role === 'assistant' ? handlersFor(lastMessage, true).onRegenerate : undefined}
              onContinue={lastMessage?.role === 'assistant' ? handlersFor(lastMessage, true).onContinue : undefined}
              onOpenLog={() => setLogOpen(true)}
              onStageTap={() => setHeaderPeek((v) => !v)}
              notice={noticeEl}
              emptyState={emptyState}
              composer={composerProps}
            />
          ) : (
            <>
              {messageList}
              {noticeEl}
              <Composer {...composerProps} />
            </>
          )}
        </div>

        {commentsAvailable && isLarge && commentsOpen && (
          <aside id="cv_comments_panel" aria-label="评论" className="glass hidden w-[340px] shrink-0 flex-col border-l border-cv-border lg:flex">
            <div className="flex shrink-0 items-center justify-between px-4 pb-1 pt-3">
              <h2 className="font-display text-base font-semibold">评论</h2>
              <IconButton label="收起评论" variant="ghost" size="sm" onClick={toggleComments}><X /></IconButton>
            </div>
            {commentTarget && <CommentThread variant="panel" characterId={commentTarget.id} authorId={commentTarget.authorId} className="min-h-0 flex-1" />}
          </aside>
        )}
      </div>

      {novel && (
        <GlassSheet open={logOpen} onOpenChange={setLogOpen}>
          <GlassSheetContent side="right" title="对话记录" className="sm:max-w-2xl [&>div:last-child]:flex [&>div:last-child]:min-h-0 [&>div:last-child]:flex-1 [&>div:last-child]:flex-col">
            {messageList}
          </GlassSheetContent>
        </GlassSheet>
      )}

      {commentsAvailable && !isLarge && (
        <GlassSheet open={commentsSheetOpen} onOpenChange={setCommentsSheetOpen}>
          <GlassSheetContent side="right" title="评论" className="[&>div:last-child]:flex [&>div:last-child]:min-h-0 [&>div:last-child]:flex-1 [&>div:last-child]:flex-col">
            {commentTarget && <CommentThread variant="panel" characterId={commentTarget.id} authorId={commentTarget.authorId} className="min-h-0 flex-1" />}
          </GlassSheetContent>
        </GlassSheet>
      )}

      <ChatSettingsSheet
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        sessionId={sessionId}
        userId={userId}
        title={session.title ?? ''}
        settings={settings}
        models={conn.options.map((o) => ({ id: o.ref, label: o.label }))}
        presets={presetsQ.data ?? []}
        builtinPresetName={BUILTIN_DEFAULT_PRESET.name}
        saving={updateSettings.isPending || updateTitle.isPending}
        onSave={saveSettings}
        onClearMessages={clearMessages}
        inheritedPersonaName={inheritedPersonaId ? personas.find((p) => p.id === inheritedPersonaId)?.name ?? null : null}
      />

      <SwipesSheet
        message={swipesId === null ? null : (messages.find((m) => m.id === swipesId) ?? null)}
        onClose={() => setSwipesId(null)}
        characterName={characterSpeaker.name}
        skin={renderSkin}
        busy={busy || selectSwipe.isPending}
        deleting={deleteSwipe.isPending}
        onSelect={(m, index) => selectSwipe.mutate({ messageId: m.id, index })}
        onDelete={(m, index) => deleteSwipe.mutate({ message: m, index }, { onError: (e) => toast.error(e instanceof Error ? e.message : '删除失败') })}
      />

      <ExportChatDialog
        open={exportOpen}
        onOpenChange={setExportOpen}
        sessionId={sessionId}
        title={session.title}
        characterName={card.name}
        characterId={character.id}
        userName={userSpeaker.name}
        settings={settings}
      />
    </div>
  )
}
