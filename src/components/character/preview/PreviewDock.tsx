'use client'

import { useMemo, useState } from 'react'
import { Eye, MessageCircle } from 'lucide-react'
import { useAuth } from '@/providers/AuthProvider'
import { usePresets } from '@/queries'
import { BUILTIN_DEFAULT_PRESET, parsePreset } from '@/lib/prompt/presets'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { cn } from '@/lib/utils'
import type { CharacterDraft } from '../form/types'
import { PromptPreview, type PresetOption } from './PromptPreview'
import { LivePreview } from './LivePreview'

type Tab = 'chat' | 'prompt'

interface Props {
  draft: CharacterDraft
  sample: string
  onSampleChange: (v: string) => void
  className?: string
}

/**
 * Right-hand dock of the editor: the real chat page (skin, regex, HTML, scratch 试聊) and
 * 「模型会看到什么」, sharing one preset choice.
 */
export function PreviewDock({ draft, sample, onSampleChange, className }: Props) {
  const { user } = useAuth()
  const presetsQ = usePresets(user?.id)
  const [tab, setTab] = useState<Tab>('chat')
  const presets = useMemo<PresetOption[]>(() => {
    const mine = (presetsQ.data ?? []).flatMap((p) => { const r = parsePreset(p.data); return r.ok ? [{ id: p.id, name: p.name + (p.is_default ? '（默认）' : ''), preset: r.preset }] : [] })
    const def = (presetsQ.data ?? []).find((p) => p.is_default)
    const list = [...mine, { id: null, name: `内置 · ${BUILTIN_DEFAULT_PRESET.name}`, preset: BUILTIN_DEFAULT_PRESET }]
    // default preset first so it is what the preview opens with
    return def ? [...list.filter((p) => p.id === def.id), ...list.filter((p) => p.id !== def.id)] : list
  }, [presetsQ.data])
  const [presetId, setPresetId] = useState<string | null | undefined>(undefined)
  const effectivePreset = presetId === undefined ? (presets[0]?.id ?? null) : presetId
  const chosen = presets.find((p) => p.id === effectivePreset) ?? presets[0]

  return (
    <div className={cn('flex min-h-0 flex-col gap-2.5', className)}>
      <div className="flex flex-wrap items-center gap-2">
        <div className="neu-in flex min-w-48 flex-1 rounded-full p-1" role="tablist" aria-label="预览">
          {([['chat', '预览', MessageCircle], ['prompt', '提示词', Eye]] as const).map(([id, label, Icon]) => (
            <button key={id} type="button" role="tab" aria-selected={tab === id} onClick={() => setTab(id)} className={cn('flex flex-1 items-center justify-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-semibold transition-colors', tab === id ? 'bg-cv-bg-elevated text-cv-fg shadow-neu-sm' : 'text-cv-fg-muted hover:text-cv-fg')}>
              <Icon className="size-4" />{label}
            </button>
          ))}
        </div>
        <Select value={chosen?.id ?? '__builtin__'} onValueChange={(v) => setPresetId(v === '__builtin__' ? null : v)}>
          <SelectTrigger className="h-8 w-32 text-xs" aria-label="预览用的预设" title="试聊和提示词预览用的预设"><SelectValue /></SelectTrigger>
          <SelectContent>{presets.map((p) => <SelectItem key={p.id ?? '__builtin__'} value={p.id ?? '__builtin__'}>{p.name}</SelectItem>)}</SelectContent>
        </Select>
      </div>
      {tab === 'prompt'
        ? (chosen ? <PromptPreview draft={draft} preset={chosen} /> : null)
        : <LivePreview draft={draft} presetId={effectivePreset} sample={sample} onSampleChange={onSampleChange} className="min-h-0 flex-1" />}
    </div>
  )
}
