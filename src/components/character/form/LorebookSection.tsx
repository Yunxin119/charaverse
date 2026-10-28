'use client'

import type { Lorebook } from '@/lib/lorebook/schema'
import { LorebookEditor } from '@/components/lorebook/LorebookEditor'

interface Props {
  value: Lorebook
  onChange: (next: Lorebook) => void
  /** used for the exported file name */
  characterName?: string
}

/** 世界书 body of the character form: the book embedded in the card (characters.lorebook). The section heading comes from the form. */
export function LorebookSection({ value, onChange, characterName }: Props) {
  return <LorebookEditor value={value} onChange={onChange} exportName={characterName ? `${characterName}-世界书` : undefined} />
}
