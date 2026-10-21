'use client'

import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { GlassPanel } from '@/components/glass'
import { Field, SectionHeader } from './Field'
import { AvatarField } from './AvatarField'
import { KeywordInput } from './KeywordInput'
import { GENDER_OPTIONS, type CharacterDraft, type DraftErrors, type Gender } from './types'

interface Props {
  draft: CharacterDraft
  errors: DraftErrors
  onChange: <K extends keyof CharacterDraft>(key: K, value: CharacterDraft[K]) => void
}

export function BasicInfoSection({ draft, errors, onChange }: Props) {
  return (
    <section aria-labelledby="sec-basic">
      <SectionHeader title="基本信息" description="名字、形象和一段给 AI 看的设定。" />
      <GlassPanel className="space-y-5">
        <AvatarField value={draft.avatar_url} name={draft.name} onChange={(v) => onChange('avatar_url', v)} />

        <Field id="cf-name" label="角色名称" required error={errors.name}>
          <Input id="cf-name" value={draft.name} onChange={(e) => onChange('name', e.target.value)} placeholder="给角色起个名字" maxLength={100} aria-invalid={!!errors.name} />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field id="cf-gender" label="性别">
            <Select value={draft.gender} onValueChange={(v) => onChange('gender', v as Gender)}>
              <SelectTrigger id="cf-gender" className="w-full"><SelectValue placeholder="选择性别" /></SelectTrigger>
              <SelectContent>
                {GENDER_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </Field>
          <Field id="cf-age" label="年龄">
            <Input id="cf-age" value={draft.age} onChange={(e) => onChange('age', e.target.value)} placeholder="例如：25 或 未知" maxLength={40} />
          </Field>
        </div>

        <Field id="cf-description" label="角色设定" hint="外貌、背景、经历……这段只给 AI 看，不会公开显示。" error={errors.content}>
          <Textarea id="cf-description" value={draft.description} onChange={(e) => onChange('description', e.target.value)} placeholder="详细描述这个角色是谁" className="min-h-36" aria-invalid={!!errors.content} />
        </Field>

        <Field id="cf-personality" label="性格" hint="说话方式、脾气、口癖。单独列出来，AI 会更稳定地保持。">
          <Textarea id="cf-personality" value={draft.personality} onChange={(e) => onChange('personality', e.target.value)} placeholder="例如：嘴硬心软，喜欢用反问句" className="min-h-24" />
        </Field>

        <Field id="cf-keywords" label="关键词" hint="用于搜索和角色卡上的标签，最多 20 个。">
          <KeywordInput id="cf-keywords" value={draft.keywords} onChange={(v) => onChange('keywords', v)} />
        </Field>

        <Field id="cf-introduction" label="角色简介" hint="发布后别人在探索页看到的介绍：特色、适合什么场景。">
          <Textarea id="cf-introduction" value={draft.introduction} onChange={(e) => onChange('introduction', e.target.value)} placeholder="一两句话介绍这个角色" className="min-h-24" />
        </Field>
      </GlassPanel>
    </section>
  )
}
