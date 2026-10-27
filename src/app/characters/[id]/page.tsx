'use client'

import { useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { Loader2, MessageSquarePlus, Play, Pencil, Palette, Globe, ArrowLeft, MoreHorizontal, FileJson, ImageDown, Upload, MessagesSquare, Repeat, ExternalLink, UserRound } from 'lucide-react'
import { toast } from 'sonner'
import { useAuth } from '@/providers/AuthProvider'
import { useCharacter, useCharacterSessions, useChatImport, useCharacterStats } from '@/queries'
import { formatCount } from '@/components/stats/StatTiles'
import { useStartSession } from '@/queries/useChatMutations'
import { useBindPersona, usePersonaBindings } from '@/queries/usePersonas'
import { PersonaPicker } from '@/components/personas/PersonaPicker'
import { parseCharacterCard } from '@/lib/chat/characterCard'
import { parseSnapshot } from '@/components/character/snapshot'
import { importChatText } from '@/lib/chatlog/format'
import { downloadCharacterJson, downloadCharacterPng } from '@/lib/cards/exportBrowser'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Chip, GlassPanel, IconButton, PosterCard, PosterTitle, CardSkeleton } from '@/components/glass'
import { SessionList } from '@/components/sessions/SessionList'

const MAX_CHAT_FILE_BYTES = 50 * 1024 * 1024

/** Character hub: the character and every conversation with it, in one place. */
export default function CharacterHubPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const { user } = useAuth()
  const characterQ = useCharacter(id)
  const sessionsQ = useCharacterSessions(user?.id, characterQ.data?.id)
  const start = useStartSession()
  const bindingsQ = usePersonaBindings(user?.id)
  const bindPersona = useBindPersona(user?.id)
  const chatImport = useChatImport()
  const chatFileRef = useRef<HTMLInputElement>(null)
  const statsQ = useCharacterStats(characterQ.data ? [characterQ.data.id] : [])

  if (characterQ.isLoading || !user) return <div className="flex h-dvh items-center justify-center text-cv-fg-muted"><Loader2 className="mr-2 size-5 animate-spin" />加载角色…</div>
  const row = characterQ.data
  if (!row) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6">
        <PosterCard tone="ink" className="min-h-48">
          <PosterTitle>找不到这个角色</PosterTitle>
          <p className="mt-2 text-sm opacity-80">它可能已被删除，或者作者撤回了发布。你和它的对话仍然在「聊天」列表里。</p>
          <Button className="mt-5 self-start" variant="accent" onClick={() => router.push('/chat')}>去聊天列表</Button>
        </PosterCard>
      </div>
    )
  }
  // Someone else's character: this page is 「我和它的对话」. Show what was published, never the author's draft.
  const isOwner = row.user_id === user.id
  const snap = isOwner ? null : parseSnapshot(row.published_snapshot)
  const c = snap ? { ...row, name: snap.name, avatar_url: snap.avatar_url ?? row.avatar_url, prompt_template: snap.prompt_template } : row

  const card = parseCharacterCard(c)
  const stats = statsQ.data?.get(c.id)
  const sessions = sessionsQ.data ?? []
  const latest = sessions[0]
  const open = (forceNew: boolean) =>
    start.mutate({ userId: user.id, characterId: c.id, forceNew }, { onSuccess: ({ sessionId, needsOpening }) => router.push(`/chat/${sessionId}${needsOpening ? '?opening=1' : ''}`) })

  const exportJson = () => {
    try {
      downloadCharacterJson(c)
      toast.success(`已导出「${c.name}」的 JSON 角色卡`)
    } catch (e) {
      toast.error((e as Error).message || '导出失败，请重试')
    }
  }
  const exportPng = async () => {
    try {
      await downloadCharacterPng(c)
      toast.success(`已导出「${c.name}」的 PNG 角色卡`)
    } catch (e) {
      toast.error((e as Error).message || '导出失败，请重试')
    }
  }
  const importChatFile = async (file: File) => {
    if (file.size > MAX_CHAT_FILE_BYTES) { toast.error(`文件过大（上限 ${MAX_CHAT_FILE_BYTES / 1024 / 1024} MB）`); return }
    let text: string
    try { text = await file.text() } catch { toast.error('读取文件失败'); return }
    const parsed = importChatText(text)
    if (!parsed.ok) { toast.error(parsed.error); return }
    chatImport.mutate(
      { userId: user.id, characterId: c.id, chat: parsed.chat },
      {
        onSuccess: ({ sessionId, count }) => { toast.success(`已导入 ${count} 条消息`); router.push(`/chat/${sessionId}`) },
        onError: (e) => toast.error((e as Error).message || '导入失败，请重试'),
      },
    )
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6">
      <div className="mb-4 flex items-center gap-2">
        <IconButton label="返回角色列表" variant="ghost" onClick={() => router.push('/characters')}><ArrowLeft /></IconButton>
        <span className="text-xs uppercase tracking-[0.14em] text-cv-fg-subtle">{isOwner ? '角色主页' : '我和它的对话'}</span>
      </div>

      <PosterCard tone="ink" image={c.avatar_url ?? undefined} className="mb-6 min-h-56 p-6 sm:p-8">
        <div className="flex items-start gap-4">
          <Avatar className="size-16 rounded-cv-md ring-2 ring-white/30">
            <AvatarImage src={c.avatar_url ?? undefined} alt={card.name} />
            <AvatarFallback className="rounded-cv-md bg-cv-secondary text-lg font-semibold text-cv-secondary-fg">{card.name.slice(0, 1)}</AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <PosterTitle className="text-3xl">{card.name}</PosterTitle>
            {card.introduction && <p className="mt-2 max-w-xl text-sm opacity-85">{card.introduction}</p>}
            <div className="mt-3 flex flex-wrap gap-2">
              {isOwner
                ? (c.is_public ? <Chip tone="success"><Globe className="size-3" />已发布</Chip> : <Chip tone="outline" className="border-white/25 text-white/85">私人</Chip>)
                : <Chip tone="outline" className="border-white/25 text-white/85" interactive onClick={() => router.push(`/user/${c.user_id}`)} title="看作者主页"><UserRound className="size-3" />别人的角色</Chip>}
              <Chip tone="outline" className="border-white/25 text-white/85">{sessions.length} 个对话</Chip>
              {stats && (stats.session_count > 0 || stats.turn_count > 0) && (
                <>
                  <Chip tone="outline" className="border-white/25 text-white/85" title="聊过这个角色的对话数（公开聚合）"><MessagesSquare className="size-3" />{formatCount(stats.session_count)} 人聊过</Chip>
                  <Chip tone="outline" className="border-white/25 text-white/85" title="用户发言轮数（公开聚合）"><Repeat className="size-3" />{formatCount(stats.turn_count)} 轮</Chip>
                </>
              )}
            </div>
          </div>
        </div>
        <div className="mt-6 flex flex-wrap gap-2">
          {latest && <Button variant="accent" onClick={() => router.push(`/chat/${latest.id}`)} disabled={start.isPending}><Play /> 继续最近对话</Button>}
          <Button variant={latest ? 'glass' : 'accent'} className={latest ? 'text-white' : ''} onClick={() => open(true)} disabled={start.isPending}>
            {start.isPending ? <Loader2 className="animate-spin" /> : <MessageSquarePlus />} 开新对话
          </Button>
          {isOwner ? (
            <>
              <Button variant="glass" className="text-white" asChild><Link href={`/characters/${c.id}/edit`}><Pencil /> 编辑</Link></Button>
              <Button variant="glass" className="text-white" asChild><Link href={`/characters/${c.id}/skin`}><Palette /> 皮肤</Link></Button>
            </>
          ) : (
            <Button variant="glass" className="text-white" asChild><Link href={`/character/public/${c.id}`}><ExternalLink /> 公开页 · 评论</Link></Button>
          )}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <IconButton label="更多操作" variant="glass" className="text-white" disabled={chatImport.isPending}>
                {chatImport.isPending ? <Loader2 className="animate-spin" /> : <MoreHorizontal />}
              </IconButton>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="min-w-44">
              {isOwner && (
                <>
                  <DropdownMenuItem onClick={exportJson}><FileJson />导出 JSON</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => void exportPng()}><ImageDown />导出 PNG 卡</DropdownMenuItem>
                  <DropdownMenuSeparator />
                </>
              )}
              <DropdownMenuItem onClick={() => chatFileRef.current?.click()}><Upload />导入对话记录</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <input
            ref={chatFileRef}
            type="file"
            accept=".json,.jsonl,.txt,application/json"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) void importChatFile(f)
              e.target.value = ''
            }}
          />
        </div>
      </PosterCard>

      <GlassPanel className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h2 className="font-display text-lg font-semibold">和它聊天用的人设</h2>
          <p className="mt-0.5 text-xs text-cv-fg-muted">绑定后，这个角色的新对话默认用它；每个对话还能在会话设置里单独换。</p>
        </div>
        <PersonaPicker
          id="cv_character_persona"
          userId={user.id}
          value={bindingsQ.data?.get(c.id)}
          onChange={(v) => bindPersona.mutate({ characterId: c.id, personaId: v ?? null }, { onError: (e) => toast.error(e instanceof Error ? e.message : '保存失败') })}
          inheritLabel="跟随默认人设"
          disabled={bindPersona.isPending}
          className="w-full sm:w-72"
        />
      </GlassPanel>

      <GlassPanel>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-display text-xl font-semibold">对话</h2>
          <span className="text-xs text-cv-fg-subtle">分支会缩进显示在它的来源对话下面</span>
        </div>
        {sessionsQ.isLoading ? <CardSkeleton variant="row" /> : (
          <SessionList sessions={sessions} userId={user.id} emptyText="还没有和这个角色聊过。点上面的「开新对话」开始。" />
        )}
      </GlassPanel>
    </div>
  )
}
