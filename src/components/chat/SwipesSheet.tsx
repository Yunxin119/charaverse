'use client'

import { useState } from 'react'
import { Check, Copy, Loader2, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import type { ChatMessage } from '@/app/lib/supabase'
import { Button } from '@/components/ui/button'
import { Chip, GlassSheet, GlassSheetContent, IconButton } from '@/components/glass'
import { cn } from '@/lib/utils'
import { MessageContent, type RenderSkin } from './MessageContent'

interface Props {
  /** the message whose rerolls are listed; `null` closes the sheet */
  message: ChatMessage | null
  onClose: () => void
  characterName: string
  skin?: RenderSkin | null
  busy?: boolean
  onSelect: (message: ChatMessage, index: number) => void
  onDelete: (message: ChatMessage, index: number) => void
  deleting?: boolean
}

/**
 * Every reroll of one assistant message, side by side: the chosen one is marked,
 * any other can be picked or removed. Opened from the `n/m` counter under a bubble
 * (flow layout) or in the visual-novel dialogue box.
 */
export function SwipesSheet({ message, onClose, characterName, skin, busy, onSelect, onDelete, deleting }: Props) {
  const swipes = message?.swipes ?? []
  const current = message?.swipe_index ?? 0
  return (
    <GlassSheet open={!!message} onOpenChange={(o) => { if (!o) onClose() }}>
      <GlassSheetContent id="cv_swipes_sheet" side="right" title={`${characterName} 的备选回复`} className="sm:max-w-2xl [&>div:last-child]:flex [&>div:last-child]:min-h-0 [&>div:last-child]:flex-1 [&>div:last-child]:flex-col">
        <p className="mb-3 text-xs text-cv-fg-subtle">
          每次「重新生成」都会把上一版留在这里。选用别的版本不会丢掉现在这版；删掉的版本找不回来。
        </p>
        <ol className="min-h-0 flex-1 space-y-3 overflow-y-auto pr-1">
          {message && swipes.map((text, i) => (
            <SwipeCard
              key={i}
              index={i}
              total={swipes.length}
              text={text}
              chosen={i === current}
              skin={skin}
              disabled={!!busy || !!deleting}
              onSelect={() => onSelect(message, i)}
              onDelete={() => onDelete(message, i)}
            />
          ))}
        </ol>
      </GlassSheetContent>
    </GlassSheet>
  )
}

function SwipeCard({ index, total, text, chosen, skin, disabled, onSelect, onDelete }: {
  index: number; total: number; text: string; chosen: boolean; skin?: RenderSkin | null; disabled: boolean
  onSelect: () => void; onDelete: () => void
}) {
  const [confirm, setConfirm] = useState(false)
  const [copied, setCopied] = useState(false)
  const copy = async () => {
    try { await navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 1200) } catch { toast.error('复制失败') }
  }
  return (
    <li
      data-chosen={chosen ? '' : undefined}
      className={cn('cv_swipe_card rounded-cv-lg border p-3 transition-colors', chosen ? 'border-cv-accent/60 bg-[color-mix(in_oklab,var(--cv-accent)_8%,transparent)]' : 'border-cv-border bg-cv-bg-elevated/60')}
    >
      <div className="flex items-center gap-2">
        <Chip tone={chosen ? 'primary' : 'outline'}>{index + 1}/{total}</Chip>
        {chosen && <span className="text-xs text-cv-fg-muted">当前显示</span>}
        <span className="ml-auto flex items-center gap-0.5">
          <IconButton label={copied ? '已复制' : '复制'} size="sm" variant="ghost" onClick={() => void copy()}>
            {copied ? <Check className="text-cv-success" /> : <Copy />}
          </IconButton>
          {total > 1 && (
            <IconButton label="删除这个版本" size="sm" variant="ghost" disabled={disabled} onClick={() => setConfirm((v) => !v)} className={cn(confirm && 'text-cv-danger')}>
              {disabled && confirm ? <Loader2 className="animate-spin" /> : <Trash2 />}
            </IconButton>
          )}
          {!chosen && <Button size="sm" variant="accent" disabled={disabled} onClick={onSelect}>选用</Button>}
        </span>
      </div>
      {confirm && (
        <div className="mt-2 flex flex-wrap items-center justify-between gap-2 rounded-cv-md bg-[color-mix(in_oklab,var(--cv-danger)_10%,transparent)] px-3 py-2 text-xs text-cv-danger">
          <span>删掉这个版本？不可撤销。</span>
          <span className="flex gap-1.5">
            <Button size="sm" variant="ghost" onClick={() => setConfirm(false)}>取消</Button>
            <Button size="sm" variant="destructive" onClick={() => { setConfirm(false); onDelete() }}>删除</Button>
          </span>
        </div>
      )}
      <div className="mt-2 text-sm text-cv-fg [overflow-wrap:anywhere]">
        <MessageContent text={text} role="assistant" skin={skin} />
      </div>
    </li>
  )
}
