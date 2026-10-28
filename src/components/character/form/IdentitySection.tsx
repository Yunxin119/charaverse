'use client'

import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { AvatarField } from './AvatarField'
import { KeywordInput } from './KeywordInput'
import { WriterField } from './WriterField'
import { GENDER_OPTIONS, type CharacterDraft, type DraftErrors, type Gender } from './types'
import { cn } from '@/lib/utils'

interface Props {
  draft: CharacterDraft
  errors: DraftErrors
  onChange: <K extends keyof CharacterDraft>(key: K, value: CharacterDraft[K]) => void
}

/**
 * The cover of the card: avatar tile, the name as the document title, gender / age,
 * tags and the public blurb. Everything here is what others see once published.
 */
export function IdentitySection({ draft, errors, onChange }: Props) {
  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:gap-7">
        <AvatarField variant="tile" value={draft.avatar_url} name={draft.name} onChange={(v) => onChange('avatar_url', v)} />
        <div className="min-w-0 flex-1 space-y-4 sm:pt-1">
          <div>
            <input
              id="cf-name"
              value={draft.name}
              onChange={(e) => onChange('name', e.target.value)}
              placeholder="角色的名字"
              maxLength={100}
              aria-label="名字"
              aria-invalid={!!errors.name}
              autoComplete="off"
              className={cn(
                'w-full border-b bg-transparent py-1 font-display text-3xl font-semibold tracking-tight text-cv-fg outline-none transition-colors duration-(--cv-dur-fast) placeholder:text-cv-fg-subtle/60 sm:text-4xl',
                errors.name ? 'border-cv-danger' : 'border-cv-border focus:border-cv-accent'
              )}
            />
            {errors.name && <p role="alert" className="mt-1.5 text-xs text-cv-danger">{errors.name}</p>}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Select value={draft.gender} onValueChange={(v) => onChange('gender', v as Gender)}>
              <SelectTrigger id="cf-gender" aria-label="性别" className="h-9 w-28 text-sm"><SelectValue placeholder="性别" /></SelectTrigger>
              <SelectContent>{GENDER_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
            </Select>
            <Input id="cf-age" aria-label="年龄" value={draft.age} onChange={(e) => onChange('age', e.target.value)} placeholder="年龄" maxLength={40} className="h-9 w-28 text-sm" />
            <span className="text-xs text-cv-fg-subtle">都可以留空</span>
          </div>
          <KeywordInput id="cf-keywords" value={draft.keywords} onChange={(v) => onChange('keywords', v)} placeholder="标签：回车添加，最多 20 个" />
        </div>
      </div>
      <WriterField
        id="cf-introduction"
        label="公开简介"
        hint="发布后别人在探索页看到的介绍：特色、适合什么场景。不会进入提示词。"
        value={draft.introduction}
        onChange={(v) => onChange('introduction', v)}
        placeholder="一两句话介绍这个角色，给探索页看的"
        minRows={2}
      />
    </div>
  )
}
