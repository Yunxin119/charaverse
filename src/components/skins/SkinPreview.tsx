'use client'

import { useMemo, useState } from 'react'
import { BookOpenText, RotateCcw, Rows3, PencilLine } from 'lucide-react'
import type { Character, ChatMessage } from '@/app/lib/supabase'
import type { Skin } from '@/lib/skins/schema'
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

interface Props {
  character: Character
  skin: Skin
  /** editable sample AI reply (paste a beautified-card output to test regex / HTML) */
  sample: string
  onSampleChange: (v: string) => void
  className?: string
}

const noop = () => {}
const PREVIEW_USER_LINE = '不急。茶就茶吧，反正也睡不着。'

/**
 * The real chat page, fed with the character's opening line(s), a user line and an
 * editable sample reply. Same DOM as the live chat (ChatSurface + the real header,
 * list, stage and composer), so what you see here is what players get. Typing in the
 * composer appends a user bubble locally; nothing is sent or saved.
 */
export function SkinPreview({ character, skin, sample, onSampleChange, className }: Props) {
  const card = useMemo(() => parseCharacterCard(character), [character])
  const [layout, setLayout] = useState<ChatLayout>('flow')
  const [typed, setTyped] = useState<string[]>([])
  const [input, setInput] = useState('')
  const [sampleOpen, setSampleOpen] = useState(false)

  const messages = useMemo<ChatMessage[]>(() => {
    const t = new Date().toISOString()
    const out: ChatMessage[] = []
    let id = 1
    const greetings = card.greetings
    if (greetings.length) {
      out.push({ id: id++, session_id: 'preview', role: 'assistant', content: greetings[0], type: 'message', created_at: t, swipes: greetings.length > 1 ? greetings : [], swipe_index: 0 })
    }
    out.push({ id: id++, session_id: 'preview', role: 'user', content: PREVIEW_USER_LINE, type: 'message', created_at: t })
    out.push({ id: id++, session_id: 'preview', role: 'assistant', content: sample, type: 'message', created_at: t })
    for (const line of typed) out.push({ id: id++, session_id: 'preview', role: 'user', content: line, type: 'message', created_at: t })
    return out
  }, [card.greetings, sample, typed])

  const characterSpeaker = { name: card.name, avatarUrl: character.avatar_url }
  const userSpeaker = { name: card.userName }
  const renderSkin = { regexScripts: skin.regexScripts, renderHtml: skin.renderHtml, char: card.name, user: card.userName }
  // a fresh session's defaults: no custom image, avatar as backdrop
  const backdrop = backdropFor(parseSessionSettings({}).background, layout, character.avatar_url)
  const novel = layout === 'novel'

  const send = () => {
    const text = input.trim()
    if (!text) return
    setTyped((l) => [...l, text])
    setInput('')
  }
  const composerProps = { value: input, onChange: setInput, onSend: send, onStop: noop, streaming: false, placeholder: `对 ${card.name} 说点什么…（只在预览里显示）` }
  const lastMessage = messages[messages.length - 1]

  const messageList = (
    <MessageList
      messages={messages}
      character={characterSpeaker}
      user={userSpeaker}
      skin={renderSkin}
      streamingText={null}
      busy={false}
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
  )

  return (
    <div className={cn('flex min-h-0 flex-col gap-2', className)}>
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className="font-semibold uppercase tracking-[0.14em] text-cv-fg-subtle">实时预览</span>
        <span className="text-cv-fg-subtle">开场白 + 一句你的话 + 测试回复，和玩家看到的一样</span>
        <span className="ml-auto flex items-center gap-1">
          <Button size="sm" variant={sampleOpen ? 'accent' : 'ghost'} onClick={() => setSampleOpen((v) => !v)} title="改测试用的 AI 回复"><PencilLine /> 测试回复</Button>
          <Button size="sm" variant="ghost" onClick={() => { setTyped([]); setInput('') }} disabled={!typed.length} title="清掉你在预览里打的话"><RotateCcw /> 重置</Button>
          <Button size="sm" variant="neu" onClick={() => setLayout(novel ? 'flow' : 'novel')} title="切换布局，只影响预览">
            {novel ? <Rows3 /> : <BookOpenText />}{novel ? '对话流' : '视觉小说'}
          </Button>
        </span>
      </div>
      {sampleOpen && (
        <div className="space-y-1.5">
          <Label htmlFor="skin-sample" className="text-xs">测试用的 AI 回复（可粘贴美化卡输出；正则测试台也用它）</Label>
          <Textarea id="skin-sample" value={sample} onChange={(e) => onSampleChange(e.target.value)} className="min-h-24 font-mono text-xs" spellCheck={false} />
        </div>
      )}
      <div className="min-h-0 flex-1 overflow-hidden rounded-cv-lg border border-cv-border bg-cv-bg shadow-glass">
        <ChatSurface
          className="h-full"
          skinCss={composeSkinCss(skin.knobs, skin.css)}
          allowedUrlHosts={skin.allowedUrlHosts}
          layout={layout}
          backdrop={backdrop}
          header={
            // the real header, but inert: its buttons would navigate away from the editor
            <div inert className="contents">
              <ChatHeader sessionId="preview" character={{ id: character.id, ...characterSpeaker }} modelLabel="预览" onOpenSettings={noop} layout={layout} onToggleLayout={noop} floating={novel} revealed={false} />
            </div>
          }
          messageList={messageList}
          composer={<Composer {...composerProps} />}
          stage={novel ? (
            <VisualNovelStage
              messages={messages}
              character={characterSpeaker}
              user={userSpeaker}
              skin={renderSkin}
              streamingText={null}
              busy={false}
              onSwipe={noop}
              onRegenerate={lastMessage?.role === 'assistant' ? noop : undefined}
              onOpenLog={noop}
              composer={composerProps}
            />
          ) : undefined}
        />
      </div>
    </div>
  )
}
