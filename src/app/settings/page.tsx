'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Plug, Palette, SlidersHorizontal, Users, LogOut, Loader2, Check, ChevronRight, BookOpen, Wand2, MessagesSquare, Repeat, Keyboard, Inbox, Heart, Brain, Bookmark } from 'lucide-react'
import { useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/providers/AuthProvider'
import { supabase } from '@/app/lib/supabase'
import { uploadUserAvatar } from '@/app/lib/avatarUpload'
import { useProfile, useCharacters, useMyStats, qk } from '@/queries'
import { StatTiles } from '@/components/stats/StatTiles'
import { useConnectionsStore } from '@/stores/connections'
import { AvatarUpload } from '@/app/components/AvatarUpload'
import { UserBanner } from '@/app/components/UserBanner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { GlassPanel, Chip } from '@/components/glass'

interface ProfileRow { username?: string | null; avatar_url?: string | null; banner_url?: string | null; bio?: string | null }

export default function SettingsHubPage() {
  const router = useRouter()
  const qc = useQueryClient()
  const { user, signOut } = useAuth()
  const profileQ = useProfile(user?.id)
  const charactersQ = useCharacters(user?.id)
  const connections = useConnectionsStore((s) => s.connections)
  const statsQ = useMyStats(user?.id)

  const [profile, setProfile] = useState<ProfileRow>({})
  const [draft, setDraft] = useState({ username: '', bio: '' })
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!user) return
    supabase.from('profiles').select('username, avatar_url, banner_url, bio').eq('id', user.id).maybeSingle().then(({ data }) => {
      const p = (data ?? {}) as ProfileRow
      setProfile(p)
      setDraft({ username: p.username ?? '', bio: p.bio ?? '' })
    })
  }, [user])

  const dirty = draft.username !== (profile.username ?? '') || draft.bio !== (profile.bio ?? '')

  const saveProfile = async () => {
    if (!user) return
    setSaving(true); setError(null)
    try {
      const username = draft.username.trim()
      if (!username) throw new Error('用户名不能为空')
      const { error } = await supabase.from('profiles').update({ username, bio: draft.bio.trim() || null, updated_at: new Date().toISOString() }).eq('id', user.id)
      if (error) throw error
      setProfile((p) => ({ ...p, username, bio: draft.bio.trim() || null }))
      qc.invalidateQueries({ queryKey: qk.profile(user.id) })
      setSaved(true); setTimeout(() => setSaved(false), 1500)
    } catch (e) {
      setError((e as Error).message || '保存失败')
    } finally { setSaving(false) }
  }

  const onAvatar = async (file: File) => {
    const url = await uploadUserAvatar(file)
    if (user) {
      await supabase.from('profiles').update({ avatar_url: url }).eq('id', user.id)
      setProfile((p) => ({ ...p, avatar_url: url }))
      qc.invalidateQueries({ queryKey: qk.profile(user.id) })
    }
    return url
  }

  const displayName = profile.username || profileQ.data?.username || user?.email?.split('@')[0] || '用户'
  const links = [
    { href: '/settings/connections', icon: Plug, title: 'API 连接', desc: `${connections.length} 个连接 · Key 只存在本机` },
    { href: '/settings/presets', icon: SlidersHorizontal, title: '预设', desc: 'Prompt 预设：导入 / 排序 / 采样' },
    { href: '/settings/lorebooks', icon: BookOpen, title: '世界书库', desc: '关键词触发的背景设定，启用后应用到所有对话' },
    { href: '/settings/appearance', icon: Palette, title: '主题与外观', desc: '明暗模式、内置主题、导入主题 JSON' },
    { href: '/settings/tasks', icon: Wand2, title: '任务提示词', desc: '摘要 + 记忆提取用的 prompt，可改可恢复默认' },
    { href: '/characters', icon: Users, title: '我的角色', desc: `${charactersQ.data?.length ?? '…'} 个角色` },
    { href: '/explore/favorites', icon: Bookmark, title: '我的收藏', desc: '收藏过的公开角色，只有你自己能看到' },
  ]

  const st = statsQ.data
  const sv = (v: number | undefined) => (statsQ.isSuccess ? v ?? 0 : statsQ.isError ? 0 : undefined)
  const myTiles = [
    { label: '对话数', icon: MessagesSquare, value: sv(st?.sessions) },
    { label: '发言轮数', icon: Repeat, value: sv(st?.turns) },
    { label: '我打的字', icon: Keyboard, value: sv(st?.chars_typed) },
    { label: '收到的字', icon: Inbox, value: sv(st?.chars_received) },
    { label: '角色数', icon: Users, value: sv(st?.characters), hint: statsQ.isSuccess ? `${st?.published ?? 0} 个已发布` : undefined },
    { label: '获赞', icon: Heart, value: sv(st?.likes_received) },
    { label: '记忆条目', icon: Brain, value: sv(st?.memories) },
  ]

  if (!user) return <div className="flex h-dvh items-center justify-center text-cv-fg-muted"><Loader2 className="mr-2 size-5 animate-spin" />加载…</div>

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6">
      <div className="overflow-hidden rounded-cv-lg">
        <UserBanner
          username={displayName}
          avatar={profile.avatar_url ?? undefined}
          banner={profile.banner_url ?? undefined}
          bio={profile.bio ?? undefined}
          charactersCount={charactersQ.data?.length}
          canEdit
          onBannerUpdate={(url) => setProfile((p) => ({ ...p, banner_url: url }))}
        />
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-[1fr_1.2fr]">
        <div className="flex flex-col gap-4">
        <GlassPanel>
          <h2 className="mb-4 font-display text-xl font-semibold">个人资料</h2>
          <div className="flex items-start gap-4">
            <AvatarUpload currentAvatar={profile.avatar_url ?? undefined} fallbackText={displayName.charAt(0).toUpperCase()} onUpload={onAvatar} size="md" />
            <div className="min-w-0 flex-1 space-y-3">
              <div className="space-y-1.5"><Label htmlFor="username">用户名</Label><Input id="username" value={draft.username} onChange={(e) => setDraft({ ...draft, username: e.target.value })} /></div>
              <div className="space-y-1.5"><Label htmlFor="bio">简介</Label><Textarea id="bio" value={draft.bio} onChange={(e) => setDraft({ ...draft, bio: e.target.value })} className="min-h-20" placeholder="一句话介绍自己（会显示在你的作者主页）" /></div>
              <div className="flex items-center gap-3">
                <Button size="sm" disabled={!dirty || saving} onClick={saveProfile}>{saving ? <Loader2 className="animate-spin" /> : saved ? <Check /> : null}{saved ? '已保存' : '保存'}</Button>
                {error && <span className="text-xs text-cv-danger">{error}</span>}
              </div>
            </div>
          </div>
          <div className="mt-6 flex flex-wrap items-center justify-between gap-2 border-t border-cv-border pt-4 text-sm">
            <div className="min-w-0">
              <div className="text-xs text-cv-fg-subtle">登录邮箱</div>
              <div className="truncate">{user.email}</div>
            </div>
            <Button variant="ghost" size="sm" className="text-cv-danger hover:bg-cv-danger/10" onClick={async () => { if (confirm('退出登录？')) { await signOut(); router.replace('/login') } }}><LogOut /> 退出登录</Button>
          </div>
        </GlassPanel>

        <GlassPanel>
          <div className="mb-4 flex items-baseline justify-between gap-3">
            <h2 className="font-display text-xl font-semibold">我的数据</h2>
            <span className="text-xs text-cv-fg-subtle">只有你自己能看到</span>
          </div>
          <StatTiles compact items={myTiles} className="grid-cols-2 sm:grid-cols-3 lg:grid-cols-2 xl:grid-cols-3" />
          {statsQ.isError && <p className="mt-3 text-xs text-cv-danger">统计加载失败：{(statsQ.error as Error).message}</p>}
        </GlassPanel>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
          {links.map((l) => {
            const Icon = l.icon
            return (
              <Link key={l.href} href={l.href} className="glass flex items-center gap-4 rounded-cv-lg p-4 transition-shadow hover:shadow-glass">
                <span className="flex size-11 shrink-0 items-center justify-center rounded-cv-md bg-cv-primary text-cv-primary-fg shadow-[0_10px_24px_-10px_var(--cv-primary)]"><Icon className="size-5" /></span>
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold">{l.title}</span>
                  <span className="block truncate text-xs text-cv-fg-muted">{l.desc}</span>
                </span>
                <ChevronRight className="size-4 text-cv-fg-subtle" />
              </Link>
            )
          })}
          <GlassPanel padding="sm" className="text-xs text-cv-fg-muted">
            <Chip tone="info" className="mb-2">提示</Chip>
            <p>API Key 不会上传到服务器数据库。换设备或清理浏览器数据后需要重新添加连接。</p>
          </GlassPanel>
        </div>
      </div>
    </div>
  )
}
