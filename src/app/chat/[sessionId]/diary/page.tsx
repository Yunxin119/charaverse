'use client'

import { useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { ArrowLeft, Feather, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { CardSkeleton, IconButton, PosterCard, PosterTitle } from '@/components/glass'
import { DiaryCard, DiaryEmptyState, InlineNotice } from '@/components/diary'
import { useCharacter, useSession, useDiaries, useGenerateDiary, useRegenerateDiary, useUpdateDiary, useDeleteDiary } from '@/queries'
import { useConnection } from '@/lib/llm/useConnection'
import { parseSessionSettings } from '@/lib/chat/settings'

const listVariants = { hidden: {}, visible: { transition: { staggerChildren: 0.03 } } }
const itemVariants = { hidden: { opacity: 0, y: 8 }, visible: { opacity: 1, y: 0, transition: { duration: 0.24, ease: [0.2, 0.8, 0.2, 1] as const } } }

export default function DiaryPage() {
  const router = useRouter()
  const sessionId = useParams().sessionId as string

  const session = useSession(sessionId)
  const character = useCharacter(session.data?.character_id)
  const diaries = useDiaries(sessionId)
  const conn = useConnection()

  const generate = useGenerateDiary(sessionId)
  const regenerate = useRegenerateDiary(sessionId)
  const update = useUpdateDiary(sessionId)
  const remove = useDeleteDiary(sessionId)

  const [notice, setNotice] = useState<string | null>(null)

  const characterName = character.data?.name ?? '角色'
  const model = parseSessionSettings(session.data?.settings).model ?? conn.defaultModel
  const connectionHeaders = () => {
    const h = conn.headersFor(model)
    if (!h) setNotice('还没有可用的模型连接，请先在「设置 → API 连接」里添加。')
    return h
  }
  const fail = (e: unknown, fallback: string) => setNotice(e instanceof Error ? e.message : fallback)

  const busy = generate.isPending || regenerate.isPending
  const onGenerate = () => {
    const h = connectionHeaders()
    if (!h || busy) return
    setNotice(null)
    generate.mutate(h, { onError: (e) => fail(e, '生成失败') })
  }
  const onRegenerate = (id: number) => {
    const h = connectionHeaders()
    if (!h || busy) return
    setNotice(null)
    regenerate.mutate({ id, headers: h }, { onError: (e) => fail(e, '重新生成失败') })
  }

  const list = diaries.data ?? []
  const back = () => router.push(`/chat/${sessionId}`)

  return (
    <div className="mx-auto max-w-4xl px-4 py-6 sm:px-6">
      <header className="mb-6 flex flex-wrap items-center gap-3">
        <IconButton label="返回对话" variant="glass" onClick={back}><ArrowLeft /></IconButton>
        <Avatar className="size-10 rounded-cv-sm">
          <AvatarImage src={character.data?.avatar_url ?? undefined} alt={characterName} />
          <AvatarFallback className="rounded-cv-sm bg-cv-secondary text-xs font-semibold text-cv-secondary-fg">{characterName.slice(0, 1)}</AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <h1 className="truncate font-display text-2xl font-semibold leading-tight sm:text-3xl">{characterName} 的日记本</h1>
          <p className="mt-0.5 text-xs text-cv-fg-muted sm:text-sm">
            {list.length > 0 ? `${list.length} 篇日记，最新的在前` : '以角色的第一人称记录这段对话'}
          </p>
        </div>
        {list.length > 0 && (
          <Button variant="accent" onClick={onGenerate} disabled={busy || !session.data} className="w-full sm:w-auto">
            {generate.isPending ? <Loader2 className="animate-spin" /> : <Feather />}
            {generate.isPending ? '正在写…' : '写一篇新日记'}
          </Button>
        )}
      </header>

      {notice && <InlineNotice className="mb-4" onClose={() => setNotice(null)}>{notice}</InlineNotice>}

      {(session.isLoading || diaries.isLoading) && (
        <div className="space-y-4">
          {Array.from({ length: 2 }).map((_, i) => <CardSkeleton key={i} />)}
        </div>
      )}

      {(session.isError || diaries.isError) && (
        <PosterCard tone="ink" className="text-center">
          <PosterTitle>加载失败</PosterTitle>
          <p className="mt-2 text-sm opacity-80">{session.isError ? '会话不存在或没有权限。' : '日记列表加载失败，稍后再试。'}</p>
          <div className="mt-4 flex justify-center gap-2">
            <Button variant="glass" size="sm" onClick={back}>返回对话</Button>
            {diaries.isError && <Button variant="glass" size="sm" onClick={() => diaries.refetch()}>重试</Button>}
          </div>
        </PosterCard>
      )}

      {session.data && diaries.data && list.length === 0 && (
        <DiaryEmptyState characterName={characterName} generating={generate.isPending} disabled={busy} onGenerate={onGenerate} />
      )}

      {list.length > 0 && (
        <motion.ul variants={listVariants} initial="hidden" animate="visible" className="space-y-4">
          {list.map((d) => (
            <motion.li key={d.id} variants={itemVariants}>
              <DiaryCard
                diary={d}
                characterName={characterName}
                busy={busy}
                regenerating={regenerate.isPending && regenerate.variables?.id === d.id}
                deleting={remove.isPending && remove.variables === d.id}
                saving={update.isPending && update.variables?.id === d.id}
                onSave={(content) => update.mutateAsync({ id: d.id, content }).then(() => true, (e) => { fail(e, '保存失败'); return false })}
                onRegenerate={() => onRegenerate(d.id)}
                onDelete={() => remove.mutate(d.id, { onError: (e) => fail(e, '删除失败') })}
              />
            </motion.li>
          ))}
        </motion.ul>
      )}
    </div>
  )
}
