'use client'

import { useState } from 'react'
import { FileJson, FileText, Loader2, ScrollText } from 'lucide-react'
import { toast } from 'sonner'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Chip } from '@/components/glass'
import { fetchAllMessages, type ExportMessageRow } from '@/queries/chatExport'
import { toChatLog, toJsonl, toMarkdown, type ExportInput } from '@/lib/chatlog/format'
import { downloadText } from '@/lib/cards/exportBrowser'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  sessionId: string
  title?: string | null
  characterName: string
  characterId: number
  userName?: string
  settings?: Record<string, unknown>
}

type Format = 'json' | 'jsonl' | 'md'

const FORMATS: { id: Format; label: string; hint: string; ext: string; mime: string; icon: typeof FileJson }[] = [
  { id: 'json', label: 'JSON（无损）', hint: '保留标题、设置、备选回复与时间戳，可重新导入 CharaVerse。', ext: 'json', mime: 'application/json', icon: FileJson },
  { id: 'jsonl', label: 'JSONL（通用）', hint: '通用 JSONL 格式，可被其他角色扮演前端读取。', ext: 'jsonl', mime: 'application/x-ndjson', icon: ScrollText },
  { id: 'md', label: 'Markdown', hint: '纯文本阅读版，适合存档或分享。', ext: 'md', mime: 'text/markdown', icon: FileText },
]

function safeFileName(name: string): string {
  const cleaned = name.replace(/[\\/:*?"<>|\u0000-\u001f]+/g, ' ').trim().slice(0, 80)
  return cleaned || '对话'
}

/** Download the whole conversation in one of three formats. Messages are fetched once per open and reused. */
export function ExportChatDialog({ open, onOpenChange, ...rest }: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display text-xl">导出对话</DialogTitle>
          <DialogDescription>
            把「{rest.title?.trim() || `与 ${rest.characterName} 的对话`}」保存到本地。
          </DialogDescription>
        </DialogHeader>
        {open && <ExportBody {...rest} />}
      </DialogContent>
    </Dialog>
  )
}

function ExportBody({ sessionId, title, characterName, characterId, userName, settings }: Omit<Props, 'open' | 'onOpenChange'>) {
  const [rows, setRows] = useState<ExportMessageRow[] | null>(null)
  const [busy, setBusy] = useState<Format | null>(null)

  const load = async (): Promise<ExportMessageRow[]> => {
    if (rows) return rows
    const fetched = await fetchAllMessages(sessionId)
    setRows(fetched)
    return fetched
  }

  const run = async (fmt: (typeof FORMATS)[number]) => {
    setBusy(fmt.id)
    try {
      const messages = await load()
      const input: ExportInput = {
        title: title ?? null,
        characterName,
        characterId,
        userName,
        settings,
        messages: messages.map((m) => ({ role: m.role, content: m.content, created_at: m.created_at, swipes: m.swipes, swipe_index: m.swipe_index })),
      }
      const text = fmt.id === 'json' ? JSON.stringify(toChatLog(input), null, 2) : fmt.id === 'jsonl' ? toJsonl(input) : toMarkdown(input)
      downloadText(`${safeFileName(title?.trim() || characterName)}.${fmt.ext}`, text, fmt.mime)
      toast.success(`已导出 ${messages.length} 条消息`)
    } catch (e) {
      toast.error((e as Error).message || '导出失败，请重试')
    } finally {
      setBusy(null)
    }
  }

  return (
    <>
      <div className="space-y-2">
        {FORMATS.map((f) => {
          const Icon = f.icon
          return (
            <Button
              key={f.id}
              type="button"
              variant="neu"
              className="h-auto w-full justify-start gap-3 rounded-cv-md px-4 py-3 text-left"
              disabled={busy !== null}
              onClick={() => void run(f)}
            >
              {busy === f.id ? <Loader2 className="size-5 shrink-0 animate-spin" /> : <Icon className="size-5 shrink-0 text-cv-accent" />}
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold">{f.label}</span>
                <span className="block whitespace-normal text-xs font-normal text-cv-fg-muted">{f.hint}</span>
              </span>
            </Button>
          )
        })}
      </div>
      <div className="flex items-center justify-between text-xs text-cv-fg-subtle">
        <span>系统消息只包含在 JSON 中。</span>
        {rows && <Chip tone="outline">{rows.length} 条消息</Chip>}
      </div>
    </>
  )
}
