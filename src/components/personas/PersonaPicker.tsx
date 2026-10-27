'use client'

import Link from 'next/link'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { usePersonas, type PersonaRow } from '@/queries/usePersonas'
import { cn } from '@/lib/utils'

const INHERIT = '__inherit__'
const NONE = '__none__'

interface Props {
  userId: string | undefined
  /** `undefined` = inherit (binding / default), `null` = no persona (only when `allowNone`), string = that persona */
  value: string | null | undefined
  onChange: (next: string | null | undefined) => void
  /** label of the inherit option, e.g. 「跟随默认人设」 */
  inheritLabel: string
  /** what inheriting resolves to right now, shown under the inherit label */
  inheritHint?: string
  allowNone?: boolean
  disabled?: boolean
  id?: string
  className?: string
}

/** Choose one of the user's personas. Shows a 「去创建」 link when there are none yet. */
export function PersonaPicker({ userId, value, onChange, inheritLabel, inheritHint, allowNone, disabled, id, className }: Props) {
  const personasQ = usePersonas(userId)
  const personas = personasQ.data ?? []
  const selectValue = value === undefined ? INHERIT : value === null ? NONE : personas.some((p) => p.id === value) ? value : INHERIT

  if (personasQ.isSuccess && personas.length === 0) {
    return (
      <p className={cn('text-xs text-cv-fg-muted', className)}>
        还没有人设。<Link href="/settings/personas" className="text-cv-accent underline-offset-4 hover:underline">去「我的人设」创建一个</Link>，之后这里就能选。
      </p>
    )
  }

  return (
    <div className={cn('space-y-1.5', className)}>
      <Select value={selectValue} onValueChange={(v) => onChange(v === INHERIT ? undefined : v === NONE ? null : v)} disabled={disabled || personasQ.isLoading}>
        <SelectTrigger id={id} className="w-full"><SelectValue placeholder="选择人设" /></SelectTrigger>
        <SelectContent>
          <SelectItem value={INHERIT}>
            <span className="flex flex-col">
              <span>{inheritLabel}</span>
              {inheritHint && <span className="text-[11px] text-cv-fg-subtle">{inheritHint}</span>}
            </span>
          </SelectItem>
          {personas.map((p) => (
            <SelectItem key={p.id} value={p.id}><PersonaOption persona={p} /></SelectItem>
          ))}
          {allowNone && <SelectItem value={NONE}>不用人设（只用角色卡里写的「你」）</SelectItem>}
        </SelectContent>
      </Select>
      <p className="text-[11px] text-cv-fg-subtle">
        人设在<Link href="/settings/personas" className="text-cv-accent underline-offset-4 hover:underline">「我的人设」</Link>里统一管理。
      </p>
    </div>
  )
}

function PersonaOption({ persona }: { persona: PersonaRow }) {
  return (
    <span className="flex items-center gap-2">
      <Avatar className="size-5">
        <AvatarImage src={persona.avatar_url ?? undefined} alt="" />
        <AvatarFallback className="bg-cv-secondary text-[10px] text-cv-secondary-fg">{persona.name.slice(0, 1)}</AvatarFallback>
      </Avatar>
      <span>{persona.name}</span>
      {persona.is_default && <span className="text-[11px] text-cv-fg-subtle">默认</span>}
    </span>
  )
}
