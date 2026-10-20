'use client'

import { RefreshCw, Pencil, Copy, GitBranch, Trash2, ArrowDownToLine, RotateCcw, Check } from 'lucide-react'
import { useState } from 'react'
import { cn } from '@/lib/utils'

export interface MessageActionHandlers {
  onRegenerate?: () => void
  onContinue?: () => void
  onEdit?: () => void
  onBranch?: () => void
  onDelete?: () => void
  onResend?: () => void
}

interface Props extends MessageActionHandlers {
  role: 'user' | 'assistant' | 'system'
  content: string
  isLast: boolean
  disabled?: boolean
  className?: string
}

function Act({ label, onClick, disabled, children }: { label: string; onClick?: () => void; disabled?: boolean; children: React.ReactNode }) {
  if (!onClick) return null
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={(e) => { e.stopPropagation(); onClick() }}
      className="flex size-7 items-center justify-center rounded-full text-cv-fg-muted transition-colors hover:bg-cv-fg/10 hover:text-cv-fg disabled:opacity-40 [&_svg]:size-3.5"
    >
      {children}
    </button>
  )
}

export function MessageActions({ role, content, isLast, disabled, className, onRegenerate, onContinue, onEdit, onBranch, onDelete, onResend }: Props) {
  const [copied, setCopied] = useState(false)
  const copy = async () => {
    try { await navigator.clipboard.writeText(content); setCopied(true); setTimeout(() => setCopied(false), 1200) } catch {}
  }
  return (
    <div className={cn('cv_message_actions_box flex items-center gap-0.5 rounded-full glass-strong px-1 py-0.5', className)}>
      {role === 'assistant' && isLast && <Act label="重新生成" onClick={onRegenerate} disabled={disabled}><RefreshCw /></Act>}
      {role === 'assistant' && isLast && <Act label="续写" onClick={onContinue} disabled={disabled}><ArrowDownToLine /></Act>}
      {role === 'user' && isLast && <Act label="重新发送" onClick={onResend} disabled={disabled}><RotateCcw /></Act>}
      <Act label="编辑" onClick={onEdit} disabled={disabled}><Pencil /></Act>
      <Act label={copied ? '已复制' : '复制'} onClick={copy}>{copied ? <Check className="text-cv-success" /> : <Copy />}</Act>
      <Act label="从这里分支" onClick={onBranch} disabled={disabled}><GitBranch /></Act>
      <Act label="删除" onClick={onDelete} disabled={disabled}><Trash2 /></Act>
    </div>
  )
}
