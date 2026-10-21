'use client'

import Link from 'next/link'
import { Palette, ArrowRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { GlassPanel } from '@/components/glass'
import { SectionHeader } from './Field'

interface Props {
  characterId?: number
}

export function SkinSection({ characterId }: Props) {
  return (
    <section aria-labelledby="sec-skin">
      <SectionHeader title="外观皮肤" description="给聊天页换一套样子：CSS、正则脚本和沙箱 HTML 块。" />
      <GlassPanel className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <span className="flex size-12 shrink-0 items-center justify-center rounded-cv-md bg-cv-accent text-white shadow-[0_10px_24px_-10px_var(--cv-accent)]">
          <Palette className="size-5" />
        </span>
        <div className="min-w-0 flex-1 text-sm text-cv-fg-muted">
          {characterId !== undefined ? (
            <>皮肤有自己的编辑器，带实时预览。CSS 只作用于聊天区域，HTML 与脚本在沙箱里运行，拿不到主站任何数据。</>
          ) : (
            <>保存后可编辑皮肤。先把角色存下来，再去皮肤编辑器里调样式。</>
          )}
        </div>
        {characterId !== undefined && (
          <Button asChild variant="neu" size="sm" className="shrink-0">
            <Link href={`/characters/${characterId}/skin`}>打开皮肤编辑器<ArrowRight /></Link>
          </Button>
        )}
      </GlassPanel>
    </section>
  )
}
