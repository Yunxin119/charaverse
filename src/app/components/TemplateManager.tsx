'use client'

import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Save, Download, Trash2, Search, Clock, User, Globe, AlertCircle, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Chip, IconButton } from '@/components/glass'
import { getPromptTemplates, savePromptTemplate, deletePromptTemplate, incrementTemplateUsage } from '../lib/promptTemplates'
import { type PromptTemplate } from '../lib/supabase'

interface TemplateManagerProps {
  templateType: string
  currentContent: Record<string, unknown>
  onLoadTemplate: (content: Record<string, unknown>) => void
  className?: string
}

// Shares the ['templates'] root with src/queries/useTemplates.ts so saves here refresh /templates too.
const TEMPLATES_ROOT = ['templates'] as const
const templatesKey = (type: string) => [...TEMPLATES_ROOT, 'by-type', type] as const

const hasText = (v: unknown) => typeof v === 'string' && v.trim().length > 0

/** Save the current module as a reusable template, or load one into it. */
export function TemplateManager({ templateType, currentContent, onLoadTemplate, className = '' }: TemplateManagerProps) {
  const qc = useQueryClient()
  const [searchQuery, setSearchQuery] = useState('')
  const [showSaveDialog, setShowSaveDialog] = useState(false)
  const [showLoadDialog, setShowLoadDialog] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [saveForm, setSaveForm] = useState({ name: '', description: '', is_public: false })

  // Only fetched while the picker is open, so a form with many modules does not fire N queries on mount.
  const list = useQuery({
    queryKey: templatesKey(templateType),
    queryFn: () => getPromptTemplates(templateType),
    enabled: showLoadDialog,
  })
  const invalidate = () => qc.invalidateQueries({ queryKey: TEMPLATES_ROOT })

  const saveTemplate = useMutation({
    mutationFn: () =>
      savePromptTemplate({ name: saveForm.name.trim(), template_type: templateType, content: currentContent, description: saveForm.description.trim() || undefined, is_public: saveForm.is_public }),
    onSuccess: () => {
      setShowSaveDialog(false)
      setSaveForm({ name: '', description: '', is_public: false })
      invalidate()
    },
    onError: (e) => setSaveError((e as Error).message || '保存模板失败，请重试'),
  })

  const deleteTemplate = useMutation({
    mutationFn: (id: number) => deletePromptTemplate(id),
    onSuccess: invalidate,
  })

  const load = async (template: PromptTemplate) => {
    onLoadTemplate(template.content as Record<string, unknown>)
    setShowLoadDialog(false)
    incrementTemplateUsage(template.id).then(invalidate).catch(() => {})
  }

  const hasContent = Object.values(currentContent).some(hasText)
  const q = searchQuery.trim().toLowerCase()
  const filtered = (list.data ?? []).filter((t) => !q || t.name.toLowerCase().includes(q) || t.description?.toLowerCase().includes(q))

  return (
    <div className={`flex flex-wrap items-center gap-2 ${className}`}>
      <Dialog open={showSaveDialog} onOpenChange={(o) => { setShowSaveDialog(o); setSaveError(null) }}>
        <DialogTrigger asChild>
          <Button type="button" variant="ghost" size="sm" disabled={!hasContent}><Save />存为模板</Button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>存为模板</DialogTitle>
            <DialogDescription>把这个「{templateType}」存起来，以后别的角色也能直接用。</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="template-name">模板名称</Label>
              <Input id="template-name" placeholder="起个好认的名字" value={saveForm.name} onChange={(e) => setSaveForm((p) => ({ ...p, name: e.target.value }))} maxLength={60} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="template-description">描述（可选）</Label>
              <Textarea id="template-description" placeholder="这个模板适合什么场景" value={saveForm.description} onChange={(e) => setSaveForm((p) => ({ ...p, description: e.target.value }))} className="min-h-20" />
            </div>
            <div className="flex items-center justify-between rounded-cv-md neu px-4 py-3">
              <Label htmlFor="template-public" className="flex flex-col items-start gap-0.5">
                <span>公开模板</span>
                <span className="text-xs font-normal text-cv-fg-muted">其他用户也能在模板库里看到并使用</span>
              </Label>
              <Switch id="template-public" checked={saveForm.is_public} onCheckedChange={(c) => setSaveForm((p) => ({ ...p, is_public: c }))} />
            </div>
            {saveError && <p role="alert" className="text-xs text-cv-danger">{saveError}</p>}
            <div className="flex justify-end gap-2">
              <Button type="button" variant="ghost" onClick={() => setShowSaveDialog(false)}>取消</Button>
              <Button type="button" onClick={() => { setSaveError(null); if (!saveForm.name.trim()) { setSaveError('请输入模板名称'); return } saveTemplate.mutate() }} disabled={saveTemplate.isPending}>
                {saveTemplate.isPending ? <Loader2 className="animate-spin" /> : <Save />}保存
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showLoadDialog} onOpenChange={setShowLoadDialog}>
        <DialogTrigger asChild>
          <Button type="button" variant="ghost" size="sm"><Download />从模板加载</Button>
        </DialogTrigger>
        <DialogContent className="flex max-h-[80vh] flex-col overflow-hidden sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>选择模板</DialogTitle>
            <DialogDescription>加载会覆盖这个模块当前的内容。</DialogDescription>
          </DialogHeader>
          <div className="relative">
            <Search className="pointer-events-none absolute left-4 top-3.5 size-4 text-cv-fg-subtle" />
            <Input placeholder="搜索模板…" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-11" />
          </div>

          <div className="-mx-1 flex-1 space-y-2 overflow-y-auto px-1 py-1">
            {list.isLoading ? (
              <div className="flex items-center justify-center gap-2 py-8 text-sm text-cv-fg-muted"><Loader2 className="size-4 animate-spin" />加载中…</div>
            ) : list.isError ? (
              <div className="flex flex-col items-center justify-center py-8 text-sm text-cv-danger"><AlertCircle className="mb-2 size-6" />模板加载失败</div>
            ) : filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-sm text-cv-fg-muted">
                <AlertCircle className="mb-2 size-6 opacity-60" />
                <p>{q ? '没有找到匹配的模板' : '还没有这类模板，先在模块里写好再「存为模板」'}</p>
              </div>
            ) : (
              filtered.map((t) => (
                <div key={t.id} className="glass flex items-start gap-3 rounded-cv-md p-3 transition-shadow hover:shadow-glass">
                  <button type="button" onClick={() => void load(t)} className="min-w-0 flex-1 rounded-cv-sm text-left outline-none focus-visible:ring-2 focus-visible:ring-cv-ring">
                    <div className="mb-1 flex flex-wrap items-center gap-2">
                      <span className="truncate font-semibold">{t.name}</span>
                      {t.is_public ? <Chip tone="success"><Globe className="size-3" />公开</Chip> : <Chip tone="outline"><User className="size-3" />我的</Chip>}
                      {t.usage_count > 0 && <span className="flex items-center gap-1 font-mono text-[11px] text-cv-fg-subtle"><Clock className="size-3" />{t.usage_count}</span>}
                    </div>
                    {t.description && <p className="mb-1 line-clamp-2 text-sm text-cv-fg-muted">{t.description}</p>}
                    <div className="text-xs text-cv-fg-subtle">创建于 {new Date(t.created_at).toLocaleDateString()}</div>
                  </button>
                  {t.user_id && (
                    <IconButton label="删除模板" size="sm" className="text-cv-danger" disabled={deleteTemplate.isPending} onClick={() => { if (confirm(`删除模板「${t.name}」？`)) deleteTemplate.mutate(t.id) }}>
                      <Trash2 />
                    </IconButton>
                  )}
                </div>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
