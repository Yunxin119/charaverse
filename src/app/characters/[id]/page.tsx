'use client'

import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { Loader2, MessageSquarePlus, Play, Pencil, Palette, Globe, ArrowLeft } from 'lucide-react'
import { useAuth } from '@/providers/AuthProvider'
import { useCharacter, useCharacterSessions } from '@/queries'
import { useStartSession } from '@/queries/useChatMutations'
import { parseCharacterCard } from '@/lib/chat/characterCard'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Chip, GlassPanel, IconButton, PosterCard, PosterTitle, CardSkeleton } from '@/components/glass'
import { SessionList } from '@/components/sessions/SessionList'

/** Character hub: the character and every conversation with it, in one place. */
export default function CharacterHubPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const { user } = useAuth()
  const characterQ = useCharacter(id)
  const sessionsQ = useCharacterSessions(user?.id, characterQ.data?.id)
  const start = useStartSession()

  if (characterQ.isLoading || !user) return <div className="flex h-dvh items-center justify-center text-cv-fg-muted"><Loader2 className="mr-2 size-5 animate-spin" />加载角色…</div>
  const c = characterQ.data
  if (!c) return <div className="p-6 text-cv-fg-muted">找不到这个角色</div>
  if (c.user_id !== user.id) { router.replace(`/character/public/${c.id}`); return null }

  const card = parseCharacterCard(c)
  const sessions = sessionsQ.data ?? []
  const latest = sessions[0]
  const open = (forceNew: boolean) =>
    start.mutate({ userId: user.id, characterId: c.id, forceNew }, { onSuccess: ({ sessionId, needsOpening }) => router.push(`/chat/${sessionId}${needsOpening ? '?opening=1' : ''}`) })

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6">
      <div className="mb-4 flex items-center gap-2">
        <IconButton label="返回角色列表" variant="ghost" onClick={() => router.push('/characters')}><ArrowLeft /></IconButton>
        <span className="text-xs uppercase tracking-[0.14em] text-cv-fg-subtle">角色主页</span>
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
              {c.is_public ? <Chip tone="success"><Globe className="size-3" />已发布</Chip> : <Chip tone="outline" className="border-white/25 text-white/85">私人</Chip>}
              <Chip tone="outline" className="border-white/25 text-white/85">{sessions.length} 个对话</Chip>
            </div>
          </div>
        </div>
        <div className="mt-6 flex flex-wrap gap-2">
          {latest && <Button variant="accent" onClick={() => router.push(`/chat/${latest.id}`)} disabled={start.isPending}><Play /> 继续最近对话</Button>}
          <Button variant={latest ? 'glass' : 'accent'} className={latest ? 'text-white' : ''} onClick={() => open(true)} disabled={start.isPending}>
            {start.isPending ? <Loader2 className="animate-spin" /> : <MessageSquarePlus />} 开新对话
          </Button>
          <Button variant="glass" className="text-white" asChild><Link href={`/characters/${c.id}/edit`}><Pencil /> 编辑</Link></Button>
          <Button variant="glass" className="text-white" asChild><Link href={`/characters/${c.id}/skin`}><Palette /> 皮肤</Link></Button>
        </div>
      </PosterCard>

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
