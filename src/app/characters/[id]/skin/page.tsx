'use client'

import { useParams } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import { useAuth } from '@/providers/AuthProvider'
import { useCharacter } from '@/queries'
import { SkinEditor } from '@/components/skins/SkinEditor'

export default function CharacterSkinPage() {
  const { id } = useParams<{ id: string }>()
  const { user } = useAuth()
  const q = useCharacter(id)

  if (q.isLoading || !user) return <div className="flex h-dvh items-center justify-center text-cv-fg-muted"><Loader2 className="mr-2 size-5 animate-spin" />加载角色…</div>
  if (!q.data) return <div className="p-6 text-cv-fg-muted">找不到这个角色</div>
  if (q.data.user_id !== user.id) return <div className="p-6 text-cv-fg-muted">只有角色作者可以编辑皮肤</div>
  return <SkinEditor key={q.data.id} character={q.data} />
}
