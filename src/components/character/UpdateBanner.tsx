'use client'

import { useState } from 'react'
import Link from 'next/link'
import { AlertTriangle, Loader2, RefreshCw, Sparkles, X } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { zhCN } from 'date-fns/locale'
import { toast } from 'sonner'
import type { Character } from '@/app/lib/supabase'
import { hasCharacterUpdate, useCharacterSource, useUpgradeCharacter } from '@/queries/useCharacterUpdates'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { cn } from '@/lib/utils'

const dismissKey = (copyId: number) => `cv.charUpdateDismissed.${copyId}`

/**
 * 「作者更新了角色」 banner for a copy whose source has been re-published.
 * `dismissible` (chat): 「暂不更新」 hides it for that version on this device; the hub always shows it.
 */
export function CharacterUpdateBanner({ copy, userId, dismissible, className }: { copy: Character; userId: string | undefined; dismissible?: boolean; className?: string }) {
  const sourceQ = useCharacterSource(copy)
  const source = sourceQ.data
  const upgrade = useUpgradeCharacter(userId)
  const [open, setOpen] = useState(false)
  const [dismissed, setDismissed] = useState(() => {
    if (!dismissible || !source?.published_at) return false
    try { return localStorage.getItem(dismissKey(copy.id)) === source.published_at } catch { return false }
  })

  if (!source || !hasCharacterUpdate(copy, source)) return null
  if (dismissible && dismissed) return null
  const isSelfCopy = !!userId && source.user_id === userId

  const dismiss = () => {
    try { localStorage.setItem(dismissKey(copy.id), source.published_at ?? '') } catch { /* storage unavailable */ }
    setDismissed(true)
  }
  const confirm = () =>
    upgrade.mutate({ copyId: copy.id, source }, {
      onSuccess: () => { setOpen(false); toast.success(`「${source.name}」已更新到作者的最新版本`) },
      onError: (e) => toast.error((e as Error).message || '更新失败，请重试'),
    })
  const ago = source.published_at ? formatDistanceToNow(new Date(source.published_at), { addSuffix: true, locale: zhCN }) : ''

  return (
    <>
      <div role="status" className={cn('glass flex flex-wrap items-center gap-x-3 gap-y-2 rounded-cv-md border border-cv-accent/30 px-4 py-3 text-sm', className)}>
        <Sparkles className="size-4 shrink-0 text-cv-accent" aria-hidden />
        <div className="min-w-0 flex-1">
          <p className="font-semibold">
            {isSelfCopy ? '你更新了原角色' : '作者更新了这个角色'}
            <span className="ml-2 text-xs font-normal text-cv-fg-subtle">{ago}</span>
          </p>
          <p className="mt-0.5 line-clamp-2 whitespace-pre-wrap text-cv-fg-muted">
            {source.release_note?.trim() || '（作者没有写更新说明）'}
            {' '}
            <Link href={`/character/public/${source.id}`} className="text-cv-accent hover:underline">看原角色</Link>
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <Button size="sm" variant="accent" onClick={() => setOpen(true)} disabled={upgrade.isPending}><RefreshCw />更新到最新</Button>
          {dismissible && <Button size="sm" variant="ghost" onClick={dismiss} aria-label="暂不更新"><X /></Button>}
        </div>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-display">更新到作者的最新版本？</DialogTitle>
            <DialogDescription>「{source.name}」· 作者发布于 {ago}</DialogDescription>
          </DialogHeader>
          {source.release_note?.trim() && (
            <div className="rounded-cv-md bg-cv-bg-elevated/70 p-3 text-sm">
              <p className="mb-1 text-xs text-cv-fg-subtle">更新说明</p>
              <p className="whitespace-pre-wrap leading-relaxed">{source.release_note.trim()}</p>
            </div>
          )}
          <div className="flex gap-2 rounded-cv-md bg-[color-mix(in_oklab,var(--cv-warning)_14%,transparent)] p-3 text-xs leading-relaxed text-cv-fg">
            <AlertTriangle className="mt-0.5 size-4 shrink-0 text-cv-warning" />
            <span>更新会用作者的新版本<b>覆盖</b>这个副本的名字、头像、人设、皮肤和世界书，<b>你自己改过的内容会丢失</b>，无法撤销。对话记录、记忆和会话设置不受影响。</span>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)} disabled={upgrade.isPending}>保留我的版本</Button>
            <Button variant="accent" onClick={confirm} disabled={upgrade.isPending}>
              {upgrade.isPending ? <Loader2 className="animate-spin" /> : <RefreshCw />}覆盖并更新
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
