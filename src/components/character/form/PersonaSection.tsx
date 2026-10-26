'use client'

import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { GlassPanel } from '@/components/glass'
import { Field } from './Field'
import { WriterField } from './WriterField'
import { GENDER_OPTIONS, type DraftPersona, type Gender } from './types'

interface Props {
  value: DraftPersona
  onChange: (next: DraftPersona) => void
}

/** 用户人设：who {{user}} is in this story. Players can override the name per session. */
export function PersonaSection({ value, onChange }: Props) {
  const set = <K extends keyof DraftPersona>(k: K, v: DraftPersona[K]) => onChange({ ...value, [k]: v })
  return (
    <GlassPanel className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <Field id="cf-persona-name" label="称呼" hint="对话里 {{user}} 会替换成它；玩家可在会话设置里改">
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
        hint="{{user}} 的背景、性格、和角色的关系。进入提示词的「用户人设」块。"
        value={value.details}
        onChange={(v) => set('details', v)}
        placeholder="例如：刚搬来这座城市的实习生，和 {{char}} 是同一栋楼的邻居。"
        minRows={4}
        macros
      />
    </GlassPanel>
  )
}
