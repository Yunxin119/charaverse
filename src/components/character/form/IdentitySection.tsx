'use client'

import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { GlassPanel } from '@/components/glass'
import { Field } from './Field'
import { AvatarField } from './AvatarField'
import { KeywordInput } from './KeywordInput'
import { WriterField } from './WriterField'
import { GENDER_OPTIONS, type CharacterDraft, type DraftErrors, type Gender } from './types'

interface Props {
  draft: CharacterDraft
  errors: DraftErrors
  onChange: <K extends keyof CharacterDraft>(key: K, value: CharacterDraft[K]) => void
}

/** 身份：name, avatar, tags and the public blurb. Everything here is visible to others once published. */
export function IdentitySection({ draft, errors, onChange }: Props) {
  return (
    <GlassPanel className="space-y-5">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
        <AvatarField value={draft.avatar_url} name={draft.name} onChange={(v) => onChange('avatar_url', v)} />
        <div className="min-w-0 flex-1 space-y-4">
          <Field id="cf-name" label="名字" required error={errors.name}>
            <Input id="cf-name" value={draft.name} onChange={(e) => onChange('name', e.target.value)} placeholder="角色叫什么" maxLength={100} aria-invalid={!!errors.name} className="text-lg font-semibold" />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field id="cf-gender" label="性别">
              <Select value={draft.gender} onValueChange={(v) => onChange('gender', v as Gender)}>
                <SelectTrigger id="cf-gender" className="w-full"><SelectValue placeholder="选择性别" /></SelectTrigger>
                <SelectContent>{GENDER_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
              </Select>
            </Field>
            <Field id="cf-age" label="年龄">
              <Input id="cf-age" value={draft.age} onChange={(e) => onChange('age', e.target.value)} placeholder="例如：25 或 未知" maxLength={40} />
            </Field>
          </div>
        </div>
      </div>
      <Field id="cf-keywords" label="标签" hint="探索页的标签和搜索词，最多 20 个。">
        <KeywordInput id="cf-keywords" value={draft.keywords} onChange={(v) => onChange('keywords', v)} />
      </Field>
      <WriterField id="cf-introduction" label="公开简介" hint="发布后别人在探索页看到的介绍：特色、适合什么场景。不会进入提示词。" value={draft.introduction} onChange={(v) => onChange('introduction', v)} placeholder="一两句话介绍这个角色" minRows={2} />
    </GlassPanel>
  )
}
