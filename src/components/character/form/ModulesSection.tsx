'use client'

import { ChevronDown, ChevronUp, LayoutList, Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Chip, GlassPanel, IconButton, NeuSurface } from '@/components/glass'
import { Field, SectionHeader } from './Field'
import {
  GENDER_OPTIONS, MODULE_HINT, MODULE_TYPES, newModule,
  type DraftModule, type Gender, type ModuleType,
} from './types'

interface Props {
  modules: DraftModule[]
  error?: string
  onChange: (next: DraftModule[]) => void
}

const TONE: Record<ModuleType, 'primary' | 'accent' | 'warning' | 'info' | 'flat'> = {
  用户角色设定: 'primary',
  初始情景: 'accent',
  注意事项: 'warning',
  特殊要求: 'info',
  自定义模块: 'flat',
}

export function ModulesSection({ modules, error, onChange }: Props) {
  const add = (type: ModuleType) => onChange([...modules, newModule(type)])
  const patch = (id: string, p: Partial<DraftModule>) => onChange(modules.map((m) => (m.id === id ? { ...m, ...p } : m)))
  const remove = (id: string) => onChange(modules.filter((m) => m.id !== id))
  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir
    if (j < 0 || j >= modules.length) return
    const next = [...modules]
    ;[next[i], next[j]] = [next[j], next[i]]
    onChange(next)
  }

  const addMenu = (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button type="button" variant="accent" size="sm"><Plus />添加模块</Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        {MODULE_TYPES.map((t) => (
          <DropdownMenuItem key={t} onSelect={() => add(t)} className="flex-col items-start gap-0.5 py-2">
            <span className="font-semibold">{t}</span>
            <span className="text-xs text-cv-fg-muted">{MODULE_HINT[t]}</span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )

  return (
    <section aria-labelledby="sec-modules">
      <SectionHeader title="人设模块" description="把设定拆成几块，按顺序注入提示词。" action={addMenu} />
      {error && <p role="alert" className="mb-3 text-sm text-cv-danger">{error}</p>}

      {modules.length === 0 ? (
        <GlassPanel className="flex flex-col items-center gap-3 py-10 text-center">
          <span className="flex size-12 items-center justify-center rounded-full bg-cv-secondary text-cv-secondary-fg"><LayoutList className="size-5" /></span>
          <div>
            <p className="font-semibold">还没有人设模块</p>
            <p className="mt-1 text-sm text-cv-fg-muted">只填「角色设定」也能聊；想把用户身份、开局场景、规则分开写时再加。</p>
          </div>
          {addMenu}
        </GlassPanel>
      ) : (
        <ol className="space-y-4">
          {modules.map((m, i) => (
            <li key={m.id}>
              <ModuleCard
                module={m}
                index={i}
                count={modules.length}
                onPatch={(p) => patch(m.id, p)}
                onRemove={() => remove(m.id)}
                onMove={(dir) => move(i, dir)}
              />
            </li>
          ))}
        </ol>
      )}
    </section>
  )
}

interface CardProps {
  module: DraftModule
  index: number
  count: number
  onPatch: (p: Partial<DraftModule>) => void
  onRemove: () => void
  onMove: (dir: -1 | 1) => void
}

function ModuleCard({ module: m, index, count, onPatch, onRemove, onMove }: CardProps) {
  const title = m.type === '自定义模块' && m.name?.trim() ? m.name.trim() : m.type
  return (
    <NeuSurface padding="none" className="overflow-hidden">
      <div className="flex items-center gap-2 border-b border-cv-border px-4 py-3">
        <Chip tone={TONE[m.type]}>{m.type}</Chip>
        <span className="min-w-0 flex-1 truncate text-sm font-semibold">{title !== m.type ? title : <span className="font-mono text-xs text-cv-fg-subtle">#{index + 1}</span>}</span>
        <IconButton label="上移" size="sm" disabled={index === 0} onClick={() => onMove(-1)}><ChevronUp /></IconButton>
        <IconButton label="下移" size="sm" disabled={index === count - 1} onClick={() => onMove(1)}><ChevronDown /></IconButton>
        <IconButton label="删除模块" size="sm" className="text-cv-danger" onClick={() => { if (confirm(`删除「${title}」？`)) onRemove() }}><Trash2 /></IconButton>
      </div>

      <div className="space-y-4 p-4">
        <p className="text-xs text-cv-fg-subtle">{MODULE_HINT[m.type]}</p>

        {m.type === '用户角色设定' ? (
          <>
            <div className="grid gap-3 sm:grid-cols-3">
              <Field id={`${m.id}-name`} label="姓名">
                <Input id={`${m.id}-name`} value={m.userRoleName ?? ''} onChange={(e) => onPatch({ userRoleName: e.target.value })} placeholder="对话里用户的名字" maxLength={60} />
              </Field>
              <Field id={`${m.id}-age`} label="年龄">
                <Input id={`${m.id}-age`} value={m.userRoleAge ?? ''} onChange={(e) => onPatch({ userRoleAge: e.target.value })} placeholder="可留空" maxLength={40} />
              </Field>
              <Field id={`${m.id}-gender`} label="性别">
                <Select value={m.userRoleGender ?? ''} onValueChange={(v) => onPatch({ userRoleGender: v as Gender })}>
                  <SelectTrigger id={`${m.id}-gender`} className="w-full"><SelectValue placeholder="选择性别" /></SelectTrigger>
                  <SelectContent>{GENDER_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
                </Select>
              </Field>
            </div>
            <Field id={`${m.id}-details`} label="详细设定">
              <Textarea id={`${m.id}-details`} value={m.userRoleDetails ?? ''} onChange={(e) => onPatch({ userRoleDetails: e.target.value })} placeholder="用户角色的背景、性格、和角色的关系……" className="min-h-28" />
            </Field>
          </>
        ) : (
          <>
            {m.type === '自定义模块' && (
              <Field id={`${m.id}-title`} label="模块名称">
                <Input id={`${m.id}-title`} value={m.name ?? ''} onChange={(e) => onPatch({ name: e.target.value })} placeholder="例如：世界观 / 术语表" maxLength={60} />
              </Field>
            )}
            <Field id={`${m.id}-content`} label="内容">
              <Textarea id={`${m.id}-content`} value={m.content ?? ''} onChange={(e) => onPatch({ content: e.target.value })} placeholder={`写下${m.type === '自定义模块' ? '这个模块' : m.type}的内容`} className="min-h-32" />
            </Field>
          </>
        )}
      </div>
    </NeuSurface>
  )
}
