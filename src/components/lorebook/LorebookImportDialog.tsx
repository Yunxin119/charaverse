'use client'

import { useMemo, useRef, useState } from 'react'
import { FileJson, Upload } from 'lucide-react'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Chip } from '@/components/glass'
import { importLorebookJson, type Lorebook } from '@/lib/lorebook/schema'

const MAX_FILE_BYTES = 4 * 1024 * 1024

export type LorebookImportMode = 'replace' | 'append'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** when true the dialog offers 替换 / 追加; otherwise a single 导入 */
  hasExisting: boolean
  onImport: (book: Lorebook, mode: LorebookImportMode) => void | Promise<void>
}

/** Paste or pick a `.json` world book (our format or the common external world-info format). */
export function LorebookImportDialog({ open, onOpenChange, hasExisting, onImport }: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="font-display text-xl">导入世界书</DialogTitle>
          <DialogDescription>
            粘贴 JSON 或选择 <code className="font-mono text-xs">.json</code> 文件。自动识别通用世界书格式与 CharaVerse 格式。
          </DialogDescription>
        </DialogHeader>
        {open && <ImportBody hasExisting={hasExisting} onImport={onImport} onClose={() => onOpenChange(false)} />}
      </DialogContent>
    </Dialog>
  )
}

function ImportBody({ hasExisting, onImport, onClose }: { hasExisting: boolean; onImport: Props['onImport']; onClose: () => void }) {
  const [text, setText] = useState('')
  const [fileName, setFileName] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const parsed = useMemo(() => (text.trim() ? importLorebookJson(text) : null), [text])

  const pickFile = async (file: File) => {
    setError(null)
    if (file.size > MAX_FILE_BYTES) {
      setText('')
      setFileName(null)
      setError(`文件过大（${Math.round(file.size / 1024)} KB，上限 ${MAX_FILE_BYTES / 1024} KB）`)
      return
    }
    try {
      setText(await file.text())
      setFileName(file.name)
    } catch {
      setError('读取文件失败')
    }
  }

  const run = async (mode: LorebookImportMode) => {
    if (!parsed?.ok) return
    setBusy(true)
    setError(null)
    try {
      await onImport(parsed.book, mode)
      onClose()
    } catch (e) {
      setError((e as Error).message || '导入失败')
      setBusy(false)
    }
  }

  const book = parsed?.ok ? parsed.book : null
  const constant = book ? book.entries.filter((e) => e.constant).length : 0

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
          <Button type="button" variant="neu" size="sm" onClick={() => fileRef.current?.click()}><Upload /> 选择文件</Button>
          {fileName && <span className="inline-flex items-center gap-1 text-xs text-cv-fg-muted"><FileJson className="size-3.5" /> {fileName}</span>}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="cv-lorebook-json">世界书 JSON</Label>
          <Textarea
            id="cv-lorebook-json"
            value={text}
            onChange={(e) => { setText(e.target.value); setFileName(null); setError(null) }}
            placeholder='{ "entries": [ { "keys": ["..."], "content": "..." } ] }'
            spellCheck={false}
            className="max-h-64 min-h-40 font-mono text-xs leading-relaxed"
          />
        </div>

        {parsed && !parsed.ok && (
          <div className="max-h-40 overflow-y-auto rounded-cv-md border border-cv-danger/30 bg-cv-danger/8 px-3 py-2 text-xs break-words whitespace-pre-wrap text-cv-danger">{parsed.error}</div>
        )}

        {book && (
          <div className="neu space-y-2 rounded-cv-md p-4">
            <div className="flex flex-wrap items-center gap-2">
              {book.name && <span className="font-display text-base font-semibold">{book.name}</span>}
              <Chip tone="outline">{book.entries.length} 条目</Chip>
              <Chip tone="outline">{book.entries.filter((e) => e.enabled).length} 启用</Chip>
              {constant > 0 && <Chip tone="outline">{constant} 常驻</Chip>}
              <Chip tone="outline">扫描 {book.scanDepth} 条</Chip>
            </div>
            {hasExisting && <p className="text-xs text-cv-fg-muted">「追加」把这些条目加到现有条目后面；「替换」丢弃现有条目和设置。</p>}
          </div>
        )}

        {error && <p className="text-xs text-cv-danger">{error}</p>}
      </div>

      <DialogFooter className="gap-2">
        <Button type="button" variant="ghost" onClick={onClose}>取消</Button>
        {hasExisting ? (
          <>
            <Button type="button" variant="neu" disabled={!book || busy} onClick={() => run('append')}>追加条目</Button>
            <Button type="button" disabled={!book || busy} onClick={() => run('replace')}>替换全部</Button>
          </>
        ) : (
          <Button type="button" disabled={!book || busy} onClick={() => run('replace')}>导入</Button>
        )}
      </DialogFooter>
    </>
  )
}
