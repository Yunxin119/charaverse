'use client'

import { Suspense, useEffect, useRef } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import { useAuth } from '@/providers/AuthProvider'
import { useStartSession } from '@/queries/useChatMutations'
import { ChatView } from '@/components/chat'

function NewSession({ characterId }: { characterId: number }) {
  const router = useRouter()
  const { user } = useAuth()
  const start = useStartSession()
  const started = useRef(false)

  useEffect(() => {
    if (!user || started.current) return
    started.current = true
    start.mutate(
      { userId: user.id, characterId },
      {
        onSuccess: ({ sessionId, needsOpening }) => router.replace(`/chat/${sessionId}${needsOpening ? '?opening=1' : ''}`),
        onError: () => router.replace('/characters'),
      }
    )
  }, [user, characterId, start, router])

  return <div className="flex h-dvh items-center justify-center text-cv-fg-muted"><Loader2 className="mr-2 size-5 animate-spin" />正在准备对话…</div>
}

function ChatPageInner() {
  const params = useParams<{ sessionId: string }>()
  const searchParams = useSearchParams()
  const sessionId = params.sessionId

  if (sessionId === 'new') {
    const characterId = Number(searchParams.get('characterId'))
    if (!characterId) return <div className="p-6 text-cv-fg-muted">缺少 characterId</div>
    return <NewSession characterId={characterId} />
  }
  return <ChatView sessionId={sessionId} />
}

export default function ChatPage() {
  return (
    <Suspense fallback={null}>
      <ChatPageInner />
    </Suspense>
  )
}
