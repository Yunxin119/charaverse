'use client'

import { useMemo, useState } from 'react'
import { Eye, MessageCircle } from 'lucide-react'
import { useAuth } from '@/providers/AuthProvider'
import { usePresets } from '@/queries'
import { BUILTIN_DEFAULT_PRESET, parsePreset } from '@/lib/prompt/presets'
import { cn } from '@/lib/utils'
import type { CharacterDraft } from '../form/types'
import { PromptPreview, type PresetOption } from './PromptPreview'
import { TryChat } from './TryChat'

type Tab = 'prompt' | 'chat'

/** Right-hand dock of the editor: 「模型会看到什么」 and 「试聊」, sharing one preset choice. */
export function PreviewDock({ draft, className }: { draft: CharacterDraft; className?: string }) {
  const { user } = useAuth()
  const presetsQ = usePresets(user?.id)
  const [tab, setTab] = useState<Tab>('prompt')
  const presets = useMemo<PresetOption[]>(() => {
    const mine = (presetsQ.data ?? []).flatMap((p) => { const r = parsePreset(p.data); return r.ok ? [{ id: p.id, name: p.name + (p.is_default ? '（默认）' : ''), preset: r.preset }] : [] })
    const def = (presetsQ.data ?? []).find((p) => p.is_default)
    const list = [...mine, { id: null, name: `内置 · ${BUILTIN_DEFAULT_PRESET.name}`, preset: BUILTIN_DEFAULT_PRESET }]
    // default preset first so it is what the preview opens with
    return def ? [...list.filter((p) => p.id === def.id), ...list.filter((p) => p.id !== def.id)] : list
  }, [presetsQ.data])
  const [presetId, setPresetId] = useState<string | null | undefined>(undefined)
  const effectivePreset = presetId === undefined ? (presets[0]?.id ?? null) : presetId

  return (
    <div className={cn('flex min-h-0 flex-col gap-3', className)}>
      <div className="neu-in flex rounded-full p-1" role="tablist" aria-label="预览">
        {([['prompt', '模型会看到什么', Eye], ['chat', '试聊', MessageCircle]] as const).map(([id, label, Icon]) => (
          <button key={id} type="button" role="tab" aria-selected={tab === id} onClick={() => setTab(id)} className={cn('flex flex-1 items-center justify-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-semibold transition-colors', tab === id ? 'bg-cv-bg-elevated text-cv-fg shadow-neu-sm' : 'text-cv-fg-muted hover:text-cv-fg')}>
            <Icon className="size-4" />{label}
          </button>
        ))}
      </div>
      {tab === 'prompt'
        ? <PromptPreview draft={draft} presets={presets} presetId={effectivePreset} onPresetChange={setPresetId} />
        : <TryChat draft={draft} presetId={effectivePreset} />}
    </div>
  )
}
