'use client'

import { useMemo, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Chip } from '@/components/glass'
import {
  MEMORY_FIELD_SCHEMAS,
  MEMORY_TYPES,
  MEMORY_CONTENT_MAX,
  MEMORY_TITLE_MAX,
  importanceTier,
  memorySchema,
  type FieldDef,
  type MemoryEntry,
  type MemoryInput,
  type MemoryMetadata,
  type MemoryType,
} from '@/lib/memory/types'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** editing an existing memory locks the type */
  initial?: MemoryEntry | null
  defaultType?: MemoryType
  saving?: boolean
  onSubmit: (values: MemoryInput) => Promise<void>
}

const EMPTY: MemoryInput = { type: 'character', title: '', content: '', importance: 5, metadata: {} }

const splitTags = (s: string) => s.split(/[,，、\n]/).map((t) => t.trim()).filter(Boolean)
const joinTags = (v: unknown) => (Array.isArray(v) ? v.map(String).join('，') : typeof v === 'string' ? v : '')

/** One schema-driven field. Values live in `metadata[field.key]`. */
function MetaField({ field, value, onChange }: { field: FieldDef; value: unknown; onChange: (v: unknown) => void }) {
  const id = `cv-mem-${field.key}`
  const label = (
    <Label htmlFor={id} className="text-xs text-cv-fg-muted">
      {field.label}{field.required && <span className="text-cv-danger">*</span>}
    </Label>
  )
  switch (field.kind) {
    case 'textarea':
      return (
        <div className="space-y-1.5 sm:col-span-2">{label}
          <Textarea id={id} rows={2} value={typeof value === 'string' ? value : ''} placeholder={field.placeholder} onChange={(e) => onChange(e.target.value)} />
        </div>
      )
    case 'number':
      return (
        <div className="space-y-1.5">{label}
          <Input id={id} type="number" inputMode="numeric" min={field.min} max={field.max} placeholder={field.placeholder}
            value={value === undefined || value === null || value === '' ? '' : String(value)}
            onChange={(e) => onChange(e.target.value === '' ? undefined : Number(e.target.value))} />
        </div>
      )
    case 'select':
      return (
        <div className="space-y-1.5">{label}
          <Select value={typeof value === 'string' ? value : ''} onValueChange={(v) => onChange(v)}>
            <SelectTrigger id={id} className="w-full"><SelectValue placeholder="选择…" /></SelectTrigger>
            <SelectContent>
              {field.options?.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      )
    case 'tags':
      return (
        <div className="space-y-1.5 sm:col-span-2">{label}
          <Input id={id} value={joinTags(value)} placeholder={field.placeholder ?? '用逗号分隔'} onChange={(e) => onChange(e.target.value)} onBlur={(e) => onChange(splitTags(e.target.value))} />
        </div>
      )
    case 'date':
      return (
        <div className="space-y-1.5">{label}
          <Input id={id} type="date" value={typeof value === 'string' ? value : ''} onChange={(e) => onChange(e.target.value)} />
        </div>
      )
    default:
      return (
        <div className="space-y-1.5">{label}
          <Input id={id} value={typeof value === 'string' || typeof value === 'number' ? String(value) : ''} placeholder={field.placeholder} onChange={(e) => onChange(e.target.value)} />
        </div>
      )
  }
}

/** Add / edit dialog for one memory. Fields below the fold come from `MEMORY_FIELD_SCHEMAS[type]`. */
export function MemoryForm({ open, onOpenChange, initial, defaultType, saving, onSubmit }: Props) {
  const editing = !!initial
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[88dvh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="font-display text-xl">{editing ? '编辑记忆' : '添加记忆'}</DialogTitle>
          <DialogDescription>{editing ? '修改后会覆盖当前版本的内容。' : '手动添加的记忆会和摘要提取的记忆一起进入上下文。'}</DialogDescription>
        </DialogHeader>
        {/* state lives in the body so it resets whenever the dialog (re)mounts */}
        <FormBody key={initial?.id ?? 'new'} initial={initial} defaultType={defaultType} saving={saving} onSubmit={onSubmit} onClose={() => onOpenChange(false)} />
      </DialogContent>
    </Dialog>
  )
}

function FormBody({ initial, defaultType, saving, onSubmit, onClose }: Omit<Props, 'open' | 'onOpenChange'> & { onClose: () => void }) {
  const editing = !!initial
  const [values, setValues] = useState<MemoryInput>(() => initial
    ? { type: initial.type, title: initial.title, content: initial.content, importance: initial.importance ?? 5, metadata: { ...(initial.metadata ?? {}) } }
    : { ...EMPTY, type: defaultType ?? EMPTY.type, metadata: {} })
  const [error, setError] = useState<string | null>(null)

  const fields = useMemo(() => MEMORY_FIELD_SCHEMAS[values.type] ?? [], [values.type])
  const tier = importanceTier(values.importance)

  const setMeta = (key: string, v: unknown) =>
    setValues((s) => {
      const metadata: MemoryMetadata = { ...s.metadata }
      if (v === undefined || v === '') delete metadata[key]
      else metadata[key] = v
      return { ...s, metadata }
    })

  const submit = async () => {
    setError(null)
    // normalise tags typed but not blurred
    const metadata: MemoryMetadata = { ...values.metadata }
    for (const f of fields) {
      if (f.kind === 'tags' && typeof metadata[f.key] === 'string') metadata[f.key] = splitTags(metadata[f.key] as string)
      if (f.required) {
        const v = metadata[f.key]
        if (v === undefined || v === null || v === '' || (Array.isArray(v) && v.length === 0)) { setError(`请填写「${f.label}」`); return }
      }
    }
    const parsed = memorySchema.safeParse({ ...values, metadata })
    if (!parsed.success) { setError(parsed.error.issues[0]?.message ?? '请检查输入'); return }
    try {
      await onSubmit(parsed.data)
      onClose()
    } catch (e) {
      setError((e as Error).message || '保存失败')
    }
  }

  return (
    <>
      <div className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="cv-mem-type">类型</Label>
            <Select value={values.type} disabled={editing} onValueChange={(v) => setValues((s) => ({ ...s, type: v as MemoryType, metadata: {} }))}>
              <SelectTrigger id="cv-mem-type" className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>
                {MEMORY_TYPES.map((t) => <SelectItem key={t.id} value={t.id}>{t.emoji} {t.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="cv-mem-importance">重要度</Label>
              <span className="flex items-center gap-1.5 text-xs text-cv-fg-muted">
                <Chip tone={tier.tone} className="px-2 py-0.5">{tier.label}</Chip>
                <span className="font-mono">{values.importance}/10</span>
              </span>
            </div>
            <input id="cv-mem-importance" type="range" min={1} max={10} step={1} value={values.importance}
              onChange={(e) => setValues((s) => ({ ...s, importance: Number(e.target.value) }))}
              className="h-11 w-full accent-cv-accent" />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="cv-mem-title">标题 <span className="text-cv-danger">*</span></Label>
          <Input id="cv-mem-title" maxLength={MEMORY_TITLE_MAX} value={values.title} placeholder="一句话概括" onChange={(e) => setValues((s) => ({ ...s, title: e.target.value }))} />
        </div>
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <Label htmlFor="cv-mem-content">内容 <span className="text-cv-danger">*</span></Label>
            <span className="font-mono text-[11px] text-cv-fg-subtle">{values.content.length}/{MEMORY_CONTENT_MAX}</span>
          </div>
          <Textarea id="cv-mem-content" rows={4} maxLength={MEMORY_CONTENT_MAX} value={values.content} placeholder="记忆的具体内容" onChange={(e) => setValues((s) => ({ ...s, content: e.target.value }))} />
        </div>

        {fields.length > 0 && (
          <section className="neu-in rounded-cv-lg p-4">
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-[0.14em] text-cv-fg-subtle">详细字段</h3>
            <div className="grid gap-3 sm:grid-cols-2">
              {fields.map((f) => <MetaField key={f.key} field={f} value={values.metadata[f.key]} onChange={(v) => setMeta(f.key, v)} />)}
            </div>
          </section>
        )}

        {error && <p role="alert" className="text-sm text-cv-danger">{error}</p>}
      </div>

      <DialogFooter className="gap-2">
        <Button type="button" variant="ghost" onClick={onClose} disabled={saving}>取消</Button>
        <Button type="button" variant="accent" onClick={() => void submit()} disabled={saving}>
          {saving && <Loader2 className="animate-spin" />}{editing ? '保存' : '添加'}
        </Button>
      </DialogFooter>
    </>
  )
}
