'use client'

import Link from 'next/link'
import { ArrowRight, Palette } from 'lucide-react'
import type { Character } from '@/app/lib/supabase'
import { parseSkin, skinIsEmpty } from '@/lib/skins/schema'
import { knobsIsEmpty } from '@/lib/skins/knobs'
import { Button } from '@/components/ui/button'
import { Chip, GlassPanel } from '@/components/glass'

interface Props {
  /** the saved row (edit mode); undefined while creating */
  character?: Character
}

/** 皮肤 body of the character form: what the card's skin currently holds, and the door to its editor. */
export function SkinSection({ character }: Props) {
  if (!character) {
    return <p className="text-sm text-cv-fg-muted">保存角色后就可以在这里编辑皮肤：CSS、正则美化脚本和沙箱 HTML。</p>
  }
  const skin = parseSkin(character.skin)
  const bits = [
    knobsIsEmpty(skin.knobs) ? null : '基础调节',
    skin.css.trim() ? '自定义 CSS' : null,
    skin.regexScripts.length ? `${skin.regexScripts.length} 条正则脚本` : null,
    skin.renderHtml ? null : 'HTML 已关闭',
  ].filter((b): b is string => !!b)

  return (
    <GlassPanel className="flex flex-col gap-4 sm:flex-row sm:items-center">
      <span className="flex size-12 shrink-0 items-center justify-center rounded-cv-md bg-cv-accent text-white shadow-[0_10px_24px_-10px_var(--cv-accent)]">
        <Palette className="size-5" />
      </span>
      <div className="min-w-0 flex-1 space-y-1.5">
        <div className="flex flex-wrap items-center gap-1.5">
          {skinIsEmpty(skin) ? <span className="text-sm text-cv-fg-muted">还没有皮肤，聊天页用默认样式。</span> : bits.map((b) => <Chip key={b} tone="outline">{b}</Chip>)}
        </div>
        <p className="text-xs text-cv-fg-subtle">皮肤有自己的编辑器，右侧是真实聊天页的实时预览。CSS 只作用于聊天区域，HTML 与脚本在沙箱里运行。</p>
      </div>
      <Button asChild variant="neu" size="sm" className="shrink-0">
        <Link href={`/characters/${character.id}/skin`}>打开皮肤编辑器<ArrowRight /></Link>
      </Button>
    </GlassPanel>
  )
}
