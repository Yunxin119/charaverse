import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import { createServerSupabase } from '@/lib/supabase/server'
import { describeTemplate, parseSnapshot } from '@/components/character/snapshot'

/**
 * Link previews for shared character pages: title, intro and avatar from the
 * published snapshot (public rows only; RLS hides everything else).
 */
export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params
  const numeric = Number(id)
  if (!Number.isFinite(numeric)) return { title: '角色' }
  try {
    const supabase = await createServerSupabase()
    const { data } = await supabase
      .from('characters')
      .select('name, avatar_url, published_snapshot, is_public')
      .eq('id', numeric)
      .eq('is_public', true)
      .maybeSingle()
    if (!data) return { title: '角色', robots: { index: false } }
    const snapshot = parseSnapshot(data.published_snapshot)
    const name = snapshot?.name ?? (data.name as string)
    const intro = describeTemplate(snapshot?.prompt_template).introduction?.trim()
    const description = intro ? (intro.length > 160 ? `${intro.slice(0, 157)}…` : intro) : `在 CharaVerse 和 ${name} 聊天`
    const image = snapshot ? snapshot.avatar_url : (data.avatar_url as string | null)
    return {
      title: name,
      description,
      openGraph: {
        type: 'website',
        title: `${name} · CharaVerse`,
        description,
        url: `/character/public/${numeric}`,
        images: image ? [{ url: image, alt: name }] : undefined,
      },
      twitter: { card: image ? 'summary_large_image' : 'summary', title: `${name} · CharaVerse`, description, images: image ? [image] : undefined },
    }
  } catch {
    return { title: '角色' }
  }
}

export default function PublicCharacterLayout({ children }: { children: ReactNode }) {
  return children
}
