'use client'

import type { Skin } from '@/lib/skins/schema'
import { SkinFields } from '@/components/skins/SkinFields'

interface Props {
  value: Skin
  onChange: (next: Skin) => void
  sample: string
  onSampleChange: (v: string) => void
  char: string
  user: string
}

/** 皮肤 body of the character form: edited with the card, saved with the card, shown live in the dock. */
export function SkinSection(props: Props) {
  return <SkinFields {...props} />
}
