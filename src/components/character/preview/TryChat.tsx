'use client'

import { useRef, useState } from 'react'
import Link from 'next/link'
import { ArrowUp, Eraser, Loader2, Sparkles, Square } from 'lucide-react'
import { authedFetch } from '@/lib/authedFetch'
import { readUiTextStream } from '@/lib/llm/readStream'
import { useConnection } from '@/lib/llm/useConnection'
import { MessageContent } from '@/components/chat/MessageContent'
import { TypingIndicator } from '@/components/chat/TypingIndicator'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { buildPromptTemplate, type CharacterDraft } from '../form/types'

interface Props {
  draft: CharacterDraft
  presetId: string | null
}
interface Turn { role: 'user' | 'assistant'; content: string }

/**
 * 「试聊」: a scratch conversation against the unsaved draft via /api/chat/preview.
 * Nothing is stored; editing the card and sending again uses the new text immediately.
 */
export function TryChat({ draft, presetId }: Props) {
  const conn = useConnection()
  const headers = conn.headersFor(conn.defaultModel)
  const [turns, setTurns] = useState<Turn[]>([])
  const [input, setInput] = useState('')
  const [streaming, setStreaming] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const abortRef = useRef<AbortController | null>(null)
  const listRef = useRef<HTMLDivElement>(null)

  const run = async (next: Turn[], opening: boolean) => {
    if (!headers) return
    abortRef.current?.abort()
    const ac = new AbortController()
    abortRef.current = ac
    setError(null)
    setStreaming('')
    setTurns(next)
    let reply = ''
    let failure: string | null = null
    try {
      const res = await authedFetch('/api/chat/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...headers },
        body: JSON.stringify({
          character: { name: draft.name.trim() || '角色', prompt_template: buildPromptTemplate(draft), lorebook: draft.lorebook },
          messages: next,
          opening,
          presetId,
        }),
        signal: ac.signal,
      })
      if (!res.ok || !res.body) {
        const j = await res.json().catch(() => ({}))
        throw new Error(j.error || `请求失败（${res.status}）`)
      }
      const r = await readUiTextStream(res.body, (text) => { reply = text; setStreaming(text); listRef.current?.scrollTo({ top: listRef.current.scrollHeight }) })
      reply = r.text
      failure = r.error
    } catch (e) {
      if ((e as Error)?.name !== 'AbortError') failure = (e as Error)?.message || '网络错误'
    } finally {
      if (abortRef.current === ac) abortRef.current = null
    }
    setStreaming(null)
    if (reply.trim()) setTurns([...next, { role: 'assistant', content: reply }])
    if (failure) setError(failure)
  }

  const send = () => {
    const text = input.trim()
    if (!text || streaming !== null) return
    setInput('')
    void run([...turns, { role: 'user', content: text }], false)
  }
  const busy = streaming !== null

  if (!headers) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center text-sm text-cv-fg-muted">
        <p>试聊需要一个 API 连接。</p>
        <Button asChild size="sm" variant="neu"><Link href="/settings/connections">去添加连接</Link></Button>
      </div>
    )
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2">
      <div className="flex items-center justify-between gap-2 text-[11px] text-cv-fg-subtle">
        <span className="truncate">{conn.displayName(conn.defaultModel)} · 不会保存，改完设定直接再发</span>
        {turns.length > 0 && <button type="button" onClick={() => { abortRef.current?.abort(); setTurns([]); setError(null) }} className="flex shrink-0 items-center gap-1 hover:text-cv-fg"><Eraser className="size-3" />清空</button>}
      </div>
      <div ref={listRef} className="min-h-0 flex-1 space-y-2 overflow-y-auto rounded-cv-md bg-cv-bg-elevated/40 p-3">
        {turns.length === 0 && streaming === null && (
          <div className="flex h-full flex-col items-center justify-center gap-3 py-8 text-center">
            <p className="text-sm text-cv-fg-muted">用现在的草稿聊几句，看看 TA 像不像。</p>
            <Button size="sm" variant="accent" onClick={() => void run([], true)}><Sparkles />让 {draft.name.trim() || 'TA'} 先开口</Button>
          </div>
        )}
        {turns.map((t, i) => <Bubble key={i} role={t.role} text={t.content} name={t.role === 'user' ? '你' : draft.name.trim() || '角色'} />)}
        {streaming !== null && <Bubble role="assistant" text={streaming} name={draft.name.trim() || '角色'} typing />}
      </div>
      {error && <p className="text-xs text-cv-danger">{error}</p>}
      <div className="neu-in flex items-end gap-2 rounded-cv-lg py-1.5 pl-3 pr-1.5">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); send() } }}
          rows={1}
          placeholder={`对 ${draft.name.trim() || 'TA'} 说点什么…`}
          className="max-h-32 min-h-[36px] flex-1 resize-none bg-transparent py-1.5 text-sm leading-6 outline-none placeholder:text-cv-fg-subtle"
        />
        {busy ? (
          <button type="button" aria-label="停止" onClick={() => abortRef.current?.abort()} className="flex size-8 shrink-0 items-center justify-center rounded-full bg-cv-danger text-white"><Square className="size-3.5 fill-current" /></button>
        ) : (
          <button type="button" aria-label="发送" disabled={!input.trim()} onClick={send} className={cn('flex size-8 shrink-0 items-center justify-center rounded-full text-white', input.trim() ? 'bg-cv-accent' : 'bg-cv-fg/20 opacity-60')}><ArrowUp className="size-4" /></button>
        )}
      </div>
    </div>
  )
}

function Bubble({ role, text, name, typing }: { role: 'user' | 'assistant'; text: string; name: string; typing?: boolean }) {
  const user = role === 'user'
  return (
    <div className={cn('flex flex-col gap-0.5', user ? 'items-end' : 'items-start')}>
      <div className={cn('max-w-[92%] rounded-cv-lg px-3 py-2 text-sm [overflow-wrap:anywhere]', user ? 'bg-cv-primary text-cv-primary-fg' : 'glass-strong text-cv-fg')}>
        {text ? <MessageContent text={text} role={role} /> : typing ? <TypingIndicator /> : null}
      </div>
      <span className="px-1 text-[10px] text-cv-fg-subtle">{name}{typing ? ' · 正在输入…' : ''}{typing && !text ? <Loader2 className="ml-1 inline size-3 animate-spin" /> : null}</span>
    </div>
  )
}
