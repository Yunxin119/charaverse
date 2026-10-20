'use client'

import { supabase } from '@/app/lib/supabase'
import { compressImage, validateImageFile } from '@/app/lib/imageUtils'

const BUCKET = 'chat-backgrounds'

/** Upload (compressed) background image for a session; returns its public URL. */
export async function uploadChatBackground(userId: string, sessionId: string, file: File): Promise<string> {
  validateImageFile(file)
  const { file: compressed } = await compressImage(file, 1600, 1600, 0.82)
  const ext = compressed.type === 'image/png' ? 'png' : compressed.type === 'image/webp' ? 'webp' : 'jpg'
  const path = `${userId}/${sessionId}.${ext}`
  const { error } = await supabase.storage.from(BUCKET).upload(path, compressed, { upsert: true, contentType: compressed.type })
  if (error) throw error
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path)
  return `${data.publicUrl}?v=${Date.now()}`
}

export async function removeChatBackground(userId: string, sessionId: string): Promise<void> {
  const paths = ['png', 'webp', 'jpg'].map((ext) => `${userId}/${sessionId}.${ext}`)
  await supabase.storage.from(BUCKET).remove(paths)
}
