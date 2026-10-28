'use client'

import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Field } from './Field'
import { WriterField } from './WriterField'
import { GENDER_OPTIONS, type DraftPersona, type Gender } from './types'

interface Props {
  value: DraftPersona
  onChange: (next: DraftPersona) => void
}

/** The card's own (legacy) user persona. Only shown while an old card still carries one. */
export function PersonaSection({ value, onChange }: Props) {
  const set = <K extends keyof DraftPersona>(k: K, v: DraftPersona[K]) => onChange({ ...value, [k]: v })
  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <Field id="cf-persona-name" label="称呼">
          <Input id="cf-persona-name" value={value.name} onChange={(e) => set('name', e.target.value)} placeholder="留空则叫「用户」" maxLength={60} />
        </Field>
        <Field id="cf-persona-age" label="年龄">
          <Input id="cf-persona-age" value={value.age} onChange={(e) => set('age', e.target.value)} placeholder="可留空" maxLength={40} />
        </Field>
        <Field id="cf-persona-gender" label="性别">
          <Select value={value.gender} onValueChange={(v) => set('gender', v as Gender)}>
            <SelectTrigger id="cf-persona-gender" className="w-full"><SelectValue placeholder="选择性别" /></SelectTrigger>
            <SelectContent>{GENDER_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
          </Select>
        </Field>
      </div>
      <WriterField
        id="cf-persona-details"
        label="设定"
        hint="{{user}} 的背景、性格、和角色的关系。只在玩家没选任何人设时兜底。"
        value={value.details}
        onChange={(v) => set('details', v)}
        placeholder="例如：刚搬来这座城市的实习生，和 {{char}} 是同一栋楼的邻居。"
        minRows={4}
        macros
      />
    </div>
  )
}
