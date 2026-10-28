'use client'

import { useState } from 'react'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Field } from '@/components/character/form/Field'
import { AvatarField } from '@/components/character/form/AvatarField'
import { WriterField } from '@/components/character/form/WriterField'
import { GENDER_OPTIONS } from '@/components/character/form/types'
import { formatPersonaText, type PersonaGender } from '@/lib/personas/format'
import { estimateTokens } from '@/lib/prompt/tokens'
import type { PersonaInput, PersonaRow } from '@/queries/usePersonas'

export interface PersonaDraft {
  name: string
  avatar_url: string
  age: string
  gender: PersonaGender
  details: string
}

export const emptyPersonaDraft = (): PersonaDraft => ({ name: '', avatar_url: '', age: '', gender: '', details: '' })

export function draftFromPersona(p: PersonaRow | null | undefined): PersonaDraft {
  return p ? { name: p.name, avatar_url: p.avatar_url ?? '', age: p.age, gender: p.gender, details: p.details } : emptyPersonaDraft()
}

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** existing row to edit, or a prefilled draft for a new one */
  initial?: PersonaRow | PersonaDraft | null
  saving?: boolean
  onSave: (input: PersonaInput) => Promise<unknown>
}

const isRow = (v: PersonaRow | PersonaDraft): v is PersonaRow => 'id' in v

/** Create / edit one persona. The row is written on 保存; avatar uploads go to `avatars/personas`. */
export function PersonaEditorDialog({ open, onOpenChange, initial, saving, onSave }: Props) {
  const editingId = initial && isRow(initial) ? initial.id : undefined
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="font-display text-xl">{editingId ? '编辑人设' : '新建人设'}</DialogTitle>
          <DialogDescription>故事里的「你」。对话里的 {'{{user}}'} 会换成这个名字，设定进入提示词的「用户人设」块。</DialogDescription>
        </DialogHeader>
        {/* mounted per open so the draft starts from `initial` without an effect */}
        {open && <EditorBody initial={initial ?? null} editingId={editingId} saving={saving} onSave={onSave} onClose={() => onOpenChange(false)} />}
      </DialogContent>
    </Dialog>
  )
}

function EditorBody({ initial, editingId, saving, onSave, onClose }: { initial: PersonaRow | PersonaDraft | null; editingId?: string; saving?: boolean; onSave: Props['onSave']; onClose: () => void }) {
  const [draft, setDraft] = useState<PersonaDraft>(() => (initial ? (isRow(initial) ? draftFromPersona(initial) : initial) : emptyPersonaDraft()))
  const [error, setError] = useState<string | null>(null)
  const set = <K extends keyof PersonaDraft>(k: K, v: PersonaDraft[K]) => setDraft((d) => ({ ...d, [k]: v }))
  // what the 「用户人设」 block will cost: name line + formatted fields
  const promptText = `名字：${draft.name.trim() || '…'}\n${formatPersonaText(draft) ?? ''}`.trim()
  const promptTokens = estimateTokens(promptText)

  const save = async () => {
    if (!draft.name.trim()) { setError('人设需要一个名字'); return }
    setError(null)
    try {
      await onSave({ id: editingId, name: draft.name, avatar_url: draft.avatar_url || null, age: draft.age, gender: draft.gender, details: draft.details })
      toast.success(editingId ? '人设已更新' : '人设已创建')
      onClose()
    } catch (e) {
      setError((e as Error).message || '保存失败，请重试')
    }
  }

  return (
    <>
      <div className="space-y-4">
        <AvatarField value={draft.avatar_url} name={draft.name} onChange={(v) => set('avatar_url', v)} folder="personas" size="md" />
        <div className="grid gap-3 sm:grid-cols-3">
          <Field id="cv-persona-name" label="名字" required error={error ?? undefined}>
            <Input id="cv-persona-name" value={draft.name} onChange={(e) => set('name', e.target.value)} placeholder="你在故事里叫什么" maxLength={60} autoFocus />
          </Field>
          <Field id="cv-persona-age" label="年龄">
            <Input id="cv-persona-age" value={draft.age} onChange={(e) => set('age', e.target.value)} placeholder="可留空" maxLength={40} />
          </Field>
          <Field id="cv-persona-gender" label="性别">
            <Select value={draft.gender || '__unset__'} onValueChange={(v) => set('gender', v === '__unset__' ? '' : (v as PersonaGender))}>
              <SelectTrigger id="cv-persona-gender" className="w-full"><SelectValue placeholder="选择性别" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__unset__">不写</SelectItem>
                {GENDER_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </Field>
        </div>
        <WriterField
          id="cv-persona-details"
          label="设定"
          hint="背景、性格、说话方式。可以用 {{char}} 指代对话的角色，同一个人设就能配不同角色。"
          value={draft.details}
          onChange={(v) => set('details', v)}
          placeholder="例如：刚搬来这座城市的实习生，嘴硬心软，和 {{char}} 住同一栋楼。"
          minRows={5}
          macros
        />
      </div>
      <div className="flex items-center justify-end gap-2">
        <span className="mr-auto text-[11px] text-cv-fg-subtle" title="进入提示词「用户人设」块的全部文字（名字 + 性别 / 年龄 + 设定）">进入提示词约 {promptTokens} tok</span>
        <Button variant="ghost" onClick={onClose} disabled={saving}>取消</Button>
        <Button onClick={() => void save()} disabled={saving}>{saving ? <Loader2 className="animate-spin" /> : null} 保存</Button>
      </div>
    </>
  )
}
