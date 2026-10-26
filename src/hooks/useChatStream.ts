'use client'

import { useCallback, useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { authedFetch } from '@/lib/authedFetch'
import { qk } from '@/queries/keys'
import { readUiTextStream } from '@/lib/llm/readStream'

export type ChatAction = 'send' | 'opening' | 'regenerate' | 'continue' | 'inspire'

export interface RunOptions {
  action: ChatAction
  text?: string
  messageId?: number
  /** headers from useConnection().headersFor(model) */
  headers: Record<string, string>
  /** show the streamed text as an in-progress assistant bubble (default true; false for `inspire`) */
  render?: boolean
}

export type StreamStatus = 'idle' | 'streaming' | 'error'

/**
 * Drives one generation against /api/chat and exposes the partial text while it streams.
 * The DB stays the source of truth: when the stream ends we refetch the session's messages.
 */
export function useChatStream(sessionId: string | undefined) {
  const qc = useQueryClient()
  const [streamingText, setStreamingText] = useState('')
  const [streamingAction, setStreamingAction] = useState<ChatAction | null>(null)
  const [status, setStatus] = useState<StreamStatus>('idle')
  const [error, setError] = useState<string | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  const stop = useCallback(() => {
    abortRef.current?.abort()
  }, [])

  const run = useCallback(
    async (opts: RunOptions): Promise<string> => {
      if (!sessionId) throw new Error('no session')
      abortRef.current?.abort()
      const ac = new AbortController()
      abortRef.current = ac
      const render = opts.render ?? opts.action !== 'inspire'

      setError(null)
      setStatus('streaming')
      setStreamingAction(opts.action)
      if (render) setStreamingText('')

      let full = ''
      let streamError: string | null = null
      try {
        const res = await authedFetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...opts.headers },
          body: JSON.stringify({ sessionId, action: opts.action, text: opts.text, messageId: opts.messageId }),
          signal: ac.signal,
        })
        if (!res.ok || !res.body) {
          const j = await res.json().catch(() => ({}))
          throw new Error(j.error || `请求失败（${res.status}）`)
        }
        // user message is persisted before streaming starts: show it right away
        if (opts.action === 'send') void qc.invalidateQueries({ queryKey: qk.messages(sessionId) })

        const r = await readUiTextStream(res.body, (text) => { full = text; if (render) setStreamingText(text) })
        full = r.text
        if (r.error) streamError = r.error
      } catch (e) {
        if ((e as Error)?.name !== 'AbortError') streamError = (e as Error)?.message || '网络错误'
      } finally {
        if (abortRef.current === ac) abortRef.current = null
      }

      // refresh persisted messages, then drop the temporary bubble
      if (opts.action !== 'inspire') await qc.invalidateQueries({ queryKey: qk.messages(sessionId) })
      setStreamingText('')
      setStreamingAction(null)
      if (streamError) {
        setError(streamError)
        setStatus('error')
        throw new Error(streamError)
      }
      setStatus('idle')
      return full
    },
    [sessionId, qc]
  )

  const clearError = useCallback(() => { setError(null); setStatus('idle') }, [])

  return { run, stop, status, error, clearError, streamingText, streamingAction, isStreaming: status === 'streaming' }
}
