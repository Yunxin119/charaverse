'use client'

import { Copy, Download, Eye, Loader2, MoreHorizontal, Pencil, Star, Trash2 } from 'lucide-react'
import { GlassPanel, Chip, IconButton } from '@/components/glass'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'
import type { PresetSummary } from './presetUtils'

interface Props {
  name: string
  summary: PresetSummary
  /** `null` for the builtin card. */
  updatedLabel: string | null
  isDefault?: boolean
  builtin?: boolean
  /** Row data failed schema validation; the card shows the first error line. */
  dataError?: string | null
  busy?: boolean
  onEdit: () => void
  onDuplicate: () => void
  onExport: () => void
  onSetDefault?: () => void
  onDelete?: () => void
}

export function PresetCard({
  name,
  summary,
  updatedLabel,
  isDefault,
  builtin,
  dataError,
  busy,
  onEdit,
  onDuplicate,
  onExport,
  onSetDefault,
  onDelete,
}: Props) {
  return (
    <GlassPanel
      padding="none"
      className={cn(
        'group relative flex flex-col gap-3 p-4 sm:p-5 transition-shadow duration-(--cv-dur) ease-cv hover:shadow-glass',
        builtin && 'border-cv-accent/40'
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-display text-lg font-semibold leading-tight truncate">{name}</h3>
            {builtin && <Chip tone="accent">内置</Chip>}
            {isDefault && <Chip tone="success">默认</Chip>}
          </div>
          <p className="mt-1 text-xs text-cv-fg-muted">
            {summary.total} 条目 · {summary.enabled} 启用 · ≈{summary.tokens} tokens
          </p>
        </div>
        {!builtin && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <IconButton label="更多操作" size="sm" variant="ghost" disabled={busy}>
                {busy ? <Loader2 className="animate-spin" /> : <MoreHorizontal />}
              </IconButton>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onSelect={onEdit}>
                <Pencil /> 编辑
              </DropdownMenuItem>
              {!isDefault && onSetDefault && (
                <DropdownMenuItem onSelect={onSetDefault}>
                  <Star /> 设为默认
                </DropdownMenuItem>
              )}
              <DropdownMenuItem onSelect={onDuplicate}>
                <Copy /> 复制
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={onExport}>
                <Download /> 导出 JSON
              </DropdownMenuItem>
              {onDelete && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem variant="destructive" onSelect={onDelete}>
                    <Trash2 /> 删除
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className="font-mono rounded-full neu-in px-2.5 py-1 text-cv-fg-muted">{summary.sampling}</span>
        {updatedLabel && <span className="text-cv-fg-subtle">更新于 {updatedLabel}</span>}
      </div>

      {dataError && (
        <p className="text-xs text-cv-danger line-clamp-2" title={dataError}>
          数据无法通过校验，编辑时将以默认模板打开：{dataError.split('\n')[0]}
        </p>
      )}

      <div className="mt-auto flex flex-wrap items-center gap-2 pt-1">
        {builtin ? (
          <>
            <Button size="sm" variant="neu" onClick={onEdit}>
              <Eye /> 查看
            </Button>
            <Button size="sm" variant="accent" onClick={onDuplicate} disabled={busy}>
              <Copy /> 复制为我的
            </Button>
          </>
        ) : (
          <>
            <Button size="sm" variant="neu" onClick={onEdit}>
              <Pencil /> 编辑
            </Button>
            {!isDefault && onSetDefault && (
              <Button size="sm" variant="ghost" onClick={onSetDefault} disabled={busy}>
                <Star /> 设为默认
              </Button>
            )}
          </>
        )}
      </div>
    </GlassPanel>
  )
}
