'use client'

import { useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { BookOpenText, Eraser, PencilLine, Rows3, Sparkles } from 'lucide-react'
import type { ChatMessage } from '@/app/lib/supabase'
import { authedFetch } from '@/lib/authedFetch'
import { readUiTextStream } from '@/lib/llm/readStream'
import { useConnection } from '@/lib/llm/useConnection'
import { composeSkinCss } from '@/lib/skins/knobs'
import { parseSessionSettings } from '@/lib/chat/settings'
import { parseCharacterCard } from '@/lib/chat/characterCard'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { ChatHeader } from '@/components/chat/ChatHeader'
import { ChatSurface, backdropFor, type ChatLayout } from '@/components/chat/ChatSurface'
import { Composer } from '@/components/chat/Composer'
import { MessageList } from '@/components/chat/MessageList'
import { VisualNovelStage } from '@/components/chat/VisualNovelStage'
import { cn } from '@/lib/utils'
import { buildPromptTemplate, type CharacterDraft } from '../form/types'

interface Props {
  draft: CharacterDraft
  /** preset for the scratch replies (null = built-in) */
  presetId: string | null
  /** editable sample AI reply, shown until a real reply arrives; the regex test benches use it too */
  sample: string
  onSampleChange: (v: string) => void
  className?: string
}
interface Turn { role: 'user' | 'assistant'; content: string }

const noop = () => {}

/**
 * The real chat page, fed with the unsaved draft: its opening line(s), a sample reply, and a
 * scratch conversation against /api/chat/preview. Same DOM as the live chat (ChatSurface +
 * the real header, list, stage and composer), so the skin's CSS, regex scripts and HTML
 * blocks render exactly as players will see them. Nothing here is stored.
 */
export function LivePreview({ draft, presetId, sample, onSampleChange, className }: Props) {
  const conn = useConnection()
  const headers = conn.headersFor(conn.defaultModel)
  const card = useMemo(() => parseCharacterCard({ name: draft.name || '角色', prompt_template: buildPromptTemplate(draft) }), [draft])
  const [layout, setLayout] = useState<ChatLayout>('flow')
  const [turns, setTurns] = useState<Turn[]>([])
  const [input, setInput] = useState('')
  const [streaming, setStreaming] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [sampleOpen, setSampleOpen] = useState(false)
  const abortRef = useRef<AbortController | null>(null)

  const name = card.name
  const messages = useMemo<ChatMessage[]>(() => {
    const t = new Date().toISOString()
    const out: ChatMessage[] = []
    let id = 1
    const greetings = card.greetings
    if (greetings.length) out.push({ id: id++, session_id: 'preview', role: 'assistant', content: greetings[0], type: 'message', created_at: t, swipes: greetings.length > 1 ? greetings : [], swipe_index: 0 })
    // the sample stands in for a reply until you actually chat
    if (turns.length === 0 && streaming === null && sample.trim()) out.push({ id: id++, session_id: 'preview', role: 'assistant', content: sample, type: 'message', created_at: t })
    for (const turn of turns) out.push({ id: id++, session_id: 'preview', role: turn.role, content: turn.content, type: 'message', created_at: t })
    return out
  }, [card.greetings, sample, turns, streaming])

  const run = async (next: Turn[], opening: boolean) => {
    if (!headers) { setError('试聊需要一个 API 连接'); return }
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
          character: { name, prompt_template: buildPromptTemplate(draft), lorebook: draft.lorebook },
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
      const r = await readUiTextStream(res.body, (text) => { reply = text; setStreaming(text) })
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
  const stop = () => abortRef.current?.abort()
  const regenerate = () => {
    const last = turns[turns.length - 1]
    if (!last || last.role !== 'assistant') return
    void run(turns.slice(0, -1), false)
  }
  const clear = () => { stop(); setTurns([]); setError(null) }

  const characterSpeaker = { name, avatarUrl: draft.avatar_url || null }
  const userSpeaker = { name: card.userName }
  const renderSkin = { regexScripts: draft.skin.regexScripts, renderHtml: draft.skin.renderHtml, char: name, user: card.userName }
  // a fresh session's defaults: no custom image, avatar as backdrop
  const backdrop = backdropFor(parseSessionSettings({}).background, layout, draft.avatar_url || null)
  const novel = layout === 'novel'
  const busy = streaming !== null
  const composerProps = { value: input, onChange: setInput, onSend: send, onStop: stop, streaming: busy, placeholder: headers ? `对 ${name} 说点什么…（试聊，不会保存）` : '试聊需要先添加 API 连接' }
  const lastMessage = messages[messages.length - 1]

  return (
    <div className={cn('flex min-h-0 flex-col gap-2', className)}>
      <div className="flex flex-wrap items-center gap-1 text-xs">
        <span className="min-w-0 flex-1 truncate text-cv-fg-subtle">
          {headers ? `${conn.displayName(conn.defaultModel)} · 回复不保存，改完设定直接再发` : <>试聊需要 API 连接，<Link href="/settings/connections" className="text-cv-accent underline-offset-4 hover:underline">去添加</Link></>}
        </span>
        {!card.greetings.length && headers && turns.length === 0 && !busy && (
          <Button type="button" size="sm" variant="accent" onClick={() => void run([], true)} title="没写开场白时，让模型按设定先开口"><Sparkles /> 让 TA 先开口</Button>
        )}
        <Button type="button" size="sm" variant={sampleOpen ? 'accent' : 'ghost'} onClick={() => setSampleOpen((v) => !v)} title="改测试用的 AI 回复（正则测试台也用它）"><PencilLine /> 测试回复</Button>
        <Button type="button" size="sm" variant="ghost" onClick={clear} disabled={!turns.length && !busy} title="清掉试聊内容"><Eraser /> 清空</Button>
        <Button type="button" size="sm" variant="neu" onClick={() => setLayout(novel ? 'flow' : 'novel')} title="切换布局，只影响预览">
          {novel ? <Rows3 /> : <BookOpenText />}{novel ? '对话流' : '视觉小说'}
        </Button>
      </div>
      {sampleOpen && (
        <div className="space-y-1.5">
          <Label htmlFor="skin-sample" className="text-xs">测试用的 AI 回复（可粘贴美化卡输出；没有真回复时显示它）</Label>
          <Textarea id="skin-sample" value={sample} onChange={(e) => onSampleChange(e.target.value)} className="min-h-24 font-mono text-xs" spellCheck={false} />
        </div>
      )}
      {error && <p className="text-xs text-cv-danger">{error}</p>}
      <div className="min-h-0 flex-1 overflow-hidden rounded-cv-lg border border-cv-border bg-cv-bg shadow-glass">
        <ChatSurface
          className="h-full"
          skinCss={composeSkinCss(draft.skin.knobs, draft.skin.css)}
          allowedUrlHosts={draft.skin.allowedUrlHosts}
          layout={layout}
          backdrop={backdrop}
          header={
            // the real header, but inert: its buttons would navigate away from the editor
            <div inert className="contents">
              <ChatHeader sessionId="preview" character={{ id: 0, ...characterSpeaker }} modelLabel={headers ? conn.displayName(conn.defaultModel) : '预览'} onOpenSettings={noop} layout={layout} onToggleLayout={noop} floating={novel} revealed={false} />
            </div>
          }
          messageList={
            <MessageList
              messages={messages}
              character={characterSpeaker}
              user={userSpeaker}
              skin={renderSkin}
              streamingText={streaming}
              busy={busy}
              selectedId={null}
              editingId={null}
              onSelect={noop}
              handlersFor={() => ({})}
              onEditSave={noop}
              onEditCancel={noop}
              onSwipe={noop}
              hasOlder={false}
              loadingOlder={false}
              onLoadOlder={noop}
            />
          }
          composer={<Composer {...composerProps} />}
          stage={novel ? (
            <VisualNovelStage
              messages={messages}
              character={characterSpeaker}
              user={userSpeaker}
              skin={renderSkin}
              streamingText={streaming}
              busy={busy}
              onSwipe={noop}
              onRegenerate={lastMessage?.role === 'assistant' && turns.length ? regenerate : undefined}
              onOpenLog={noop}
              composer={composerProps}
            />
          ) : undefined}
        />
      </div>
    </div>
  )
}
