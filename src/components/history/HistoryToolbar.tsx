'use client'

import { useState } from 'react'
import { Hash, Search } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Chip } from '@/components/glass'
import { cn } from '@/lib/utils'

export type RoleFilter = 'all' | 'user' | 'assistant'

interface Props {
  query: string
  onQueryChange: (q: string) => void
  role: RoleFilter
  onRoleChange: (r: RoleFilter) => void
  userLabel: string
  characterLabel: string
  onJump: (id: number) => void
  jumping: boolean
}

export function HistoryToolbar({ query, onQueryChange, role, onRoleChange, userLabel, characterLabel, onJump, jumping }: Props) {
  const [jump, setJump] = useState('')
  const submitJump = (e: React.FormEvent) => {
    e.preventDefault()
    const id = Number(jump.replace(/^#/, '').trim())
    if (Number.isInteger(id) && id > 0) onJump(id)
  }
  const filters: { id: RoleFilter; label: string }[] = [
    { id: 'all', label: '全部' },
    { id: 'user', label: userLabel },
    { id: 'assistant', label: characterLabel },
  ]
  return (
    <div className="mb-5 space-y-3">
      <div className="flex flex-col gap-2 sm:flex-row">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute inset-y-0 left-4 my-auto size-4 text-cv-fg-subtle" />
          <Input value={query} onChange={(e) => onQueryChange(e.target.value)} placeholder="搜索已加载的消息…" className="pl-11" aria-label="搜索消息" />
        </div>
        <form onSubmit={submitJump} className="relative sm:w-44">
          <Hash className="pointer-events-none absolute inset-y-0 left-4 my-auto size-4 text-cv-fg-subtle" />
          <Input
            value={jump}
            onChange={(e) => setJump(e.target.value)}
            inputMode="numeric"
            placeholder="跳到消息 id"
            aria-label="跳到消息 id"
            className="pl-11 font-mono"
            disabled={jumping}
          />
        </form>
      </div>
      <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="按角色筛选">
        {filters.map((f) => (
          <Chip
            key={f.id}
            role="radio"
            aria-checked={role === f.id}
            tabIndex={0}
            interactive
            tone={role === f.id ? 'primary' : 'outline'}
            onClick={() => onRoleChange(f.id)}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onRoleChange(f.id) } }}
            className={cn('max-w-40 truncate', role !== f.id && 'hover:text-cv-fg')}
          >
            {f.label}
          </Chip>
        ))}
      </div>
    </div>
  )
}
