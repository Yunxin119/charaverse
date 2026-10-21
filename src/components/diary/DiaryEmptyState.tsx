'use client'

import { Feather, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { PosterCard, PosterTitle } from '@/components/glass'

interface Props {
  characterName: string
  generating: boolean
  disabled?: boolean
  onGenerate: () => void
}

export function DiaryEmptyState({ characterName, generating, disabled, onGenerate }: Props) {
  return (
    <PosterCard tone="primary" className="min-h-64">
      <p className="font-mono text-[11px] uppercase tracking-[0.18em] opacity-70">Journal</p>
      <PosterTitle className="mt-2 text-3xl">还没有日记</PosterTitle>
      <p className="mt-3 max-w-md text-sm leading-relaxed opacity-85">
        日记由 {characterName} 以第一人称写下：不是复述对话，而是记录这段时间的心情和想法。
        每篇日记只取上一篇之后的新对话，至少需要 3 条新消息。
      </p>
      <Button variant="accent" className="mt-6" onClick={onGenerate} disabled={generating || disabled}>
        {generating ? <Loader2 className="animate-spin" /> : <Feather />}
        {generating ? '正在写…' : '写第一篇日记'}
      </Button>
    </PosterCard>
  )
}
