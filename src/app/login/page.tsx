'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { motion } from 'framer-motion'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { GlassPanel, PosterCard, PosterTitle, Chip } from '@/components/glass'
import { ThemeToggle } from '@/components/shell'
import { useAuth } from '@/providers/AuthProvider'
import { Loader2, Mail, Lock, User, Sparkles, Eye, EyeOff, ArrowRight } from 'lucide-react'

function LoginForm() {
  const [isSignUp, setIsSignUp] = useState(false)
  const [email, setEmail] = useState('')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)

  const [error, setError] = useState<string | null>(null)
  const [pendingEmail, setPendingEmail] = useState<string | null>(null)
  const [resent, setResent] = useState(false)
  const [loading, setLoading] = useState(false)

  const { user, signIn, signUp, resendConfirmation } = useAuth()
  const router = useRouter()
  const searchParams = useSearchParams()
  // Only allow same-origin relative paths as the post-login destination.
  const rawNext = searchParams.get('next')
  const nextPath = rawNext && rawNext.startsWith('/') && !rawNext.startsWith('//') ? rawNext : '/chat'
  const verifyFailed = searchParams.get('verify') === 'failed'
  const verifyReason = searchParams.get('reason')

  useEffect(() => {
    if (user) {
      router.replace(nextPath)
    }
  }, [user, router, nextPath])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (isSignUp && password !== confirmPassword) return

    setError(null)
    setLoading(true)
    try {
      if (isSignUp) {
        const r = await signUp(email, password, username)
        if (r.needsConfirmation) { setPendingEmail(email); return }
      } else {
        await signIn(email, password)
      }
      router.replace(nextPath)
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : (isSignUp ? '注册失败' : '登录失败'))
    } finally {
      setLoading(false)
    }
  }

  const switchMode = () => {
    setIsSignUp((v) => !v)
    setError(null)
    setConfirmPassword('')
    setUsername('')
    setShowPassword(false)
    setShowConfirmPassword(false)
  }

  const mismatch = isSignUp && !!confirmPassword && password !== confirmPassword

  return (
    <div className="relative min-h-dvh px-4 py-6 sm:px-6 md:grid md:place-items-center">
      <ThemeToggle className="absolute right-4 top-4 z-10" />

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.2, 0.8, 0.2, 1] }}
        className="mx-auto grid w-full max-w-5xl gap-4 md:grid-cols-[1.1fr_1fr] md:gap-6"
      >
        {/* Poster side */}
        <PosterCard tone="ink" className="flex min-h-[200px] flex-col justify-between p-6 sm:p-8 md:min-h-[560px]">
          <div className="flex items-center gap-2">
            <span className="flex size-9 items-center justify-center rounded-cv-sm bg-cv-accent text-white shadow-[0_10px_24px_-10px_var(--cv-accent)]">
              <Sparkles className="size-4" />
            </span>
            <span className="font-mono text-[11px] uppercase tracking-[0.2em] opacity-70">CharaVerse</span>
          </div>
          <div className="mt-8 md:mt-0">
            <PosterTitle className="text-3xl sm:text-4xl md:text-5xl md:leading-[1.05]">
              你的角色，<br />
              <em className="font-medium italic opacity-90">有自己的宇宙。</em>
            </PosterTitle>
            <p className="mt-4 max-w-sm text-sm opacity-80 sm:text-base">
              创建人设、导入预设与皮肤，用你自己的模型和 API Key 开始一段不会被遗忘的对话。
            </p>
            <div className="mt-5 flex flex-wrap gap-2">
              <Chip tone="outline" className="border-white/20 bg-white/10 text-[var(--cv-cream-200)]">BYOK · 密钥只在你的浏览器</Chip>
              <Chip tone="outline" className="border-white/20 bg-white/10 text-[var(--cv-cream-200)]">长期记忆</Chip>
              <Chip tone="outline" className="border-white/20 bg-white/10 text-[var(--cv-cream-200)]">可导入主题 / 预设</Chip>
            </div>
          </div>
        </PosterCard>

        {/* Form side */}
        <GlassPanel strength="strong" padding="none" className="p-6 sm:p-8">
          <div className="mb-6">
            <h1 className="font-display text-2xl font-semibold">{isSignUp ? '创建账户' : '欢迎回来'}</h1>
            <p className="mt-1 text-sm text-cv-fg-muted">{isSignUp ? '几秒钟就好，然后开始你的第一段对话。' : '登录以继续你的冒险。'}</p>
          </div>

          {pendingEmail ? (
            <div className="space-y-4">
              <div className="rounded-cv-md neu px-4 py-4 text-sm">
                <div className="font-semibold">验证邮件已发送到 {pendingEmail}</div>
                <p className="mt-1 text-cv-fg-muted">点邮件里的链接完成验证，页面会自动登录并进入对话。没收到的话看看垃圾箱，或者一分钟后重发。</p>
              </div>
              {error && <p className="text-sm text-cv-danger">{error}</p>}
              <div className="flex flex-wrap gap-2">
                <Button variant="neu" size="sm" disabled={resent} onClick={async () => { setError(null); try { await resendConfirmation(pendingEmail); setResent(true); setTimeout(() => setResent(false), 60_000) } catch (e) { setError((e as Error).message || '重发失败') } }}>{resent ? '已重发，稍后再试' : '重发验证邮件'}</Button>
                <Button variant="ghost" size="sm" onClick={() => { setPendingEmail(null); setIsSignUp(false); setError(null) }}>返回登录</Button>
              </div>
            </div>
          ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="email">邮箱</Label>
              <div className="relative">
                <Mail className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-cv-fg-subtle" />
                <Input id="email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} className="pl-11" placeholder="you@example.com" required />
              </div>
            </div>

            {isSignUp && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="space-y-1.5">
                <Label htmlFor="username">用户名</Label>
                <div className="relative">
                  <User className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-cv-fg-subtle" />
                  <Input id="username" type="text" autoComplete="username" value={username} onChange={(e) => setUsername(e.target.value)} className="pl-11" placeholder="别人会看到的名字" required={isSignUp} />
                </div>
              </motion.div>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="password">密码</Label>
              <div className="relative">
                <Lock className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-cv-fg-subtle" />
                <Input id="password" type={showPassword ? 'text' : 'password'} autoComplete={isSignUp ? 'new-password' : 'current-password'} value={password} onChange={(e) => setPassword(e.target.value)} className="pl-11 pr-11" placeholder="••••••••" required />
                <button type="button" aria-label={showPassword ? '隐藏密码' : '显示密码'} onClick={() => setShowPassword((v) => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-1.5 text-cv-fg-subtle hover:text-cv-fg">
                  {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
            </div>

            {isSignUp && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="space-y-1.5">
                <Label htmlFor="confirmPassword">确认密码</Label>
                <div className="relative">
                  <Lock className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-cv-fg-subtle" />
                  <Input id="confirmPassword" type={showConfirmPassword ? 'text' : 'password'} autoComplete="new-password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} className="pl-11 pr-11" placeholder="再输一次" required aria-invalid={mismatch || undefined} />
                  <button type="button" aria-label={showConfirmPassword ? '隐藏密码' : '显示密码'} onClick={() => setShowConfirmPassword((v) => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-1.5 text-cv-fg-subtle hover:text-cv-fg">
                    {showConfirmPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </button>
                </div>
                {mismatch && <p className="text-xs text-cv-danger">两次输入的密码不一致</p>}
              </motion.div>
            )}

            {verifyFailed && !error && (
              <div role="alert" className="rounded-cv-md border border-cv-danger/30 bg-[color-mix(in_oklab,var(--cv-danger)_10%,transparent)] px-4 py-3 text-sm text-cv-danger">
                邮箱验证失败{verifyReason ? `：${verifyReason}` : ''}。链接可能已过期，登录后可重发验证邮件。
              </div>
            )}
            {error && (
              <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} role="alert" className="rounded-cv-md border border-cv-danger/30 bg-[color-mix(in_oklab,var(--cv-danger)_10%,transparent)] px-4 py-3 text-sm text-cv-danger">
                {error}
              </motion.div>
            )}

            <Button type="submit" size="lg" disabled={loading || mismatch} className="w-full">
              {loading ? (
                <>
                  <Loader2 className="animate-spin" />
                  {isSignUp ? '创建中…' : '登录中…'}
                </>
              ) : (
                <>
                  {isSignUp ? '创建账户' : '登录'}
                  <ArrowRight />
                </>
              )}
            </Button>

            <button type="button" onClick={switchMode} className="block w-full text-center text-sm text-cv-fg-muted transition-colors hover:text-cv-fg">
              {isSignUp ? '已有账户？立即登录' : '还没有账户？立即注册'}
            </button>
          </form>
          )}

          <p className="mt-6 text-center text-xs text-cv-fg-subtle">继续使用即表示你同意我们的服务条款</p>
        </GlassPanel>
      </motion.div>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  )
}
