'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { RotateCcw, MessageSquare, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { PosterCard, PosterTitle } from '@/components/glass'

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    // Only the message: never log request bodies, prompts or keys.
    console.error('[route error]', error.message)
  }, [error])

  return (
    <div className="grid min-h-dvh place-items-center px-4 py-6 sm:px-6">
      <PosterCard tone="ink" className="flex w-full max-w-xl flex-col justify-between p-6 sm:min-h-[380px] sm:p-8">
        <div className="flex items-center gap-2">
          <span className="flex size-9 items-center justify-center rounded-cv-sm bg-cv-accent text-white shadow-[0_10px_24px_-10px_var(--cv-accent)]">
            <Sparkles className="size-4" />
          </span>
          <span className="font-mono text-[11px] uppercase tracking-[0.2em] opacity-70">CharaVerse</span>
        </div>

        <div className="mt-10">
          <PosterTitle className="text-3xl sm:text-4xl">出了点问题</PosterTitle>
          <p className="mt-3 max-w-sm text-sm opacity-80 sm:text-base">这一页没能正常渲染。你可以重试一次，或者先回到对话。</p>
          {error.digest && (
            <p className="mt-4 font-mono text-[11px] tracking-wider opacity-50" aria-label="错误编号">
              digest · {error.digest}
            </p>
          )}
        </div>

        <div className="mt-8 flex flex-wrap gap-3">
          <Button variant="accent" onClick={() => reset()}>
            <RotateCcw /> 重试
          </Button>
          <Button asChild variant="outline" className="border-white/25 text-[var(--cv-cream-200)] hover:bg-white/10">
            <Link href="/chat">
              <MessageSquare /> 回到对话
            </Link>
          </Button>
        </div>
      </PosterCard>
    </div>
  )
}
