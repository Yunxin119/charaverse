'use client'

import { useParams, useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { ArrowLeft, Heart, Users, CalendarDays, UserRound } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { PosterCard, PosterTitle, Chip, IconButton, Skeleton, CardSkeleton } from '@/components/glass'
import { CharacterCard, characterToCardData } from '@/components/cards/CharacterCard'
import { useUserProfile, useUserPublicCharacters } from '@/queries'

const listVariants = { hidden: {}, visible: { transition: { staggerChildren: 0.03 } } }
const itemVariants = { hidden: { opacity: 0, y: 8 }, visible: { opacity: 1, y: 0, transition: { duration: 0.24, ease: [0.2, 0.8, 0.2, 1] as const } } }

function joinedLabel(iso: string | null | undefined) {
  if (!iso) return null
  return new Date(iso).toLocaleDateString('zh-CN', { year: 'numeric', month: 'short' })
}

export default function UserPublicPage() {
  const params = useParams<{ id: string }>()
  const id = typeof params?.id === 'string' ? params.id : undefined
  const router = useRouter()
  const profile = useUserProfile(id)
  const characters = useUserPublicCharacters(id)

  const list = characters.data ?? []
  const likes = list.reduce((sum, c) => sum + (c.likes_count ?? 0), 0)
  const username = profile.data?.username?.trim() || '未设置用户名'

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6">
      <div className="mb-4">
        <Button variant="ghost" size="sm" onClick={() => router.back()} className="-ml-2 text-cv-fg-muted"><ArrowLeft />返回</Button>
      </div>

      {profile.isLoading && (
        <div className="glass mb-8 flex flex-col gap-4 rounded-cv-lg p-6 sm:flex-row sm:items-center">
          <Skeleton className="size-20 rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-7 w-40" />
            <Skeleton className="h-4 w-64" />
          </div>
        </div>
      )}

      {profile.isSuccess && !profile.data && (
        <PosterCard tone="ink" className="flex min-h-56 flex-col items-start justify-between p-6 sm:p-8">
          <UserRound className="size-8 opacity-70" />
          <div className="mt-6">
            <PosterTitle className="text-3xl">用户不存在</PosterTitle>
            <p className="mt-2 text-sm opacity-80">这个作者页可能已经被删除，或者链接不对。</p>
            <Button variant="glass" className="mt-5" onClick={() => router.push('/explore')}>去探索</Button>
          </div>
        </PosterCard>
      )}

      {profile.isError && (
        <PosterCard tone="ink" className="text-center">
          <PosterTitle>加载失败</PosterTitle>
          <Button variant="glass" size="sm" className="mt-4" onClick={() => profile.refetch()}>重试</Button>
        </PosterCard>
      )}

      {profile.data && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.24, ease: [0.2, 0.8, 0.2, 1] }}>
          <PosterCard tone="ink" image={profile.data.banner_url ?? undefined} className="mb-8 min-h-56 p-6 sm:p-8">
            <div className="flex min-h-[calc(14rem-3rem)] flex-col justify-end">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
                <Avatar className="size-20 rounded-cv-md border-2 border-white/40 shadow-glass sm:size-24">
                  <AvatarImage src={profile.data.avatar_url ?? undefined} alt="" className="object-cover" />
                  <AvatarFallback className="rounded-cv-md bg-cv-accent font-display text-3xl font-semibold text-white">{username.slice(0, 1)}</AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <PosterTitle className="text-3xl sm:text-4xl">{username}</PosterTitle>
                  {profile.data.bio && <p className="mt-1.5 line-clamp-2 max-w-xl text-sm opacity-85">{profile.data.bio}</p>}
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Chip tone="outline" className="border-white/25 bg-white/15 text-white"><Users className="size-3" />{list.length} 个公开角色</Chip>
                    <Chip tone="outline" className="border-white/25 bg-white/15 text-white"><Heart className="size-3" />{likes} 点赞</Chip>
                    {joinedLabel(profile.data.created_at) && (
                      <Chip tone="outline" className="border-white/25 bg-white/15 text-white"><CalendarDays className="size-3" />{joinedLabel(profile.data.created_at)} 加入</Chip>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </PosterCard>

          <section>
            <h2 className="mb-3 text-xs font-semibold uppercase tracking-[0.14em] text-cv-fg-subtle">公开角色</h2>

            {characters.isLoading && (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {Array.from({ length: 3 }).map((_, i) => <CardSkeleton key={i} />)}
              </div>
            )}

            {characters.isError && (
              <div className="glass flex items-center justify-between gap-3 rounded-cv-lg p-5 text-sm text-cv-fg-muted">
                角色列表加载失败。
                <IconButton label="重试" variant="neu" size="sm" onClick={() => characters.refetch()}><ArrowLeft className="rotate-180" /></IconButton>
              </div>
            )}

            {characters.isSuccess && list.length === 0 && (
              <div className="glass rounded-cv-lg p-8 text-center text-sm text-cv-fg-muted">这位作者还没有公开任何角色。</div>
            )}

            {characters.isSuccess && list.length > 0 && (
              <motion.div variants={listVariants} initial="hidden" animate="visible" className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {list.map((c) => (
                  <motion.div key={c.id} variants={itemVariants}>
                    <CharacterCard data={characterToCardData(c, { preferSnapshot: true })} variant="poster" href={`/character/public/${c.id}`} showLikes className="h-full" />
                  </motion.div>
                ))}
              </motion.div>
            )}
          </section>
        </motion.div>
      )}
    </div>
  )
}
