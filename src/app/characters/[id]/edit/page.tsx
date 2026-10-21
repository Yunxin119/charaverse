'use client'

import Link from 'next/link'
import { useParams } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import { useAuth } from '@/providers/AuthProvider'
import { useCharacter } from '@/queries'
import { Button } from '@/components/ui/button'
import { GlassPanel } from '@/components/glass'
import { CharacterForm } from '@/components/character/CharacterForm'

export default function EditCharacterPage() {
  const { id } = useParams<{ id: string }>()
  const { user, loading } = useAuth()
  const q = useCharacter(id)

  if (loading || q.isLoading) {
    return <div className="flex min-h-[60vh] items-center justify-center text-cv-fg-muted"><Loader2 className="mr-2 size-5 animate-spin" />加载角色…</div>
  }

  const notice = !user ? '请先登录' : !q.data ? '找不到这个角色' : q.data.user_id !== user.id ? '只有角色作者可以编辑' : null
  if (notice || !q.data) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-6 sm:px-6">
        <GlassPanel className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-cv-fg-muted">{notice}</p>
          <Button asChild variant="neu" size="sm"><Link href="/characters">回到我的角色</Link></Button>
        </GlassPanel>
      </div>
    )
  }

  return <CharacterForm key={q.data.id} mode="edit" character={q.data} />
}
