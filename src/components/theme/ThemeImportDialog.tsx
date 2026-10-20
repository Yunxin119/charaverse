'use client'

import { useRef, useState } from 'react'
import { Upload, Loader2 } from 'lucide-react'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Chip } from '@/components/glass'
import { parseTheme, type ThemeFile } from '@/lib/theme/schema'

interface Props {
  open: boolean
  onOpenChange: (v: boolean) => void
  onImport: (theme: ThemeFile) => Promise<void>
}

export function ThemeImportDialog({ open, onOpenChange, onImport }: Props) {
  const [json, setJson] = useState('')
  const [name, setName] = useState('')
  const [parsed, setParsed] = useState<ThemeFile | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const tryParse = (text: string) => {
    setJson(text)
    setParsed(null); setError(null)
    if (!text.trim()) return
    try {
      const r = parseTheme(JSON.parse(text))
      if (r.ok) { setParsed(r.theme); setName(r.theme.name) } else setError(r.error)
    } catch { setError('JSON 格式错误') }
  }

  const pickFile = async (f: File) => tryParse(await f.text())

  const submit = async () => {
    if (!parsed) return
    setSaving(true)
    try {
      await onImport({ ...parsed, name: name.trim() || parsed.name })
      onOpenChange(false)
      setJson(''); setParsed(null); setName('')
    } catch (e) {
      setError((e as Error).message || '导入失败')
    } finally { setSaving(false) }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="font-display text-xl">导入主题</DialogTitle>
          <DialogDescription>粘贴主题 JSON，或选择一个 .json 文件。主题只覆盖颜色、圆角、字体和玻璃参数，不包含代码。</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <input ref={fileRef} type="file" accept="application/json,.json" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) void pickFile(f); e.target.value = '' }} />
            <Button variant="neu" size="sm" onClick={() => fileRef.current?.click()}><Upload /> 选择文件</Button>
            {parsed && <Chip tone="success">已识别 · {Object.keys(parsed.tokens).length} 个颜色覆盖 · {parsed.mode === 'dark' ? '深色' : '浅色'}</Chip>}
          </div>
          <Textarea value={json} onChange={(e) => tryParse(e.target.value)} placeholder='{ "name": "我的主题", "mode": "light", "tokens": { "primary": "#41140e" } }' className="min-h-40 font-mono text-xs" />
          {parsed && (
            <div className="space-y-1.5">
              <Label htmlFor="theme-name">名称</Label>
              <Input id="theme-name" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
          )}
          {error && <p className="text-sm text-cv-danger">{error}</p>}
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => onOpenChange(false)}>取消</Button>
            <Button disabled={!parsed || saving} onClick={submit}>{saving ? <Loader2 className="animate-spin" /> : null}导入并应用</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
