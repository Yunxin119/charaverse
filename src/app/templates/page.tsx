'use client'

import { useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { Plus, Search, Pencil, Trash2, Copy, Check, MoreHorizontal, BookTemplate, Globe, Lock, Loader2, User, AlertTriangle, Clapperboard, Wand2, Puzzle } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Chip, IconButton, PosterCard, PosterTitle, CardSkeleton } from '@/components/glass'
import { useAuth } from '@/providers/AuthProvider'
import { useTemplates, useSaveTemplate, useDeleteTemplate, templateContentText, TEMPLATE_TYPES, type TemplateScope } from '@/queries'
import type { PromptTemplate } from '@/app/lib/supabase'
import { cn } from '@/lib/utils'

type TemplateType = PromptTemplate['template_type']

// static class strings so Tailwind can see them
const TYPE_META: Record<TemplateType, { icon: LucideIcon; tone: 'info' | 'warning' | 'accent' | 'success' | 'flat'; badge: string }> = {
  用户角色设定: { icon: User, tone: 'info', badge: 'text-cv-info bg-[color-mix(in_oklab,var(--cv-info)_16%,transparent)]' },
  注意事项: { icon: AlertTriangle, tone: 'warning', badge: 'text-cv-warning bg-[color-mix(in_oklab,var(--cv-warning)_18%,transparent)]' },
  初始情景: { icon: Clapperboard, tone: 'accent', badge: 'bg-cv-accent text-cv-accent-fg' },
  特殊要求: { icon: Wand2, tone: 'success', badge: 'text-cv-success bg-[color-mix(in_oklab,var(--cv-success)_18%,transparent)]' },
  自定义模块: { icon: Puzzle, tone: 'flat', badge: 'bg-cv-secondary text-cv-secondary-fg' },
}

const SCOPES: { id: TemplateScope; label: string }[] = [
  { id: 'mine', label: '我的' },
  { id: 'public', label: '公开' },
  { id: 'system', label: '系统' },
]

type FormState = { name: string; template_type: TemplateType; description: string; content: string; is_public: boolean }
const EMPTY_FORM: FormState = { name: '', template_type: '用户角色设定', description: '', content: '', is_public: false }

const listVariants = { hidden: {}, visible: { transition: { staggerChildren: 0.03 } } }
const itemVariants = { hidden: { opacity: 0, y: 8 }, visible: { opacity: 1, y: 0, transition: { duration: 0.24, ease: [0.2, 0.8, 0.2, 1] as const } } }

export default function TemplatesPage() {
  const { user } = useAuth()
  const [scope, setScope] = useState<TemplateScope>('mine')
  const [query, setQuery] = useState('')
  const [typeFilter, setTypeFilter] = useState<'all' | TemplateType>('all')
  const templates = useTemplates(scope, user?.id)
  const save = useSaveTemplate()
  const del = useDeleteTemplate()

  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<PromptTemplate | null>(null)
  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [formError, setFormError] = useState<string | null>(null)
  const [copiedId, setCopiedId] = useState<number | null>(null)

  const list = useMemo(() => {
    const q = query.trim().toLowerCase()
    return (templates.data ?? []).filter((t) => {
      if (typeFilter !== 'all' && t.template_type !== typeFilter) return false
      if (!q) return true
      return t.name.toLowerCase().includes(q) || (t.description ?? '').toLowerCase().includes(q) || templateContentText(t.content).toLowerCase().includes(q)
    })
  }, [templates.data, query, typeFilter])

  const openCreate = () => {
    setEditing(null)
    setForm(EMPTY_FORM)
    setFormError(null)
    setDialogOpen(true)
  }

  const openEdit = (t: PromptTemplate) => {
    setEditing(t)
    setForm({ name: t.name, template_type: t.template_type, description: t.description ?? '', content: templateContentText(t.content), is_public: !!t.is_public })
    setFormError(null)
    setDialogOpen(true)
  }

  const submit = async () => {
    if (!form.name.trim()) return setFormError('请输入模板名称')
    if (!form.content.trim()) return setFormError('请输入模板内容')
    setFormError(null)
    try {
      await save.mutateAsync({
        id: editing?.id,
        name: form.name.trim(),
        template_type: form.template_type,
        description: form.description.trim() || undefined,
        // same shape the old page wrote, so the character form keeps reading it
        content: { content: form.content },
        is_public: form.is_public,
      })
      setDialogOpen(false)
    } catch {
      setFormError('保存失败，请重试')
    }
  }

  const remove = async (t: PromptTemplate) => {
    if (!confirm(`删除模板「${t.name}」？此操作无法撤销。`)) return
    try {
      await del.mutateAsync(t.id)
    } catch {
      alert('删除失败，请重试')
    }
  }

  const copy = async (t: PromptTemplate) => {
    try {
      await navigator.clipboard.writeText(templateContentText(t.content))
      setCopiedId(t.id)
      setTimeout(() => setCopiedId((id) => (id === t.id ? null : id)), 1500)
    } catch {
      alert('复制失败，请手动选择文本')
    }
  }

  const total = templates.data?.length ?? 0
  const canEdit = (t: PromptTemplate) => scope === 'mine' && !!user && t.user_id === user.id

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-semibold">模板</h1>
          <p className="mt-1 text-sm text-cv-fg-muted">把常用的人设、情景和要求存成模板，在角色表单里一键套用。</p>
        </div>
        <Button variant="accent" onClick={openCreate}><Plus />新建模板</Button>
      </header>

      <div className="mb-6 flex flex-col gap-3 lg:flex-row lg:items-center">
        <Tabs value={scope} onValueChange={(v) => setScope(v as TemplateScope)}>
          <TabsList className="w-full sm:w-fit">
            {SCOPES.map((s) => <TabsTrigger key={s.id} value={s.id}>{s.label}</TabsTrigger>)}
          </TabsList>
        </Tabs>
        <div className="flex flex-1 flex-col gap-3 sm:flex-row">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute inset-y-0 left-4 my-auto size-4 text-cv-fg-subtle" />
            <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="搜索名称、描述或内容…" className="pl-11" aria-label="搜索模板" />
          </div>
          <Select value={typeFilter} onValueChange={(v) => setTypeFilter(v as 'all' | TemplateType)}>
            <SelectTrigger className="w-full sm:w-40" aria-label="模板类型"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">所有类型</SelectItem>
              {TEMPLATE_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      {templates.isLoading && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => <CardSkeleton key={i} className="min-h-44" />)}
        </div>
      )}

      {templates.isError && (
        <PosterCard tone="ink" className="text-center">
          <PosterTitle>加载失败</PosterTitle>
          <p className="mt-2 text-sm opacity-80">网络或权限问题，稍后再试。</p>
          <Button variant="glass" size="sm" className="mt-4" onClick={() => templates.refetch()}>重试</Button>
        </PosterCard>
      )}

      {templates.isSuccess && total === 0 && (
        <PosterCard tone={scope === 'mine' ? 'ink' : 'secondary'} className="flex min-h-56 flex-col items-start justify-between p-6 sm:p-8">
          <BookTemplate className="size-8 opacity-80" />
          <div className="mt-6">
            <PosterTitle className="text-3xl">{scope === 'mine' ? '还没有模板。' : scope === 'public' ? '还没有人公开模板。' : '暂无系统模板。'}</PosterTitle>
            <p className="mt-2 max-w-sm text-sm opacity-80">{scope === 'mine' ? '把你写过最好的一段人设存下来，下次建角色直接套用。' : '把自己的模板设为公开，就会出现在这里。'}</p>
            {scope === 'mine' && <Button variant="glass" className="mt-5" onClick={openCreate}><Plus />新建模板</Button>}
          </div>
        </PosterCard>
      )}

      {templates.isSuccess && total > 0 && list.length === 0 && (
        <div className="glass rounded-cv-lg p-8 text-center text-sm text-cv-fg-muted">没有匹配的模板。</div>
      )}

      {templates.isSuccess && list.length > 0 && (
        <motion.div key={scope} variants={listVariants} initial="hidden" animate="visible" className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {list.map((t) => {
            const meta = TYPE_META[t.template_type] ?? TYPE_META.自定义模块
            const Icon = meta.icon
            const editable = canEdit(t)
            const copied = copiedId === t.id
            return (
              <motion.div key={t.id} variants={itemVariants} layout>
                <article className="glass flex h-full flex-col rounded-cv-lg p-5 transition-shadow hover:shadow-glass">
                  <div className="flex items-start gap-3">
                    <span className={cn('flex size-10 shrink-0 items-center justify-center rounded-cv-sm', meta.badge)}>
                      <Icon className="size-5" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <h3 className="truncate font-semibold leading-tight">{t.name}</h3>
                      <div className="mt-1.5 flex flex-wrap gap-1.5">
                        <Chip tone={meta.tone} className="px-2 py-0.5 text-[11px]">{t.template_type}</Chip>
                        {scope === 'mine' && (t.is_public ? <Chip tone="success" className="px-2 py-0.5 text-[11px]"><Globe className="size-3" />公开</Chip> : <Chip tone="outline" className="px-2 py-0.5 text-[11px]"><Lock className="size-3" />私人</Chip>)}
                      </div>
                    </div>
                    {editable && (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <IconButton label="模板操作" variant="ghost" size="sm" className="-mr-2 -mt-1"><MoreHorizontal /></IconButton>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="min-w-36">
                          <DropdownMenuItem onClick={() => openEdit(t)}><Pencil />编辑</DropdownMenuItem>
                          <DropdownMenuItem onClick={() => void copy(t)}><Copy />复制内容</DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem variant="destructive" onClick={() => void remove(t)}><Trash2 />删除</DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </div>

                  <p className="mt-3 line-clamp-3 flex-1 text-sm text-cv-fg-muted">{t.description?.trim() || templateContentText(t.content) || '没有描述'}</p>

                  <div className="mt-4 flex items-center justify-between gap-2 border-t border-cv-border pt-3 text-xs text-cv-fg-subtle">
                    <span>{t.usage_count > 0 ? `使用 ${t.usage_count} 次` : '尚未使用'}<span className="mx-1.5">·</span>{new Date(t.created_at).toLocaleDateString('zh-CN')}</span>
                    <Button size="sm" variant={copied ? 'secondary' : 'neu'} onClick={() => void copy(t)} aria-live="polite">
                      {copied ? <><Check />已复制</> : <><Copy />复制内容</>}
                    </Button>
                  </div>
                </article>
              </motion.div>
            )
          })}
        </motion.div>
      )}

      <Dialog open={dialogOpen} onOpenChange={(o) => { if (!save.isPending) setDialogOpen(o) }}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="font-display text-xl">{editing ? '编辑模板' : '新建模板'}</DialogTitle>
            <DialogDescription>{editing ? '类型在创建后不能更改。' : '模板会出现在角色表单对应的模块里。'}</DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="tpl-name">名称 *</Label>
              <Input id="tpl-name" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="例如：冷静的侦探搭档" maxLength={80} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="tpl-type">类型 *</Label>
              <Select value={form.template_type} onValueChange={(v) => setForm((f) => ({ ...f, template_type: v as TemplateType }))} disabled={!!editing}>
                <SelectTrigger id="tpl-type" className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TEMPLATE_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="tpl-desc">描述（可选）</Label>
            <Input id="tpl-desc" value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} placeholder="一句话说明这个模板适合什么场景" maxLength={200} />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="tpl-content">内容 *</Label>
            <Textarea id="tpl-content" value={form.content} onChange={(e) => setForm((f) => ({ ...f, content: e.target.value }))} placeholder="输入模板正文，支持多行…" className="min-h-48 max-h-[45dvh]" />
            <p className="text-xs text-cv-fg-subtle">{form.content.length} 字</p>
          </div>

          <div className="neu flex items-center justify-between gap-3 rounded-cv-md px-4 py-3">
            <div>
              <Label htmlFor="tpl-public" className="text-sm font-semibold">公开模板</Label>
              <p className="text-xs text-cv-fg-muted">公开后其他用户可以在「公开」标签里看到并复制。</p>
            </div>
            <Switch id="tpl-public" checked={form.is_public} onCheckedChange={(v) => setForm((f) => ({ ...f, is_public: v }))} />
          </div>

          {formError && <p role="alert" className="text-sm text-cv-danger">{formError}</p>}

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={save.isPending}>取消</Button>
            <Button variant="accent" onClick={() => void submit()} disabled={save.isPending}>
              {save.isPending ? <Loader2 className="animate-spin" /> : null}
              {editing ? '保存' : '创建'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
