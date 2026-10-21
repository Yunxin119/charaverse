'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { Plus, Search, MessageCircle, Pencil, Palette, MoreHorizontal, Trash2, Globe, Lock, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Chip, IconButton, PosterCard, PosterTitle, CardSkeleton } from '@/components/glass'
import { CharacterCard, characterToCardData } from '@/components/cards/CharacterCard'
import { useAuth } from '@/providers/AuthProvider'
import type { Character } from '@/app/lib/supabase'
import { useCharacters, useDeleteCharacter } from '@/queries'
import { cn } from '@/lib/utils'

type Visibility = 'all' | 'public' | 'private'
type SortKey = 'updated_at' | 'created_at' | 'name'

const VISIBILITY: { id: Visibility; label: string }[] = [
  { id: 'all', label: '全部' },
  { id: 'public', label: '公开' },
  { id: 'private', label: '私人' },
]

const listVariants = { hidden: {}, visible: { transition: { staggerChildren: 0.03 } } }
const itemVariants = { hidden: { opacity: 0, y: 8 }, visible: { opacity: 1, y: 0, transition: { duration: 0.24, ease: [0.2, 0.8, 0.2, 1] as const } } }

export default function CharactersPage() {
  const { user } = useAuth()
  const router = useRouter()
  const characters = useCharacters(user?.id)
  const del = useDeleteCharacter(user?.id)

  const [query, setQuery] = useState('')
  const [visibility, setVisibility] = useState<Visibility>('all')
  const [sortBy, setSortBy] = useState<SortKey>('updated_at')

  const list = useMemo(() => {
    const q = query.trim().toLowerCase()
    const rows = (characters.data ?? []).filter((c) => {
      if (visibility === 'public' && !c.is_public) return false
      if (visibility === 'private' && c.is_public) return false
      if (!q) return true
      const basic = c.prompt_template?.basic_info ?? {}
      return c.name.toLowerCase().includes(q) || String(basic.introduction ?? basic.description ?? '').toLowerCase().includes(q)
    })
    return [...rows].sort((a, b) => {
      if (sortBy === 'name') return a.name.localeCompare(b.name, 'zh-CN')
      const ka = (a as Character & { updated_at?: string })[sortBy] ?? a.created_at
      const kb = (b as Character & { updated_at?: string })[sortBy] ?? b.created_at
      return String(kb).localeCompare(String(ka))
    })
  }, [characters.data, query, visibility, sortBy])

  const remove = async (c: Character) => {
    if (!confirm(`删除角色「${c.name}」？相关对话也会一并删除，此操作无法撤销。`)) return
    try {
      await del.mutateAsync(c.id)
    } catch {
      alert('删除失败，请重试')
    }
  }

  const total = characters.data?.length ?? 0
  const filtered = total > 0 && list.length === 0

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-semibold">我的角色</h1>
          <p className="mt-1 text-sm text-cv-fg-muted">{total > 0 ? `${total} 个角色 · 点卡片上的「聊天」继续最近的对话` : '创建你的第一个角色，开始属于它的宇宙。'}</p>
        </div>
        <Button asChild variant="accent">
          <Link href="/characters/new"><Plus />新建角色</Link>
        </Button>
      </header>

      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute inset-y-0 left-4 my-auto size-4 text-cv-fg-subtle" />
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="搜索名称或介绍…" className="pl-11" aria-label="搜索角色" />
        </div>
        <div className="flex items-center gap-2">
          <div className="neu-in inline-flex rounded-full p-1" role="tablist" aria-label="可见性">
            {VISIBILITY.map((v) => (
              <button
                key={v.id}
                type="button"
                role="tab"
                aria-selected={visibility === v.id}
                onClick={() => setVisibility(v.id)}
                className={cn('rounded-full px-3.5 py-1.5 text-xs font-semibold transition-colors', visibility === v.id ? 'bg-cv-bg-elevated text-cv-fg shadow-neu-sm' : 'text-cv-fg-muted hover:text-cv-fg')}
              >
                {v.label}
              </button>
            ))}
          </div>
          <Select value={sortBy} onValueChange={(v) => setSortBy(v as SortKey)}>
            <SelectTrigger className="w-28" aria-label="排序"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="updated_at">最近更新</SelectItem>
              <SelectItem value="created_at">创建时间</SelectItem>
              <SelectItem value="name">名称</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {characters.isLoading && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => <CardSkeleton key={i} />)}
        </div>
      )}

      {characters.isError && (
        <PosterCard tone="ink" className="text-center">
          <PosterTitle>加载失败</PosterTitle>
          <p className="mt-2 text-sm opacity-80">网络或权限问题，稍后再试。</p>
          <Button variant="glass" size="sm" className="mt-4" onClick={() => characters.refetch()}>重试</Button>
        </PosterCard>
      )}

      {characters.isSuccess && total === 0 && (
        <PosterCard tone="ink" className="flex min-h-64 flex-col items-start justify-between p-6 sm:p-8">
          <span className="flex size-10 items-center justify-center rounded-cv-sm bg-cv-accent text-white shadow-[0_10px_24px_-10px_var(--cv-accent)]"><Sparkles className="size-5" /></span>
          <div className="mt-8">
            <PosterTitle className="text-3xl sm:text-4xl">还没有角色。</PosterTitle>
            <p className="mt-2 max-w-sm text-sm opacity-80">写一段人设、挑一张封面，几分钟就能开始第一段对话。也可以去「探索」把别人的角色复制过来改。</p>
            <div className="mt-5 flex flex-wrap gap-2">
              <Button asChild variant="accent"><Link href="/characters/new"><Plus />新建角色</Link></Button>
              <Button asChild variant="glass"><Link href="/explore">去探索</Link></Button>
            </div>
          </div>
        </PosterCard>
      )}

      {characters.isSuccess && filtered && (
        <div className="glass rounded-cv-lg p-8 text-center text-sm text-cv-fg-muted">没有匹配的角色，换个关键词试试。</div>
      )}

      {characters.isSuccess && list.length > 0 && (
        <motion.div variants={listVariants} initial="hidden" animate="visible" className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {list.map((c) => (
            <motion.div key={c.id} variants={itemVariants} layout>
              <CharacterCard
                data={characterToCardData(c)}
                variant="poster"
                className="h-full"
                chips={c.is_public ? <Chip tone="success" className="bg-cv-success text-white"><Globe className="size-3" />已发布</Chip> : <Chip tone="outline" className="border-white/25 bg-white/15 text-white"><Lock className="size-3" />私人</Chip>}
                menu={
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <IconButton label="更多操作" variant="glass" size="sm" className="text-white"><MoreHorizontal /></IconButton>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="min-w-40">
                      <DropdownMenuItem asChild><Link href={`/characters/${c.id}/edit`}><Pencil />编辑</Link></DropdownMenuItem>
                      <DropdownMenuItem asChild><Link href={`/characters/${c.id}/skin`}><Palette />皮肤</Link></DropdownMenuItem>
                      <DropdownMenuItem asChild><Link href={`/characters/${c.id}/edit?section=publish`}>{c.is_public ? <><Globe />发布设置</> : <><Globe />发布到探索</>}</Link></DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem variant="destructive" onClick={() => void remove(c)}><Trash2 />删除角色</DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                }
                footer={
                  <>
                    <Button size="sm" variant="accent" onClick={() => router.push(`/chat/new?characterId=${c.id}`)}><MessageCircle />聊天</Button>
                    <Button asChild size="sm" variant="glass" className="text-white"><Link href={`/characters/${c.id}/edit`}><Pencil />编辑</Link></Button>
                    <Button asChild size="sm" variant="glass" className="text-white"><Link href={`/characters/${c.id}/skin`}><Palette />皮肤</Link></Button>
                  </>
                }
              />
            </motion.div>
          ))}
        </motion.div>
      )}
    </div>
  )
}
