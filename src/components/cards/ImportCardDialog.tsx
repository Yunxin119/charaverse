'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useQueryClient } from '@tanstack/react-query'
import { FileJson, ImageIcon, Loader2, Upload } from 'lucide-react'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Chip } from '@/components/glass'
import { supabase } from '@/app/lib/supabase'
import { uploadAvatar } from '@/app/lib/avatarUpload'
import { parseCharacterCard } from '@/lib/chat/characterCard'
import { readCardFile, readCardText, type ReadCardResult } from '@/lib/cards/exportBrowser'
import type { ImportedCard } from '@/lib/cards/convert'
import { qk } from '@/queries/keys'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  userId: string
}

const SOURCE_LABEL: Record<ImportedCard['source'], string> = {
  charaverse: 'CharaVerse',
  v1: '通用角色卡 v1',
  v2: '通用角色卡 v2',
  v3: '通用角色卡 v3',
}

/** Pick a `.json` / `.png` card or paste JSON; creates the character and jumps to its editor. */
export function ImportCardDialog({ open, onOpenChange, userId }: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="font-display text-xl">导入角色</DialogTitle>
          <DialogDescription>
            选择 <code className="font-mono text-xs">.json</code> / <code className="font-mono text-xs">.png</code> 角色卡，或直接粘贴 JSON。自动识别 CharaVerse 格式与通用角色卡格式（v1 / v2 / v3）。
          </DialogDescription>
        </DialogHeader>
        {open && <ImportBody userId={userId} onClose={() => onOpenChange(false)} />}
      </DialogContent>
    </Dialog>
  )
}

type Parsed = Extract<ReadCardResult, { card: ImportedCard }>

function ImportBody({ userId, onClose }: { userId: string; onClose: () => void }) {
  const router = useRouter()
  const qc = useQueryClient()
  const fileRef = useRef<HTMLInputElement>(null)
  const [text, setText] = useState('')
  const [fileName, setFileName] = useState<string | null>(null)
  const [parsed, setParsed] = useState<Parsed | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const apply = (r: ReadCardResult) => {
    if ('error' in r) { setParsed(null); setError(r.error) }
    else { setParsed(r); setError(null) }
  }

  const pickFile = async (file: File) => {
    setText('')
    setFileName(file.name)
    apply(await readCardFile(file))
  }

  const onTextChange = (v: string) => {
    setText(v)
    setFileName(null)
    if (!v.trim()) { setParsed(null); setError(null); return }
    apply(readCardText(v))
  }

  const run = async () => {
    if (!parsed) return
    setBusy(true)
    setError(null)
    try {
      const { card, avatarFile } = parsed
      const { data, error: insErr } = await supabase
        .from('characters')
        .insert({
          user_id: userId,
          name: card.name,
          prompt_template: card.prompt_template,
          skin: card.skin,
          lorebook: card.lorebook,
          is_public: false,
          likes_count: 0,
        })
        .select('id')
        .single()
      if (insErr || !data) throw insErr ?? new Error('创建角色失败')
      const id = Number(data.id)
      if (avatarFile) {
        try {
          const url = await uploadAvatar(avatarFile, 'avatars', 'characters')
          await supabase.from('characters').update({ avatar_url: url }).eq('id', id).eq('user_id', userId)
        } catch {
          // the character exists already; a missing cover is recoverable from the editor
        }
      }
      await qc.invalidateQueries({ queryKey: qk.characters(userId) })
      onClose()
      router.push(`/characters/${id}/edit`)
    } catch (e) {
      setError((e as Error).message || '导入失败')
      setBusy(false)
    }
  }

  const summary = parsed ? summarize(parsed.card) : null

  return (
    <>
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <input
            ref={fileRef}
            type="file"
            accept=".json,.png,application/json,image/png"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) void pickFile(f)
              e.target.value = ''
            }}
          />
          <Button type="button" variant="neu" size="sm" onClick={() => fileRef.current?.click()} disabled={busy}><Upload /> 选择文件</Button>
          {fileName && (
            <span className="inline-flex items-center gap-1 text-xs text-cv-fg-muted">
              {/\.png$/i.test(fileName) ? <ImageIcon className="size-3.5" /> : <FileJson className="size-3.5" />} {fileName}
            </span>
          )}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="cv-card-json">或粘贴角色卡 JSON</Label>
          <Textarea
            id="cv-card-json"
            value={text}
            onChange={(e) => onTextChange(e.target.value)}
            placeholder='{ "spec": "chara_card_v2", "data": { "name": "...", "description": "..." } }'
            spellCheck={false}
            disabled={busy}
            className="max-h-56 min-h-32 font-mono text-xs leading-relaxed"
          />
        </div>

        {parsed && summary && (
          <div className="neu space-y-3 rounded-cv-md p-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-display text-base font-semibold">{parsed.card.name}</span>
              <Chip tone="info">来源：{SOURCE_LABEL[parsed.card.source]}</Chip>
            </div>
            <div className="flex flex-wrap gap-2">
              <Chip tone="outline">开场白 {summary.greetings} 条</Chip>
              <Chip tone="outline">模块 {summary.modules} 个</Chip>
              <Chip tone="outline">世界书 {summary.lorebook} 条</Chip>
              <Chip tone={parsed.avatarFile ? 'success' : 'outline'}>{parsed.avatarFile ? '带头像' : '无头像'}</Chip>
            </div>
            {parsed.card.warnings.length > 0 && (
              <ul className="space-y-1 text-xs text-cv-warning">
                {parsed.card.warnings.map((w, i) => <li key={i}>· {w}</li>)}
              </ul>
            )}
          </div>
        )}

        {error && <p role="alert" className="text-xs text-cv-danger">{error}</p>}
      </div>

      <DialogFooter className="gap-2">
        <Button type="button" variant="ghost" onClick={onClose} disabled={busy}>取消</Button>
        <Button type="button" disabled={!parsed || busy} onClick={() => void run()}>
          {busy ? <Loader2 className="animate-spin" /> : null}
          {busy ? '导入中…' : '导入'}
        </Button>
      </DialogFooter>
    </>
  )
}

function summarize(card: ImportedCard) {
  const parsedCard = parseCharacterCard({ name: card.name, prompt_template: card.prompt_template })
  const modules = Array.isArray(card.prompt_template.modules) ? card.prompt_template.modules.length : 0
  return { greetings: parsedCard.greetings.length, modules, lorebook: card.lorebook.entries.length }
}
