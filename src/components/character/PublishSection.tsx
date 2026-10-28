'use client'

import { useMemo, useState, type ReactNode } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { formatDistanceToNow } from 'date-fns'
import { zhCN } from 'date-fns/locale'
import { Globe, GlobeLock, Loader2, Upload, AlertTriangle } from 'lucide-react'
import { supabase, type Character } from '@/app/lib/supabase'
import { qk } from '@/queries/keys'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Textarea } from '@/components/ui/textarea'
import { GlassPanel, Chip, StatusDot } from '@/components/glass'
import { buildSnapshot, describeTemplate, parseSnapshot, snapshotsEqual, type Snapshot } from './snapshot'

export { buildSnapshot, snapshotSchema, parseSnapshot, describeTemplate, type Snapshot } from './snapshot'

export interface PublishDraft {
  name: string
  avatar_url?: string | null
  prompt_template: unknown
}

type PublishableCharacter = Character & {
  published_snapshot?: unknown
  published_at?: string | null
}

/**
 * 「发布」 panel for the character form (plan §3 A12).
 * Publishing freezes `draft ?? row` into `published_snapshot`; the live row stays private.
 */
export function PublishSection({ character, draft }: { character: Character; draft?: PublishDraft }) {
  const row = character as PublishableCharacter
  const qc = useQueryClient()
  const [open, setOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [note, setNote] = useState('')

  const published = useMemo(() => parseSnapshot(row.published_snapshot), [row.published_snapshot])
  const next = useMemo<Snapshot>(
    () =>
      buildSnapshot({
        name: draft?.name ?? row.name,
        avatar_url: draft ? draft.avatar_url : row.avatar_url,
        prompt_template: draft?.prompt_template ?? row.prompt_template,
        skin: row.skin,
        lorebook: row.lorebook,
      }),
    [draft, row.name, row.avatar_url, row.prompt_template, row.skin, row.lorebook]
  )
  const dirty = row.is_public && !!published && !snapshotsEqual(published, next)

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: qk.character(row.id) })
    qc.invalidateQueries({ queryKey: qk.characters(row.user_id) })
    qc.invalidateQueries({ queryKey: ['characters', 'public'] })
  }

  const publish = useMutation({
    mutationFn: async (snapshot: Snapshot) => {
      const { error } = await supabase
        .from('characters')
        .update({ is_public: true, published_snapshot: snapshot, published_at: new Date().toISOString(), release_note: note.trim() || null })
        .eq('id', row.id)
      if (error) throw error
    },
    onSuccess: () => {
      setOpen(false)
      setError(null)
      setNote('')
      invalidate()
    },
    onError: (e: Error) => setError(e.message || '发布失败，请重试'),
  })

  const unpublish = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('characters').update({ is_public: false }).eq('id', row.id)
      if (error) throw error
    },
    onSuccess: () => {
      setError(null)
      invalidate()
    },
    onError: (e: Error) => setError(e.message || '取消发布失败，请重试'),
  })

  const busy = publish.isPending || unpublish.isPending
  const publishedAgo = row.published_at ? formatDistanceToNow(new Date(row.published_at), { addSuffix: true, locale: zhCN }) : null

  let status: { tone: 'neutral' | 'success' | 'warning'; text: string }
  if (!row.is_public) status = { tone: 'neutral', text: published ? '未发布（保留了上次的发布内容）' : '未发布' }
  else if (dirty) status = { tone: 'warning', text: '已发布 · 草稿有未发布的修改' }
  else status = { tone: 'success', text: publishedAgo ? `已发布于 ${publishedAgo}` : '已发布' }

  return (
    <GlassPanel className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="flex min-w-0 items-center gap-2 text-sm font-semibold text-cv-fg">
          <StatusDot tone={status.tone} pulse={status.tone === 'warning'} />
          {status.text}
        </p>
        <div className="flex flex-wrap gap-2">
          {row.is_public && (
            <Button variant="outline" size="sm" disabled={busy} onClick={() => unpublish.mutate()}>
              {unpublish.isPending ? <Loader2 className="animate-spin" /> : <GlobeLock />}取消发布
            </Button>
          )}
          <Button variant={row.is_public && !dirty ? 'neu' : 'accent'} size="sm" disabled={busy} onClick={() => setOpen(true)}>
            <Upload />{row.is_public ? '更新发布' : '发布'}
          </Button>
        </div>
      </div>
      <p className="text-xs leading-relaxed text-cv-fg-muted">
        发布会把当前名字、头像、设定、世界书和皮肤<b>拍一张快照</b>放到探索页；之后你继续改草稿不影响公开内容，改好了再点「更新发布」。
      </p>
      {error && <p className="text-xs text-cv-danger">{error}</p>}

      <PublishDialog open={open} onOpenChange={setOpen} snapshot={next} first={!row.is_public} pending={publish.isPending} note={note} onNoteChange={setNote} onConfirm={() => publish.mutate(next)} />
    </GlassPanel>
  )
}

function PublishDialog({
  open,
  onOpenChange,
  snapshot,
  first,
  pending,
  note,
  onNoteChange,
  onConfirm,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  snapshot: Snapshot
  first: boolean
  pending: boolean
  note: string
  onNoteChange: (v: string) => void
  onConfirm: () => void
}) {
  const d = useMemo(() => describeTemplate(snapshot.prompt_template), [snapshot])
  const moduleTypes = Array.from(new Set(d.modules.map((m) => m.type)))
  const skin = snapshot.skin as { css?: string; regexScripts?: unknown[]; renderHtml?: boolean }
  const skinBits = [skin.css?.trim() ? '自定义 CSS' : null, skin.regexScripts?.length ? `${skin.regexScripts.length} 条正则脚本` : null, skin.renderHtml ? 'HTML 渲染' : null].filter(Boolean)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[88dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display">{first ? '发布这个角色' : '更新发布内容'}</DialogTitle>
          <DialogDescription>下面是其他人将看到的内容。发布后它会出现在「探索」里。</DialogDescription>
        </DialogHeader>

        <div className="flex items-center gap-3">
          <Avatar className="size-14 rounded-cv-md">
            {snapshot.avatar_url && <AvatarImage src={snapshot.avatar_url} alt="" />}
            <AvatarFallback className="rounded-cv-md bg-cv-primary font-display text-lg text-cv-primary-fg">{snapshot.name.charAt(0)}</AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <div className="truncate font-display text-xl font-semibold">{snapshot.name}</div>
            <p className="line-clamp-2 text-sm text-cv-fg-muted">{d.introduction ?? '（没有简介）'}</p>
          </div>
        </div>

        {d.keywords.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {d.keywords.map((k) => <Chip key={k} tone="flat">{k}</Chip>)}
          </div>
        )}

        <dl className="grid gap-2 text-sm">
          <Row label="人设模块">{moduleTypes.length ? moduleTypes.join(' · ') : '无'}{d.description ? '（含基本设定）' : ''}</Row>
          <Row label="开场白">{d.initialMessage ? '包含' : '无'}</Row>
          <Row label="皮肤">{skinBits.length ? skinBits.join(' · ') : '无'}</Row>
        </dl>

        <label className="flex flex-col gap-1.5 text-sm">
          <span className="font-semibold">更新说明<span className="ml-1 text-xs font-normal text-cv-fg-subtle">{first ? '可选' : '聊过或收藏过这个角色的人会收到这条'}</span></span>
          <Textarea
            value={note}
            onChange={(e) => onNoteChange(e.target.value)}
            maxLength={500}
            placeholder={first ? '比如：第一版，欢迎反馈' : '比如：补了第三章的世界书，调整了开场白'}
            className="min-h-16 resize-none text-sm"
          />
        </label>

        <div className="flex gap-2 rounded-cv-md bg-[color-mix(in_oklab,var(--cv-warning)_14%,transparent)] p-3 text-xs leading-relaxed text-cv-fg">
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-cv-warning" />
          <span>发布后<b>完整的人设提示词、开场白和皮肤</b>都会对其他用户可见（他们可以和它聊天，但不能复制或改写你的角色）。请确认里面没有你不想公开的内容。</span>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={pending}>再想想</Button>
          <Button variant="accent" onClick={onConfirm} disabled={pending}>
            {pending ? <Loader2 className="animate-spin" /> : <Globe />}
            {first ? '确认发布' : '确认更新'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex gap-3">
      <dt className="w-16 shrink-0 text-cv-fg-subtle">{label}</dt>
      <dd className="min-w-0 flex-1 text-cv-fg">{children}</dd>
    </div>
  )
}
