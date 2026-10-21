'use client'

import type { Lorebook } from '@/lib/lorebook/schema'
import { LorebookEditor } from '@/components/lorebook/LorebookEditor'
import { SectionHeader } from './Field'

interface Props {
  value: Lorebook
  onChange: (next: Lorebook) => void
  /** used for the exported file name */
  characterName?: string
}

/** 世界书 section of the character form: the book embedded in the card (characters.lorebook). */
export function LorebookSection({ value, onChange, characterName }: Props) {
  return (
    <section aria-labelledby="sec-lorebook">
      <SectionHeader
        title="世界书"
        description="随角色一起保存的背景设定。关键词出现在最近几条消息里时，对应条目会注入到提示词；常驻条目总是注入。设置里的「世界书库」则对你所有对话生效。"
      />
      <LorebookEditor value={value} onChange={onChange} exportName={characterName ? `${characterName}-世界书` : undefined} />
    </section>
  )
}
