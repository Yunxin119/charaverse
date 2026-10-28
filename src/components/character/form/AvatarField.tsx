'use client'

import { useRef, useState } from 'react'
import { ImagePlus, Loader2, Trash2, X } from 'lucide-react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { IconButton } from '@/components/glass'
import { uploadAvatar } from '@/app/lib/avatarUpload'
import { cn } from '@/lib/utils'

interface Props {
  value: string
  name: string
  onChange: (url: string) => void
  /** storage folder inside the `avatars` bucket */
  folder?: 'characters' | 'personas'
  size?: 'md' | 'lg'
  /**
   * `row` (default): round avatar + text buttons + format hint.
   * `tile`: one square cover tile; click (or the hover overlay) to change, corner × to remove.
   */
  variant?: 'row' | 'tile'
  className?: string
}

/** Avatar preview with upload / remove. Uploads go to `avatars/<folder>`; the row is written on 保存. */
export function AvatarField({ value, name, onChange, folder = 'characters', size = 'lg', variant = 'row', className }: Props) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const pick = async (file: File) => {
    setUploading(true); setError(null)
    try {
      onChange(await uploadAvatar(file, 'avatars', folder))
    } catch (e) {
      setError((e as Error).message || '上传失败，请重试')
    } finally {
      setUploading(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }
  const initial = name.trim() ? name.trim()[0].toUpperCase() : '?'
  const fileInput = <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) void pick(f) }} />

  if (variant === 'tile') {
    return (
      <div className={cn('relative w-fit shrink-0', className)}>
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
          aria-label={value ? '更换头像' : '上传头像'}
          title="JPG / PNG，最大 10MB，上传后会自动压缩"
          className="group relative block rounded-cv-lg outline-none focus-visible:ring-2 focus-visible:ring-cv-ring"
        >
          <Avatar className="size-28 rounded-cv-lg shadow-neu sm:size-32">
            <AvatarImage src={value || undefined} alt="" className="rounded-cv-lg" />
            <AvatarFallback className="rounded-cv-lg bg-cv-primary font-display text-4xl text-cv-primary-fg">{initial}</AvatarFallback>
          </Avatar>
          <span className={cn(
            'absolute inset-0 flex flex-col items-center justify-center gap-1 rounded-cv-lg text-xs font-semibold text-cv-primary-fg transition-[opacity,background-color] duration-(--cv-dur-fast)',
            uploading || !value ? 'bg-cv-primary/55 opacity-100' : 'bg-cv-primary/0 opacity-0 group-hover:bg-cv-primary/55 group-hover:opacity-100 group-focus-visible:opacity-100'
          )}>
            {uploading ? <Loader2 className="size-5 animate-spin" /> : <ImagePlus className="size-5" />}
            {uploading ? '上传中' : value ? '换头像' : '上传头像'}
          </span>
        </button>
        {value && !uploading && (
          <IconButton label="移除头像" size="sm" variant="glass" className="absolute -right-2 -top-2 text-cv-fg hover:text-cv-danger" onClick={() => onChange('')}><X /></IconButton>
        )}
        {error && <p role="alert" className="mt-1.5 max-w-32 text-[11px] leading-snug text-cv-danger">{error}</p>}
        {fileInput}
      </div>
    )
  }

  return (
    <div className={cn('flex items-center gap-4', className)}>
      <button
        type="button"
        onClick={() => fileRef.current?.click()}
        disabled={uploading}
        aria-label={value ? '更换头像' : '上传头像'}
        className="group relative shrink-0 rounded-full outline-none focus-visible:ring-2 focus-visible:ring-cv-ring"
      >
        <Avatar className={size === 'lg' ? 'size-24 shadow-neu' : 'size-16 shadow-neu'}>
          <AvatarImage src={value || undefined} alt="" />
          <AvatarFallback className="bg-cv-primary font-display text-3xl text-cv-primary-fg">{initial}</AvatarFallback>
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
      {fileInput}
    </div>
  )
}
