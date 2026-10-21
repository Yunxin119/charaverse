'use client'

import { useMemo, useRef, useState } from 'react'
import { FileJson, Loader2, Upload } from 'lucide-react'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Chip } from '@/components/glass'
import { importPresetJson, type PresetFile } from '@/lib/prompt/presets'
import { summarizePreset } from './presetUtils'

const MAX_FILE_BYTES = 2 * 1024 * 1024

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Persist the parsed preset; resolve when done, throw to show an error. */
  onImport: (preset: PresetFile) => Promise<void>
}

export function PresetImportDialog({ open, onOpenChange, onImport }: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="font-display text-xl">导入预设</DialogTitle>
          <DialogDescription>
            粘贴 JSON 或选择 <code className="font-mono text-xs">.json</code> 文件。自动识别通用预设格式与 CharaVerse 格式。
          </DialogDescription>
        </DialogHeader>
        {/* Body unmounts with the dialog, so every open starts from a clean form. */}
        {open && <ImportBody onImport={onImport} onClose={() => onOpenChange(false)} />}
      </DialogContent>
    </Dialog>
  )
}

function ImportBody({ onImport, onClose }: { onImport: Props['onImport']; onClose: () => void }) {
  const [text, setText] = useState('')
  const [nameOverride, setNameOverride] = useState<string | null>(null)
  const [fileName, setFileName] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const parsed = useMemo(() => (text.trim() ? importPresetJson(text) : null), [text])
  const summary = parsed?.ok ? summarizePreset(parsed.preset) : null
  const format = parsed?.ok ? parsed.preset.source?.format ?? 'charaverse' : null
  const name = nameOverride ?? (parsed?.ok ? parsed.preset.name : '')

  const pickFile = async (file: File) => {
    setSaveError(null)
    if (file.size > MAX_FILE_BYTES) {
      setText('')
      setFileName(null)
      setSaveError(`文件过大（${Math.round(file.size / 1024)} KB，上限 ${MAX_FILE_BYTES / 1024} KB）`)
      return
    }
    try {
      const content = await file.text()
      setFileName(file.name)
      setText(content)
      setNameOverride(null)
    } catch {
      setSaveError('读取文件失败')
    }
  }

  const submit = async () => {
    if (!parsed?.ok) return
    const finalName = name.trim().slice(0, 80) || parsed.preset.name
    setSaving(true)
    setSaveError(null)
    try {
      await onImport({ ...parsed.preset, name: finalName })
      onClose()
    } catch (e) {
      setSaveError((e as Error).message || '保存失败')
      setSaving(false)
    }
  }

  return (
    <>
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <input
            ref={fileRef}
            type="file"
            accept=".json,application/json"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) void pickFile(f)
              e.target.value = ''
            }}
          />
          <Button type="button" variant="neu" size="sm" onClick={() => fileRef.current?.click()}>
            <Upload /> 选择文件
          </Button>
          {fileName && (
            <span className="inline-flex items-center gap-1 text-xs text-cv-fg-muted">
              <FileJson className="size-3.5" /> {fileName}
            </span>
          )}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="cv-preset-json">预设 JSON</Label>
          <Textarea
            id="cv-preset-json"
            value={text}
            onChange={(e) => {
              setText(e.target.value)
              setFileName(null)
              setSaveError(null)
            }}
            placeholder='{ "name": "...", "prompts": [ ... ] }'
            spellCheck={false}
            className="min-h-40 max-h-64 font-mono text-xs leading-relaxed"
          />
        </div>

        {parsed && !parsed.ok && (
          <div className="max-h-40 overflow-y-auto whitespace-pre-wrap break-words rounded-cv-md border border-cv-danger/30 bg-cv-danger/8 px-3 py-2 text-xs text-cv-danger">
            {parsed.error}
          </div>
        )}

        {parsed?.ok && summary && (
          <div className="neu space-y-3 rounded-cv-md p-4">
            <div className="flex flex-wrap items-center gap-2">
              <Chip tone={format === 'external' ? 'accent' : 'info'}>
                {format === 'external' ? '外部格式' : 'CharaVerse 格式'}
              </Chip>
              <Chip tone="outline">{summary.total} 条目</Chip>
              <Chip tone="outline">{summary.enabled} 启用</Chip>
              <Chip tone="outline">{summary.markers} 占位</Chip>
              <Chip tone="outline">≈{summary.tokens} tokens</Chip>
            </div>
            <div className="text-xs text-cv-fg-muted">{summary.sampling}</div>
            <div className="space-y-1.5">
              <Label htmlFor="cv-preset-name">名称</Label>
              <Input id="cv-preset-name" value={name} maxLength={80} onChange={(e) => setNameOverride(e.target.value)} />
            </div>
          </div>
        )}

        {saveError && <p className="text-xs text-cv-danger">{saveError}</p>}
      </div>

      <DialogFooter className="gap-2">
        <Button type="button" variant="ghost" onClick={onClose}>
          取消
        </Button>
        <Button type="button" onClick={submit} disabled={!parsed?.ok || saving}>
          {saving && <Loader2 className="animate-spin" />}
          导入
        </Button>
      </DialogFooter>
    </>
  )
}
