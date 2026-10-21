import Link from 'next/link'
import { MessageSquare, Compass, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { PosterCard, PosterTitle } from '@/components/glass'

export default function NotFound() {
  return (
    <div className="grid min-h-dvh place-items-center px-4 py-6 sm:px-6">
      <PosterCard tone="primary" className="flex w-full max-w-xl flex-col justify-between p-6 sm:min-h-[380px] sm:p-8">
        <div className="flex items-center gap-2">
          <span className="flex size-9 items-center justify-center rounded-cv-sm bg-cv-accent text-white shadow-[0_10px_24px_-10px_var(--cv-accent)]">
            <Sparkles className="size-4" />
          </span>
          <span className="font-mono text-[11px] uppercase tracking-[0.2em] opacity-70">CharaVerse</span>
        </div>

        <div className="mt-10">
          <p className="font-display text-7xl font-semibold leading-none tracking-tight opacity-90 sm:text-8xl">404</p>
          <PosterTitle className="mt-4 text-2xl sm:text-3xl">这一页不在任何宇宙里</PosterTitle>
          <p className="mt-3 max-w-sm text-sm opacity-80 sm:text-base">链接可能失效，或者角色已经被作者收回。去对话继续，或者到广场看看别的角色。</p>
        </div>

        <div className="mt-8 flex flex-wrap gap-3">
          <Button asChild variant="accent">
            <Link href="/chat">
              <MessageSquare /> 回到对话
            </Link>
          </Button>
          <Button asChild variant="outline" className="border-white/25 text-cv-primary-fg hover:bg-white/10">
            <Link href="/explore">
              <Compass /> 去广场逛逛
            </Link>
          </Button>
        </div>
      </PosterCard>
    </div>
  )
}
