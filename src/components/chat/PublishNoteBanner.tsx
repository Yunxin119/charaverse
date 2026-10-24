'use client'

import { useEffect, useState } from 'react'
import { Sparkles, X } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { zhCN } from 'date-fns/locale'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

const key = (characterId: number) => `cv.seenPublish.${characterId}`

/**
 * Shown to people chatting with someone else's character after the author re-publishes:
 * the chat already uses the new snapshot, this just surfaces the author's note once per version.
 * The first version a device sees is recorded silently so existing players are not nagged.
 */
export function PublishNoteBanner({ characterId, publishedAt, note, className }: { characterId: number; publishedAt: string; note: string | null; className?: string }) {
  const [show, setShow] = useState(false)
  useEffect(() => {
    try {
      const seen = localStorage.getItem(key(characterId))
      if (!seen) { localStorage.setItem(key(characterId), publishedAt); return }
      setShow(seen !== publishedAt)
    } catch { /* storage unavailable */ }
  }, [characterId, publishedAt])
  if (!show) return null

  const dismiss = () => {
    try { localStorage.setItem(key(characterId), publishedAt) } catch { /* storage unavailable */ }
    setShow(false)
  }
  const ago = formatDistanceToNow(new Date(publishedAt), { addSuffix: true, locale: zhCN })

  return (
    <div role="status" className={cn('glass flex items-start gap-3 rounded-cv-md border border-cv-accent/30 px-4 py-3 text-sm', className)}>
      <Sparkles className="mt-0.5 size-4 shrink-0 text-cv-accent" aria-hidden />
      <div className="min-w-0 flex-1">
        <p className="font-semibold">作者更新了这个角色<span className="ml-2 text-xs font-normal text-cv-fg-subtle">{ago} · 新内容已经生效</span></p>
        <p className="mt-0.5 whitespace-pre-wrap text-cv-fg-muted">{note?.trim() || '（作者没有写更新说明）'}</p>
      </div>
      <Button size="sm" variant="ghost" onClick={dismiss} aria-label="知道了"><X /></Button>
    </div>
  )
}
