'use client'

import { Suspense, useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, BookOpen, Check, Download, Loader2, Pencil, Plus, Save, Trash2, Upload } from 'lucide-react'
import { toast } from 'sonner'
import { useAuth } from '@/providers/AuthProvider'
import { lorebookKeys, useDeleteLorebook, useLorebooks, useSaveLorebook, useToggleLorebook, type LorebookRow } from '@/queries/useLorebooks'
import { EMPTY_LOREBOOK, parseLorebook, type Lorebook } from '@/lib/lorebook/schema'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Chip, GlassPanel, IconButton, PosterCard, PosterTitle } from '@/components/glass'
import { LorebookEditor } from '@/components/lorebook/LorebookEditor'
import { LorebookImportDialog } from '@/components/lorebook/LorebookImportDialog'
import { downloadLorebookJson } from '@/components/lorebook/utils'
import { formatRelativeTime } from '@/components/presets/presetUtils'

const ROUTE = '/settings/lorebooks'

export default function LorebooksPage() {
  return (
    <Suspense fallback={<PageSpinner />}>
      <LorebooksPageInner />
    </Suspense>
  )
}

function PageSpinner() {
  return (
    <div className="mx-auto flex max-w-5xl items-center justify-center px-4 py-24 text-cv-fg-muted">
      <Loader2 className="size-5 animate-spin" />
    </div>
  )
}

function LorebooksPageInner() {
  const { user, loading: authLoading } = useAuth()
  const router = useRouter()
  const searchParams = useSearchParams()
  const qc = useQueryClient()
  const edit = searchParams.get('edit')

  const userId = user?.id
  const booksQ = useLorebooks(userId)
  const save = useSaveLorebook(userId)
  const toggle = useToggleLorebook(userId)
  const del = useDeleteLorebook(userId)

  const [importOpen, setImportOpen] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)

  const rows = useMemo(() => booksQ.data ?? [], [booksQ.data])

  /** Put a freshly saved row into the list cache so `?edit=<id>` resolves before the refetch lands. */
  const seedRow = useCallback(
    (row: LorebookRow) => {
      if (!userId) return
      qc.setQueryData<LorebookRow[]>(lorebookKeys.all(userId), (old) => [row, ...(old ?? []).filter((r) => r.id !== row.id)])
    },
    [qc, userId]
  )
  const openEditor = useCallback((id: string) => router.push(`${ROUTE}?edit=${encodeURIComponent(id)}`), [router])
  const closeEditor = useCallback(() => router.push(ROUTE), [router])

  if (authLoading) return <PageSpinner />
  if (!user) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6">
        <GlassPanel className="text-center text-sm text-cv-fg-muted">请先登录后管理世界书。</GlassPanel>
      </div>
    )
  }

  /* ---------------------------- editor mode ---------------------------- */
  if (edit) {
    const row = edit === 'new' ? null : rows.find((r) => r.id === edit)
    if (edit !== 'new' && !row) {
      if (booksQ.isLoading || booksQ.isFetching) return <PageSpinner />
      return (
        <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6">
          <GlassPanel className="space-y-3 text-sm text-cv-fg-muted">
            <p>找不到这本世界书，可能已被删除。</p>
            <Button variant="neu" size="sm" onClick={closeEditor}><ArrowLeft /> 返回列表</Button>
          </GlassPanel>
        </div>
      )
    }
    return (
      <BookEditor
        key={edit}
        row={row ?? null}
        saving={save.isPending}
        onBack={closeEditor}
        onSave={async ({ name, book }) => {
          const saved = await save.mutateAsync({ id: row?.id, name, data: book, enabled: row?.enabled ?? true })
          seedRow(saved)
          if (!row) router.replace(`${ROUTE}?edit=${encodeURIComponent(saved.id)}`)
        }}
      />
    )
  }

  /* ----------------------------- list mode ----------------------------- */
  const runBusy = async (id: string, fn: () => Promise<unknown>) => {
    setBusyId(id)
    try { await fn() } catch (e) { toast.error((e as Error).message || '操作失败') } finally { setBusyId(null) }
  }

  const importBook = async (book: Lorebook) => {
    const name = book.name.trim() || '导入的世界书'
    const saved = await save.mutateAsync({ name, data: { ...book, name }, enabled: true })
    seedRow(saved)
    toast.success(`已导入「${name}」，${book.entries.length} 条目`)
  }

  const remove = (row: LorebookRow) => {
    if (!confirm(`删除世界书「${row.name}」？此操作不可恢复。`)) return
    void runBusy(row.id, () => del.mutateAsync(row.id))
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h1 className="font-display text-3xl font-semibold">世界书库</h1>
          <p className="mt-1 max-w-2xl text-sm text-cv-fg-muted">
            关键词触发的背景设定。库里「启用」的书会应用到你所有对话；角色自带的世界书在<Link href="/characters" className="text-cv-accent underline-offset-4 hover:underline">角色编辑页</Link>。
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="neu" size="sm" onClick={() => setImportOpen(true)}><Upload /> 导入</Button>
          <Button size="sm" onClick={() => openEditor('new')}><Plus /> 新建</Button>
        </div>
      </header>

      {booksQ.isLoading ? (
        <PageSpinner />
      ) : booksQ.error ? (
        <GlassPanel className="text-sm text-cv-danger">加载失败：{(booksQ.error as Error).message}</GlassPanel>
      ) : rows.length === 0 ? (
        <PosterCard tone="primary" className="min-h-56">
          <BookOpen className="mb-3 size-7 opacity-80" />
          <PosterTitle>还没有世界书</PosterTitle>
          <p className="mt-2 max-w-md text-sm opacity-85">把世界观、地点、组织、专有名词写成条目，聊到相关关键词时自动补充给 AI，不用每次都塞进角色设定。</p>
          <div className="mt-5 flex flex-wrap gap-2">
            <Button variant="accent" size="sm" onClick={() => openEditor('new')}><Plus /> 新建世界书</Button>
            <Button variant="glass" size="sm" onClick={() => setImportOpen(true)}><Upload /> 导入 JSON</Button>
          </div>
        </PosterCard>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {rows.map((row) => (
            <li key={row.id}>
              <BookCard
                row={row}
                busy={busyId === row.id}
                onToggle={(enabled) => runBusy(row.id, () => toggle.mutateAsync({ id: row.id, enabled }))}
                onEdit={() => openEditor(row.id)}
                onExport={() => { const r = parseLorebook(row.data); if (r.ok) downloadLorebookJson(row.name, r.book); else toast.error('这本世界书的数据无法解析') }}
                onDelete={() => remove(row)}
              />
            </li>
          ))}
        </ul>
      )}

      <LorebookImportDialog open={importOpen} onOpenChange={setImportOpen} hasExisting={false} onImport={importBook} />
    </div>
  )
}

/* ------------------------------------------------------------------------ */

function BookCard({ row, busy, onToggle, onEdit, onExport, onDelete }: { row: LorebookRow; busy: boolean; onToggle: (v: boolean) => void; onEdit: () => void; onExport: () => void; onDelete: () => void }) {
  const parsed = useMemo(() => parseLorebook(row.data), [row.data])
  const book = parsed.ok ? parsed.book : null
  const enabledEntries = book ? book.entries.filter((e) => e.enabled).length : 0

  return (
    <GlassPanel padding="none" className="flex h-full flex-col gap-3 p-4 transition-shadow duration-(--cv-dur) ease-cv hover:shadow-glass sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h3 className="truncate font-display text-lg leading-tight font-semibold">{row.name}</h3>
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            {book ? (
              <>
                <Chip tone="outline">{book.entries.length} 条目</Chip>
                {book.entries.length !== enabledEntries && <Chip tone="outline">{enabledEntries} 启用</Chip>}
                {book.entries.some((e) => e.constant) && <Chip tone="accent">含常驻</Chip>}
              </>
            ) : (
              <Chip tone="danger">数据无法解析</Chip>
            )}
          </div>
        </div>
        <label className="flex shrink-0 items-center gap-2 text-xs text-cv-fg-muted">
          {row.enabled ? '已启用' : '未启用'}
          <Switch aria-label={`启用「${row.name}」`} checked={row.enabled} disabled={busy} onCheckedChange={onToggle} />
        </label>
      </div>
      {book?.description && <p className="line-clamp-2 text-sm text-cv-fg-muted">{book.description}</p>}
      <div className="mt-auto flex items-center justify-between gap-2 pt-1">
        <span className="text-xs text-cv-fg-subtle">更新于 {formatRelativeTime(row.updated_at)}</span>
        <div className="flex items-center gap-1">
          <Button type="button" size="sm" variant="neu" onClick={onEdit}><Pencil /> 编辑</Button>
          <IconButton label="导出 JSON" size="sm" disabled={!book} onClick={onExport}><Download /></IconButton>
          <IconButton label="删除" size="sm" className="text-cv-danger" disabled={busy} onClick={onDelete}>{busy ? <Loader2 className="animate-spin" /> : <Trash2 />}</IconButton>
        </div>
      </div>
    </GlassPanel>
  )
}

/* ------------------------------------------------------------------------ */

function BookEditor({ row, saving, onBack, onSave }: { row: LorebookRow | null; saving: boolean; onBack: () => void; onSave: (v: { name: string; book: Lorebook }) => Promise<void> }) {
  const initial = useMemo(() => {
    if (!row) return { name: '新世界书', book: EMPTY_LOREBOOK }
    const r = parseLorebook(row.data)
    return { name: row.name, book: r.ok ? r.book : EMPTY_LOREBOOK }
  }, [row])
  const [name, setName] = useState(initial.name)
  const [book, setBook] = useState<Lorebook>(initial.book)
  const [baseline, setBaseline] = useState(initial)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const dirty = useMemo(() => name !== baseline.name || JSON.stringify(book) !== JSON.stringify(baseline.book), [name, book, baseline])
  const nameError = !name.trim() ? '世界书需要一个名字' : name.length > 120 ? '名字最多 120 个字符' : null
  const canSave = dirty && !saving && !nameError

  useEffect(() => {
    if (!dirty) return
    const h = (e: BeforeUnloadEvent) => { e.preventDefault() }
    window.addEventListener('beforeunload', h)
    return () => window.removeEventListener('beforeunload', h)
  }, [dirty])

  const submit = async () => {
    if (!canSave) return
    setError(null)
    const trimmed = name.trim()
    try {
      await onSave({ name: trimmed, book: { ...book, name: trimmed } })
      setBaseline({ name: trimmed, book: { ...book, name: trimmed } })
      setName(trimmed)
      setBook((b) => ({ ...b, name: trimmed }))
      setSaved(true)
      setTimeout(() => setSaved(false), 1600)
    } catch (e) {
      setError((e as Error).message || '保存失败，请重试')
    }
  }

  const back = () => { if (!dirty || confirm('有未保存的修改，确定离开？')) onBack() }

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's') { e.preventDefault(); void submit() }
    }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  })

  return (
    <div className="mx-auto max-w-4xl px-4 py-6 sm:px-6">
      <div className="sticky top-0 z-20 -mt-2 pt-2 pb-3">
        <GlassPanel strength="strong" padding="none" className="flex items-center gap-2 px-3 py-2 sm:px-4">
          <IconButton label="返回" variant="ghost" size="sm" onClick={back}><ArrowLeft /></IconButton>
          <div className="min-w-0 flex-1">
            <h1 className="truncate font-display text-lg leading-tight font-semibold sm:text-xl">{name.trim() || (row ? row.name : '新世界书')}</h1>
            <p className="hidden text-[11px] text-cv-fg-muted sm:block">{row ? '修改只在你按「保存」后生效' : '保存后会出现在世界书库里'}</p>
          </div>
          {dirty ? <Chip tone="warning">未保存</Chip> : saved ? <Chip tone="success">已保存</Chip> : null}
          <Button type="button" size="sm" disabled={!canSave} onClick={submit}>
            {saving ? <Loader2 className="animate-spin" /> : saved && !dirty ? <Check /> : <Save />}
            {saving ? '保存中' : '保存'}
          </Button>
        </GlassPanel>
        {error && <p role="alert" className="mt-2 rounded-cv-md bg-[color-mix(in_oklab,var(--cv-danger)_12%,transparent)] px-3 py-2 text-sm text-cv-danger">{error}</p>}
      </div>

      <div className="space-y-4">
        <GlassPanel className="space-y-1.5">
          <Label htmlFor="lb-name">名称</Label>
          <Input id="lb-name" value={name} maxLength={120} onChange={(e) => setName(e.target.value)} aria-invalid={!!nameError} placeholder="例如：北境编年史" />
          {nameError ? <p role="alert" className="text-xs text-cv-danger">{nameError}</p> : <p className="text-xs text-cv-fg-subtle">只在你的库里显示；导出时会写进文件。</p>}
        </GlassPanel>
        <LorebookEditor value={book} onChange={setBook} exportName={name.trim()} onImportedName={(n) => { if (!row) setName(n) }} />
      </div>
    </div>
  )
}
