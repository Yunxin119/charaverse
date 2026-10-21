'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Lock, Loader2, Check, Eye, EyeOff } from 'lucide-react'
import { useAuth } from '@/providers/AuthProvider'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { GlassPanel, PosterCard, PosterTitle } from '@/components/glass'
import { ThemeToggle } from '@/components/shell'

/** Landing page of the password-reset email: the callback has already created a recovery session. */
export default function ResetPasswordPage() {
  const router = useRouter()
  const { user, loading, updatePassword } = useAuth()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [show, setShow] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  const mismatch = !!confirm && password !== confirm
  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (mismatch || password.length < 6) { setError('密码至少 6 位，两次输入要一致'); return }
    setBusy(true); setError(null)
    try {
      await updatePassword(password)
      setDone(true)
      setTimeout(() => router.replace('/chat'), 1200)
    } catch (err) {
      setError((err as Error).message || '设置失败，链接可能已过期')
    } finally { setBusy(false) }
  }

  return (
    <div className="relative grid min-h-dvh place-items-center px-4 py-6">
      <ThemeToggle className="absolute right-4 top-4" />
      <div className="w-full max-w-md">
        {loading ? (
          <div className="flex items-center justify-center gap-2 text-cv-fg-muted"><Loader2 className="size-5 animate-spin" />正在验证链接…</div>
        ) : !user ? (
          <PosterCard tone="ink">
            <PosterTitle>链接已失效</PosterTitle>
            <p className="mt-2 text-sm opacity-80">重置链接只能用一次，而且有时效。回登录页点「忘记密码？」再发一封。</p>
            <Button className="mt-5" variant="accent" onClick={() => router.replace('/login')}>回到登录</Button>
          </PosterCard>
        ) : (
          <GlassPanel strength="strong" padding="none" className="p-6 sm:p-8">
            <h1 className="font-display text-2xl font-semibold">设置新密码</h1>
            <p className="mt-1 text-sm text-cv-fg-muted">{user.email}</p>
            <form onSubmit={submit} className="mt-6 space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="pw">新密码</Label>
                <div className="relative">
                  <Lock className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-cv-fg-subtle" />
                  <Input id="pw" type={show ? 'text' : 'password'} autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} className="pl-11 pr-11" required minLength={6} />
                  <button type="button" aria-label={show ? '隐藏密码' : '显示密码'} onClick={() => setShow((v) => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-1.5 text-cv-fg-subtle hover:text-cv-fg">{show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}</button>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="pw2">再输一次</Label>
                <div className="relative">
                  <Lock className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-cv-fg-subtle" />
                  <Input id="pw2" type={show ? 'text' : 'password'} autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} className="pl-11" required aria-invalid={mismatch || undefined} />
                </div>
                {mismatch && <p className="text-xs text-cv-danger">两次输入的密码不一致</p>}
              </div>
              {error && <p className="text-sm text-cv-danger">{error}</p>}
              <Button type="submit" size="lg" disabled={busy || mismatch || done} className="w-full">{busy ? <Loader2 className="animate-spin" /> : done ? <Check /> : null}{done ? '已更新，正在进入…' : '保存新密码'}</Button>
            </form>
          </GlassPanel>
        )}
      </div>
    </div>
  )
}
