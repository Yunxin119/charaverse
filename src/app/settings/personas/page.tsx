'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, Loader2, Pencil, Plus, Star, Trash2, UserRound } from 'lucide-react'
import { toast } from 'sonner'
import { useAuth } from '@/providers/AuthProvider'
import { useDeletePersona, usePersonaBindings, usePersonas, useSavePersona, useSetDefaultPersona, type PersonaRow } from '@/queries/usePersonas'
import { useCharacters } from '@/queries'
import { personaGenderLabel } from '@/lib/personas/format'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Chip, GlassPanel, IconButton, PosterCard, PosterTitle } from '@/components/glass'
import { PersonaEditorDialog } from '@/components/personas/PersonaEditorDialog'
import { formatRelativeTime } from '@/components/presets/presetUtils'

export default function PersonasPage() {
  const { user, loading: authLoading } = useAuth()
  const userId = user?.id
  const personasQ = usePersonas(userId)
  const bindingsQ = usePersonaBindings(userId)
  const charactersQ = useCharacters(userId)
  const save = useSavePersona(userId)
  const del = useDeletePersona(userId)
  const setDefault = useSetDefaultPersona(userId)

  const [editing, setEditing] = useState<PersonaRow | null | 'new'>(null)
  const [busyId, setBusyId] = useState<string | null>(null)

  const rows = personasQ.data ?? []
  /** personaId → names of the user's own characters bound to it (others' characters are counted only) */
  const boundTo = useMemo(() => {
    const map = new Map<string, { names: string[]; total: number }>()
    const byId = new Map((charactersQ.data ?? []).map((c) => [c.id, c.name]))
    for (const [characterId, personaId] of bindingsQ.data ?? []) {
      const e = map.get(personaId) ?? { names: [], total: 0 }
      e.total += 1
      const n = byId.get(characterId)
      if (n) e.names.push(n)
      map.set(personaId, e)
    }
    return map
  }, [bindingsQ.data, charactersQ.data])

  if (authLoading) return <Spinner />
  if (!user) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6">
        <GlassPanel className="text-center text-sm text-cv-fg-muted">请先登录后管理人设。</GlassPanel>
      </div>
    )
  }

  const runBusy = async (id: string, fn: () => Promise<unknown>) => {
    setBusyId(id)
    try { await fn() } catch (e) { toast.error((e as Error).message || '操作失败') } finally { setBusyId(null) }
  }
  const remove = (row: PersonaRow) => {
    const bound = boundTo.get(row.id)?.total ?? 0
    if (!confirm(`删除人设「${row.name}」？${bound ? `它绑定的 ${bound} 个角色会改回跟随默认。` : ''}此操作不可恢复。`)) return
    void runBusy(row.id, () => del.mutateAsync(row.id))
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <IconButton label="返回设置" variant="glass" onClick={() => history.length > 1 ? history.back() : undefined} className="mt-1 hidden sm:inline-flex"><ArrowLeft /></IconButton>
          <div className="min-w-0">
            <h1 className="font-display text-3xl font-semibold">我的人设</h1>
            <p className="mt-1 max-w-2xl text-sm text-cv-fg-muted">
              故事里的「你」。人设跟着你走，不写进角色卡，所以分享角色不会带出去。可以给某个角色绑定一个人设，也可以在任何对话的会话设置里临时换。
            </p>
          </div>
        </div>
        <Button size="sm" onClick={() => setEditing('new')}><Plus /> 新建人设</Button>
      </header>

      {personasQ.isLoading ? (
        <Spinner />
      ) : personasQ.error ? (
        <GlassPanel className="text-sm text-cv-danger">加载失败：{(personasQ.error as Error).message}</GlassPanel>
      ) : rows.length === 0 ? (
        <PosterCard tone="primary" className="min-h-56">
          <UserRound className="mb-3 size-7 opacity-80" />
          <PosterTitle>还没有人设</PosterTitle>
          <p className="mt-2 max-w-md text-sm opacity-85">写下你在故事里的名字、背景和性格。设为默认后，每个新对话都会自动用它；不同角色也可以各绑一个。</p>
          <Button variant="accent" size="sm" className="mt-5 self-start" onClick={() => setEditing('new')}><Plus /> 新建人设</Button>
        </PosterCard>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {rows.map((row) => {
            const bound = boundTo.get(row.id)
            const busy = busyId === row.id
            return (
              <li key={row.id}>
                <GlassPanel padding="none" className="flex h-full flex-col gap-3 p-4 transition-shadow duration-(--cv-dur) ease-cv hover:shadow-glass sm:p-5" data-persona-id={row.id}>
                  <div className="flex items-start gap-3">
                    <Avatar className="size-14 rounded-cv-md shadow-neu-sm">
                      <AvatarImage src={row.avatar_url ?? undefined} alt={row.name} />
                      <AvatarFallback className="rounded-cv-md bg-cv-secondary font-display text-xl text-cv-secondary-fg">{row.name.slice(0, 1)}</AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <h3 className="truncate font-display text-lg font-semibold leading-tight">{row.name}</h3>
                      <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                        {row.is_default && <Chip tone="accent"><Star className="size-3" />默认</Chip>}
                        {personaGenderLabel(row.gender) && <Chip tone="outline">{personaGenderLabel(row.gender)}</Chip>}
                        {row.age && <Chip tone="outline">{row.age}</Chip>}
                        {bound && (
                          <Chip tone="outline" title={bound.names.join('、') || undefined}>
                            绑定 {bound.total} 个角色{bound.names.length ? `：${bound.names.slice(0, 2).join('、')}${bound.names.length > 2 ? '…' : ''}` : ''}
                          </Chip>
                        )}
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-0.5">
                      {!row.is_default && (
                        <IconButton label="设为默认" size="sm" variant="ghost" disabled={busy} onClick={() => runBusy(row.id, () => setDefault.mutateAsync(row.id))}>
                          {busy ? <Loader2 className="animate-spin" /> : <Star />}
                        </IconButton>
                      )}
                      <IconButton label="编辑" size="sm" variant="ghost" disabled={busy} onClick={() => setEditing(row)}><Pencil /></IconButton>
                      <IconButton label="删除" size="sm" variant="ghost" disabled={busy} onClick={() => remove(row)} className="hover:text-cv-danger"><Trash2 /></IconButton>
                    </div>
                  </div>
                  <p className="line-clamp-4 whitespace-pre-wrap text-sm text-cv-fg-muted [overflow-wrap:anywhere]">{row.details.trim() || '（还没写设定）'}</p>
                  <p className="mt-auto text-[11px] text-cv-fg-subtle">更新于 {formatRelativeTime(row.updated_at)}</p>
                </GlassPanel>
              </li>
            )
          })}
        </ul>
      )}

      <p className="mt-6 text-xs text-cv-fg-subtle">
        想给某个角色固定用一个人设？到它的<Link href="/characters" className="text-cv-accent underline-offset-4 hover:underline">角色主页</Link>选「和它聊天用的人设」。
      </p>

      <PersonaEditorDialog
        open={editing !== null}
        onOpenChange={(o) => { if (!o) setEditing(null) }}
        initial={editing === 'new' ? null : editing}
        saving={save.isPending}
        onSave={(input) => save.mutateAsync(input)}
      />
    </div>
  )
}

function Spinner() {
  return (
    <div className="mx-auto flex max-w-5xl items-center justify-center px-4 py-24 text-cv-fg-muted">
      <Loader2 className="size-5 animate-spin" />
    </div>
  )
}
