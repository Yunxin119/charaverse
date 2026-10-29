import { redirect } from 'next/navigation'

/** The skin is edited inside the character editor now; keep old links working. */
export default async function CharacterSkinPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  redirect(`/characters/${id}/edit?section=skin`)
}
