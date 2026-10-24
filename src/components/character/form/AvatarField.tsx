'use client'

import { useRef, useState } from 'react'
import { ImagePlus, Loader2, Trash2 } from 'lucide-react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { uploadAvatar } from '@/app/lib/avatarUpload'

interface Props {
  value: string
  name: string
  onChange: (url: string) => void
}

/** Round avatar preview with upload / remove. Uploads go to `avatars/characters`; the row is written on 保存. */
export function AvatarField({ value, name, onChange }: Props) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const pick = async (file: File) => {
    setUploading(true); setError(null)
    try {
      onChange(await uploadAvatar(file, 'avatars', 'characters'))
    } catch (e) {
      setError((e as Error).message || '上传失败，请重试')
    } finally {
      setUploading(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  return (
    <div className="flex items-center gap-4">
      <button
        type="button"
        onClick={() => fileRef.current?.click()}
        disabled={uploading}
        aria-label={value ? '更换头像' : '上传头像'}
        className="group relative shrink-0 rounded-full outline-none focus-visible:ring-2 focus-visible:ring-cv-ring"
      >
        <Avatar className="size-24 shadow-neu">
          <AvatarImage src={value || undefined} alt="" />
          <AvatarFallback className="bg-cv-primary font-display text-3xl text-cv-primary-fg">{name.trim() ? name.trim()[0].toUpperCase() : '?'}</AvatarFallback>
        </Avatar>
        <span className="absolute inset-0 flex items-center justify-center rounded-full bg-cv-primary/0 text-cv-primary-fg opacity-0 transition-[opacity,background-color] group-hover:bg-cv-primary/55 group-hover:opacity-100">
          {uploading ? <Loader2 className="size-6 animate-spin" /> : <ImagePlus className="size-6" />}
        </span>
      </button>
      <div className="min-w-0 space-y-2">
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="neu" size="sm" onClick={() => fileRef.current?.click()} disabled={uploading}>
            {uploading ? <Loader2 className="animate-spin" /> : <ImagePlus />}
            {value ? '更换头像' : '上传头像'}
          </Button>
          {value && (
            <Button type="button" variant="ghost" size="sm" onClick={() => onChange('')} disabled={uploading}>
              <Trash2 />移除
            </Button>
          )}
        </div>
        <p className="text-xs text-cv-fg-subtle">JPG / PNG，最大 10MB，上传后会自动压缩。</p>
        {error && <p role="alert" className="text-xs text-cv-danger">{error}</p>}
      </div>
      <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) void pick(f) }} />
    </div>
  )
}
