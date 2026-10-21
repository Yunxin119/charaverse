'use client'

import { Suspense, useCallback, useMemo, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Loader2, Plus, Upload } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { GlassPanel, PosterCard, PosterTitle, Chip } from '@/components/glass'
import { useAuth } from '@/providers/AuthProvider'
import { usePresets, useSavePreset, useDeletePreset } from '@/queries/usePresets'
import { BUILTIN_DEFAULT_PRESET, type PresetFile } from '@/lib/prompt/presets'
import type { UserPreset } from '@/app/lib/supabase'
import { PresetCard } from '@/components/presets/PresetCard'
import { PresetEditor } from '@/components/presets/PresetEditor'
import { PresetImportDialog } from '@/components/presets/PresetImportDialog'
import {
  BUILTIN_ID,
  clonePreset,
  copyName,
  downloadPresetJson,
  formatRelativeTime,
  presetFromRow,
  summarizePreset,
} from '@/components/presets/presetUtils'

const ROUTE = '/settings/presets'

function toRowData(preset: PresetFile): Record<string, unknown> {
  // Rows store the schema-validated JSON; `source.raw` (the original imported blob) stays with it.
  return JSON.parse(JSON.stringify(preset)) as Record<string, unknown>
}

export default function PresetsPage() {
  return (
    <Suspense fallback={<PageSpinner />}>
      <PresetsPageInner />
    </Suspense>
  )
}

function PageSpinner() {
  return (
    <div className="mx-auto flex max-w-5xl items-center justify-center px-4 py-24 text-cv-fg-muted">
      <Loader2 className="size-5 animate-spin" />
    </div>
  )
}

function PresetsPageInner() {
  const { user, loading: authLoading } = useAuth()
  const router = useRouter()
  const searchParams = useSearchParams()
  const qc = useQueryClient()
  const edit = searchParams.get('edit')

  const userId = user?.id
  const presetsQuery = usePresets(userId)
  const save = useSavePreset(userId)
  const del = useDeletePreset(userId)

  const [importOpen, setImportOpen] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [pageError, setPageError] = useState<string | null>(null)

  const presets = useMemo(() => presetsQuery.data ?? [], [presetsQuery.data])

  const openEditor = useCallback((id: string) => router.push(`${ROUTE}?edit=${encodeURIComponent(id)}`), [router])
  /** Put a freshly saved row into the list cache so `?edit=<id>` resolves before the refetch lands. */
  const seedRow = useCallback(
    (row: UserPreset) => {
      if (!userId) return
      qc.setQueryData<UserPreset[]>(['presets', userId], (old) => {
        const rest = (old ?? []).filter((r) => r.id !== row.id).map((r) => (row.is_default ? { ...r, is_default: false } : r))
        return [row, ...rest]
      })
    },
    [qc, userId]
  )
  const closeEditor = useCallback(() => router.push(ROUTE), [router])

  const runBusy = useCallback(async (id: string, fn: () => Promise<unknown>) => {
    setBusyId(id)
    setPageError(null)
    try {
      await fn()
    } catch (e) {
      setPageError((e as Error).message || '操作失败')
    } finally {
      setBusyId(null)
    }
  }, [])

  if (authLoading) return <PageSpinner />

  if (!user) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6">
        <GlassPanel className="text-center text-sm text-cv-fg-muted">请先登录后管理预设。</GlassPanel>
      </div>
    )
  }

  /* ---------------------------- editor mode ---------------------------- */
  if (edit) {
    let initial: PresetFile | null = null
    let presetId: string | null = null
    let isDefault = false
    let readOnly = false
    let missing = false

    if (edit === 'new') {
      initial = clonePreset(BUILTIN_DEFAULT_PRESET)
      initial.name = '新预设'
      initial.source = { format: 'charaverse' }
    } else if (edit === BUILTIN_ID) {
      initial = clonePreset(BUILTIN_DEFAULT_PRESET)
      readOnly = true
    } else {
      const row = presets.find((p) => p.id === edit)
      if (row) {
        initial = presetFromRow(row).preset
        presetId = row.id
        isDefault = row.is_default
      } else if (!presetsQuery.isLoading && !presetsQuery.isFetching) {
        missing = true
      }
    }

    if (missing) {
      return (
        <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 space-y-4">
          <GlassPanel className="space-y-3 text-sm text-cv-fg-muted">
            <p>找不到这个预设，可能已被删除。</p>
            <Button variant="neu" size="sm" onClick={closeEditor}><ArrowLeft /> 返回列表</Button>
          </GlassPanel>
        </div>
      )
    }
    if (!initial) return <PageSpinner />

    return (
      <div className="mx-auto max-w-6xl px-4 py-4 sm:px-6 sm:py-6">
        <PresetEditor
          key={edit}
          presetId={presetId}
          initial={initial}
          initialIsDefault={isDefault}
          readOnly={readOnly}
          saving={save.isPending}
          onBack={closeEditor}
          onSave={async ({ id, preset, isDefault: def }) => {
            const row = await save.mutateAsync({ id: id ?? undefined, name: preset.name, data: toRowData(preset), is_default: def })
            seedRow(row)
            if (!id) router.replace(`${ROUTE}?edit=${encodeURIComponent(row.id)}`)
          }}
          onSaveAs={async ({ preset, isDefault: def }) => {
            const row = await save.mutateAsync({ name: preset.name, data: toRowData(preset), is_default: def })
            seedRow(row)
            router.replace(`${ROUTE}?edit=${encodeURIComponent(row.id)}`)
          }}
        />
      </div>
    )
  }

  /* ----------------------------- list mode ----------------------------- */
  const builtinSummary = summarizePreset(BUILTIN_DEFAULT_PRESET)

  const duplicateBuiltin = () =>
    runBusy(BUILTIN_ID, async () => {
      const copy = clonePreset(BUILTIN_DEFAULT_PRESET)
      copy.name = copyName(copy.name)
      const row = await save.mutateAsync({ name: copy.name, data: toRowData(copy) })
      seedRow(row)
      openEditor(row.id)
    })

  const setDefault = (row: UserPreset) =>
    runBusy(row.id, () => save.mutateAsync({ id: row.id, name: row.name, data: row.data, is_default: true }))

  const duplicate = (row: UserPreset) =>
    runBusy(row.id, async () => {
      const { preset } = presetFromRow(row)
      const copy = clonePreset(preset)
      copy.name = copyName(row.name)
      await save.mutateAsync({ name: copy.name, data: toRowData(copy) })
    })

  const remove = (row: UserPreset) => {
    if (!confirm(`删除预设「${row.name}」？此操作不可恢复。`)) return
    void runBusy(row.id, () => del.mutateAsync(row.id))
  }

  const exportRow = (row: UserPreset) => {
    const { preset } = presetFromRow(row)
    downloadPresetJson({ ...preset, name: row.name })
  }

  const importPreset = async (preset: PresetFile) => {
    await save.mutateAsync({ name: preset.name, data: toRowData(preset), is_default: presets.length === 0 })
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-semibold tracking-tight">预设</h1>
          <p className="mt-1 text-sm text-cv-fg-muted">决定 system prompt 的拼装顺序与采样参数，可导入外部预设。</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="neu" size="sm" onClick={() => setImportOpen(true)}>
            <Upload /> 导入
          </Button>
          <Button size="sm" onClick={() => openEditor('new')}>
            <Plus /> 新建
          </Button>
        </div>
      </header>

      {pageError && <p className="text-sm text-cv-danger">{pageError}</p>}
      {presetsQuery.isError && (
        <p className="text-sm text-cv-danger">加载预设失败：{(presetsQuery.error as Error)?.message ?? '未知错误'}</p>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <PresetCard
          builtin
          name={BUILTIN_DEFAULT_PRESET.name}
          summary={builtinSummary}
          updatedLabel={null}
          busy={busyId === BUILTIN_ID}
          onEdit={() => openEditor(BUILTIN_ID)}
          onDuplicate={duplicateBuiltin}
          onExport={() => downloadPresetJson(BUILTIN_DEFAULT_PRESET)}
        />

        {presetsQuery.isLoading && (
          <GlassPanel className="flex items-center justify-center text-cv-fg-muted">
            <Loader2 className="size-5 animate-spin" />
          </GlassPanel>
        )}

        {presets.map((row) => {
          const { preset, error } = presetFromRow(row)
          return (
            <PresetCard
              key={row.id}
              name={row.name}
              summary={summarizePreset(preset)}
              updatedLabel={formatRelativeTime(row.updated_at)}
              isDefault={row.is_default}
              dataError={error}
              busy={busyId === row.id}
              onEdit={() => openEditor(row.id)}
              onSetDefault={() => void setDefault(row)}
              onDuplicate={() => void duplicate(row)}
              onExport={() => exportRow(row)}
              onDelete={() => remove(row)}
            />
          )
        })}
      </div>

      {!presetsQuery.isLoading && presets.length === 0 && (
        <PosterCard tone="primary" className="min-h-56">
          <div className="flex h-full flex-col gap-4">
            <div className="flex flex-wrap gap-2">
              <Chip tone="glass">Prompt Manager</Chip>
              <Chip tone="glass">兼容外部预设</Chip>
            </div>
            <PosterTitle className="max-w-md">
              还没有自己的预设。
            </PosterTitle>
            <p className="max-w-lg text-sm leading-relaxed opacity-85">
              预设决定每次对话时 system prompt 的拼装顺序——主提示、角色描述、用户人设、记忆表、聊天历史——以及温度、top_p 等采样参数。
              你可以直接导入通用预设格式的聊天补全预设 JSON，占位条目会自动映射。
            </p>
            <div className="mt-auto flex flex-wrap gap-2">
              <Button variant="accent" size="sm" onClick={() => setImportOpen(true)}>
                <Upload /> 导入预设
              </Button>
              <Button variant="glass" size="sm" onClick={() => openEditor('new')}>
                <Plus /> 从默认模板新建
              </Button>
            </div>
          </div>
        </PosterCard>
      )}

      <PresetImportDialog open={importOpen} onOpenChange={setImportOpen} onImport={importPreset} />
    </div>
  )
}
