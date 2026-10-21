'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { ArrowLeft, Copy, Download, Loader2, Plus, Save, Sparkles } from 'lucide-react'
import { GlassPanel, GlassSheet, GlassSheetContent, Chip, IconButton } from '@/components/glass'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  MARKER_IDS,
  MARKER_LABELS,
  parsePreset,
  type MarkerId,
  type PresetFile,
  type PresetPrompt,
  type PresetSampling,
} from '@/lib/prompt/presets'
import { cn } from '@/lib/utils'
import { PromptList } from './PromptList'
import { PromptDetail } from './PromptDetail'
import { SamplingPanel } from './SamplingPanel'
import { clonePreset, copyName, downloadPresetJson, newContentPrompt, summarizePreset } from './presetUtils'

export interface PresetEditorProps {
  /** Existing row id; `null` for a brand-new or builtin (read-only) preset. */
  presetId: string | null
  initial: PresetFile
  initialIsDefault: boolean
  /** Builtin preview: nothing editable, only 「另存为」 / 「导出」. */
  readOnly?: boolean
  saving?: boolean
  onBack: () => void
  onSave: (payload: { id: string | null; preset: PresetFile; isDefault: boolean }) => Promise<void>
  onSaveAs: (payload: { preset: PresetFile; isDefault: boolean }) => Promise<void>
}

const LARGE_QUERY = '(min-width: 1024px)'

function useIsLarge(): boolean {
  const [large, setLarge] = useState(false)
  useEffect(() => {
    const mq = window.matchMedia(LARGE_QUERY)
    const update = () => setLarge(mq.matches)
    update()
    mq.addEventListener('change', update)
    return () => mq.removeEventListener('change', update)
  }, [])
  return large
}

function firstErrorLine(error: string): string {
  const line = error.split('\n').find((l) => l.trim())
  return (line ?? error).replace(/^✖\s*/, '')
}

export function PresetEditor({
  presetId,
  initial,
  initialIsDefault,
  readOnly = false,
  saving = false,
  onBack,
  onSave,
  onSaveAs,
}: PresetEditorProps) {
  const [draft, setDraft] = useState<PresetFile>(() => clonePreset(initial))
  const [isDefault, setIsDefault] = useState(initialIsDefault)
  const [baseline, setBaseline] = useState(() => JSON.stringify({ p: initial, d: initialIsDefault }))
  const [selected, setSelected] = useState<number | null>(() => (initial.prompts.length ? 0 : null))
  const [sheetOpen, setSheetOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const isLarge = useIsLarge()

  const serialized = useMemo(() => JSON.stringify({ p: draft, d: isDefault }), [draft, isDefault])
  const dirty = !readOnly && serialized !== baseline
  const summary = useMemo(() => summarizePreset(draft), [draft])

  // Unsaved-changes guard for reloads / tab close.
  useEffect(() => {
    if (!dirty) return
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault()
    }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [dirty])

  useEffect(() => {
    if (!notice) return
    const t = setTimeout(() => setNotice(null), 2200)
    return () => clearTimeout(t)
  }, [notice])

  const selectedPrompt = selected !== null ? draft.prompts[selected] : undefined

  const patch = useCallback((fn: (d: PresetFile) => PresetFile) => {
    setError(null)
    setDraft((d) => fn(d))
  }, [])

  const updatePrompt = (index: number, p: Partial<PresetPrompt>) =>
    patch((d) => ({ ...d, prompts: d.prompts.map((x, i) => (i === index ? { ...x, ...p } : x)) }))

  const movePrompt = (from: number, to: number) => {
    if (to < 0 || to >= draft.prompts.length || from === to) return
    patch((d) => {
      const next = d.prompts.slice()
      const [item] = next.splice(from, 1)
      next.splice(to, 0, item)
      return { ...d, prompts: next }
    })
    setSelected((s) => {
      if (s === null) return s
      if (s === from) return to
      if (from < s && to >= s) return s - 1
      if (from > s && to <= s) return s + 1
      return s
    })
  }

  const deletePrompt = (index: number) => {
    const p = draft.prompts[index]
    if (!p) return
    if (!p.marker && p.content.trim() && !confirm(`删除条目「${p.name || p.id}」？`)) return
    patch((d) => ({ ...d, prompts: d.prompts.filter((_, i) => i !== index) }))
    setSelected((s) => {
      if (s === null) return s
      const len = draft.prompts.length - 1
      if (len <= 0) return null
      if (s === index) return Math.min(index, len - 1)
      return s > index ? s - 1 : s
    })
  }

  const insertPrompt = (p: PresetPrompt) => {
    const at = selected === null ? draft.prompts.length : selected + 1
    patch((d) => {
      const next = d.prompts.slice()
      next.splice(at, 0, p)
      return { ...d, prompts: next }
    })
    setSelected(at)
    if (!isLarge) setSheetOpen(true)
  }

  const addContent = () => insertPrompt(newContentPrompt(draft.prompts))
  const addMarker = (id: MarkerId) =>
    insertPrompt({ id, name: MARKER_LABELS[id], enabled: true, marker: true, role: 'system', content: '' })

  const missingMarkers = MARKER_IDS.filter((id) => !draft.prompts.some((p) => p.marker && p.id === id))

  const selectRow = (i: number) => {
    setSelected(i)
    if (!isLarge) setSheetOpen(true)
  }

  const validate = (): PresetFile | null => {
    const result = parsePreset(draft)
    if (!result.ok) {
      setError(firstErrorLine(result.error))
      return null
    }
    return result.preset
  }

  const handleSave = async () => {
    if (readOnly) return
    const preset = validate()
    if (!preset) return
    try {
      await onSave({ id: presetId, preset, isDefault })
      setDraft(preset)
      setBaseline(JSON.stringify({ p: preset, d: isDefault }))
      setNotice('已保存')
    } catch (e) {
      setError((e as Error).message || '保存失败')
    }
  }

  const handleSaveAs = async () => {
    const preset = validate()
    if (!preset) return
    const suggested = readOnly ? preset.name : copyName(preset.name)
    const name = window.prompt('另存为新预设，名称：', suggested)
    if (name === null) return
    const finalName = name.trim().slice(0, 80)
    if (!finalName) {
      setError('名称不能为空')
      return
    }
    try {
      await onSaveAs({ preset: { ...preset, name: finalName }, isDefault: false })
    } catch (e) {
      setError((e as Error).message || '保存失败')
    }
  }

  const handleExport = () => {
    const preset = validate()
    if (!preset) return
    downloadPresetJson(preset)
  }

  const handleBack = () => {
    if (dirty && !confirm('有未保存的修改，确定离开？')) return
    onBack()
  }

  const detail = selectedPrompt ? (
    <PromptDetail
      key={`${selected}-${selectedPrompt.id}`}
      prompt={selectedPrompt}
      readOnly={readOnly}
      onChange={(p) => selected !== null && updatePrompt(selected, p)}
    />
  ) : (
    <div className="flex h-full min-h-40 items-center justify-center text-sm text-cv-fg-muted">
      选择左侧的条目开始编辑
    </div>
  )

  return (
    <div className="space-y-4">
      {/* Top bar */}
      <GlassPanel strength="strong" padding="none" className="sticky top-3 z-20 p-3 sm:p-4 space-y-3">
        <div className="flex items-center gap-2 sm:gap-3">
          <IconButton label="返回列表" variant="neu" size="sm" onClick={handleBack}>
            <ArrowLeft />
          </IconButton>
          <Input
            aria-label="预设名称"
            value={draft.name}
            maxLength={80}
            readOnly={readOnly}
            placeholder="预设名称"
            className="h-10 flex-1 font-display text-base font-semibold"
            onChange={(e) => patch((d) => ({ ...d, name: e.target.value }))}
          />
          {readOnly && <Chip tone="accent" className="hidden sm:inline-flex">内置 · 只读</Chip>}
          {dirty && <Chip tone="warning" className="hidden sm:inline-flex">未保存</Chip>}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {!readOnly && (
            <label className="mr-auto inline-flex items-center gap-2 rounded-full neu px-3 py-1.5 text-xs">
              <Switch checked={isDefault} onCheckedChange={(v) => { setError(null); setIsDefault(v) }} className="scale-90" />
              设为默认预设
            </label>
          )}
          {readOnly && <span className="mr-auto text-xs text-cv-fg-muted">内置预设不可修改，可另存为自己的副本后编辑。</span>}
          <Button size="sm" variant="ghost" onClick={handleExport}>
            <Download /> 导出
          </Button>
          <Button size="sm" variant="neu" onClick={handleSaveAs} disabled={saving}>
            <Copy /> {readOnly ? '复制为我的' : '另存为'}
          </Button>
          {!readOnly && (
            <Button size="sm" onClick={handleSave} disabled={!dirty || saving}>
              {saving ? <Loader2 className="animate-spin" /> : <Save />} 保存
            </Button>
          )}
        </div>
        {(error || notice) && (
          <p className={cn('text-xs', error ? 'text-cv-danger' : 'text-cv-success')}>{error ?? notice}</p>
        )}
      </GlassPanel>

      {/* Summary strip */}
      <div className="flex flex-wrap items-center gap-2 px-1 text-xs text-cv-fg-muted">
        <Chip tone="outline">{summary.enabled} / {summary.total} 条目启用</Chip>
        <Chip tone="outline">{summary.markers} 占位</Chip>
        <Chip tone="outline">≈{summary.tokens} tokens（启用的文本条目）</Chip>
        <span className="font-mono">{summary.sampling}</span>
      </div>

      {/* Prompt manager */}
      <div className="grid gap-4 lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)] lg:items-start">
        <GlassPanel padding="none" className="p-3 sm:p-4 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <h2 className="font-display text-base font-semibold">提示条目</h2>
            {!readOnly && (
              <div className="flex items-center gap-1.5">
                <Button size="sm" variant="neu" onClick={addContent} disabled={draft.prompts.length >= 200}>
                  <Plus /> 添加条目
                </Button>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button size="sm" variant="ghost" disabled={missingMarkers.length === 0 || draft.prompts.length >= 200}>
                      <Sparkles /> 添加占位
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="max-h-72 overflow-y-auto">
                    <DropdownMenuLabel>未加入的占位</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    {missingMarkers.map((id) => (
                      <DropdownMenuItem key={id} onSelect={() => addMarker(id)}>
                        <span className="flex flex-col">
                          <span>{MARKER_LABELS[id]}</span>
                          <span className="font-mono text-[10px] text-cv-fg-subtle">{id}</span>
                        </span>
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            )}
          </div>
          <p className="text-[11px] text-cv-fg-subtle">
            按顺序拼入 system prompt。{!readOnly && '桌面端可拖动排序，或用 ▲▼ 调整。'}
          </p>
          <PromptList
            prompts={draft.prompts}
            selectedIndex={selected}
            readOnly={readOnly}
            onSelect={selectRow}
            onToggle={(i, v) => updatePrompt(i, { enabled: v })}
            onMove={movePrompt}
            onDelete={deletePrompt}
          />
        </GlassPanel>

        <GlassPanel padding="none" className="hidden lg:block p-4 sm:p-5 lg:sticky lg:top-[calc(7.5rem+12px)]">
          {detail}
        </GlassPanel>
      </div>

      {/* Sampling */}
      <GlassPanel padding="none" className="p-4 sm:p-5 space-y-4">
        <div>
          <h2 className="font-display text-base font-semibold">采样参数</h2>
          <p className="text-[11px] text-cv-fg-subtle">未设置的参数由模型 / 连接默认值决定。</p>
        </div>
        <SamplingPanel
          sampling={draft.sampling}
          formatting={draft.formatting}
          readOnly={readOnly}
          onSamplingChange={(p) =>
            patch((d) => {
              const next: PresetSampling = { ...d.sampling }
              for (const [k, v] of Object.entries(p) as [keyof PresetSampling, number | undefined][]) {
                if (v === undefined) delete next[k]
                else next[k] = v
              }
              return { ...d, sampling: next }
            })
          }
          onFormattingChange={(p) =>
            patch((d) => {
              const next = { ...d.formatting, ...p }
              if (next.assistantPrefill === undefined) delete next.assistantPrefill
              return { ...d, formatting: next }
            })
          }
        />
      </GlassPanel>

      {/* Mobile / tablet detail sheet */}
      <GlassSheet open={sheetOpen && !isLarge} onOpenChange={setSheetOpen}>
        <GlassSheetContent side="bottom" title={selectedPrompt ? (selectedPrompt.name || selectedPrompt.id) : '条目'} className="max-h-[90dvh]">
          <div className="pb-2">{detail}</div>
        </GlassSheetContent>
      </GlassSheet>
    </div>
  )
}
