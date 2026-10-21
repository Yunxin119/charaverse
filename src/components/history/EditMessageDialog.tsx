'use client'

import { useState } from 'react'
import { Loader2 } from 'lucide-react'
import type { ChatMessage } from '@/app/lib/supabase'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'

interface Props {
  message: ChatMessage | null
  userLabel: string
  characterLabel: string
  saving: boolean
  error?: string | null
  onClose: () => void
  onSave: (content: string) => void
}

/** Edit one message's content (and its current swipe, handled by `useEditMessage`). */
export function EditMessageDialog({ message, onClose, saving, ...rest }: Props) {
  return (
    <Dialog open={!!message} onOpenChange={(open) => { if (!open && !saving) onClose() }}>
      <DialogContent className="flex max-h-[85dvh] flex-col sm:max-w-xl">
        {/* keyed so the draft resets whenever a different message opens */}
        {message && <EditForm key={message.id} message={message} onClose={onClose} saving={saving} {...rest} />}
      </DialogContent>
    </Dialog>
  )
}

function EditForm({ message, userLabel, characterLabel, saving, error, onClose, onSave }: Props & { message: ChatMessage }) {
  const [draft, setDraft] = useState(message.content)
  const who = message.role === 'user' ? userLabel : message.role === 'system' ? '系统' : characterLabel
  const swipeNote = message.swipes && message.swipes.length > 1 ? `（同时更新第 ${(message.swipe_index ?? 0) + 1} 个候选回复）` : ''
  return (
    <>
      <DialogHeader>
        <DialogTitle className="font-display">编辑消息</DialogTitle>
        <DialogDescription className="text-cv-fg-muted">
          {who} · <span className="font-mono">#{message.id}</span> {swipeNote}
        </DialogDescription>
      </DialogHeader>
      <Textarea value={draft} onChange={(e) => setDraft(e.target.value)} className="min-h-48 flex-1 leading-relaxed" aria-label="消息内容" />
      {error && <p role="alert" className="text-sm text-cv-danger">{error}</p>}
      <DialogFooter>
        <Button variant="ghost" onClick={onClose} disabled={saving}>取消</Button>
        <Button onClick={() => onSave(draft.trim())} disabled={saving || !draft.trim()}>
          {saving && <Loader2 className="animate-spin" />}保存
        </Button>
      </DialogFooter>
    </>
  )
}
