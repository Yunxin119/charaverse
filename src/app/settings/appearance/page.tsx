'use client'

import { useState } from 'react'
import { Download, Upload, Check, Trash2, Sun, Moon, MonitorSmartphone, Loader2 } from 'lucide-react'
import { useAuth } from '@/providers/AuthProvider'
import { useTheme, type ThemeMode } from '@/app/contexts/ThemeContext'
import { BUILTIN_THEMES } from '@/lib/theme/builtin'
import { themeSchema, type ThemeFile } from '@/lib/theme/schema'
import { useDeleteTheme, useSaveTheme, useSetActiveTheme, useUserThemes } from '@/queries/useThemes'
import { Button } from '@/components/ui/button'
import { GlassPanel, Chip, IconButton } from '@/components/glass'
import { ThemeImportDialog } from '@/components/theme/ThemeImportDialog'
import { cn } from '@/lib/utils'

const MODES: { id: ThemeMode; label: string; icon: typeof Sun }[] = [
  { id: 'light', label: '浅色', icon: Sun },
  { id: 'dark', label: '深色', icon: Moon },
  { id: 'system', label: '跟随系统', icon: MonitorSmartphone },
]

function download(name: string, text: string) {
  const a = document.createElement('a')
  a.href = URL.createObjectURL(new Blob([text], { type: 'application/json' }))
  a.download = `${name.replace(/[^\w一-龥-]+/g, '_')}.cv-theme.json`
  a.click()
  setTimeout(() => URL.revokeObjectURL(a.href), 1000)
}

export default function AppearancePage() {
  const { user } = useAuth()
  const { theme, setTheme, userTheme, setUserTheme } = useTheme()
  const themes = useUserThemes(user?.id)
  const save = useSaveTheme(user?.id)
  const setActive = useSetActiveTheme(user?.id)
  const del = useDeleteTheme(user?.id)
  const [importOpen, setImportOpen] = useState(false)

  const activeId = themes.data?.find((t) => t.is_active)?.id ?? null
  const builtinActive = !userTheme

  const applyBuiltin = async (id: string) => {
    const b = BUILTIN_THEMES.find((t) => t.id === id)!
    const parsed = themeSchema.parse(b.theme)
    const hasOverrides = Object.keys(parsed.tokens).length > 0 || parsed.glass.blur !== undefined || Object.keys(parsed.radius).length > 0
    if (!hasOverrides) {
      setUserTheme(null)
      setTheme(parsed.mode)
      if (user) await setActive.mutateAsync(null)
      return
    }
    // store a copy so it syncs across devices
    const existing = themes.data?.find((t) => t.name === parsed.name)
    if (user) await save.mutateAsync({ id: existing?.id, name: parsed.name, data: parsed, is_active: true })
    setUserTheme(parsed)
  }

  const activateUserTheme = async (row: { id: string; data: Record<string, unknown> }) => {
    const r = themeSchema.safeParse(row.data)
    if (!r.success) return
    await setActive.mutateAsync(row.id)
    setUserTheme(r.data)
  }

  const onImport = async (t: ThemeFile) => {
    if (user) await save.mutateAsync({ name: t.name, data: t, is_active: true })
    setUserTheme(t)
  }

  const exportCurrent = () => {
    const t: ThemeFile = userTheme ?? themeSchema.parse({ name: 'Warm Glass', mode: theme === 'dark' ? 'dark' : 'light' })
    download(t.name, JSON.stringify(t, null, 2))
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-semibold">外观</h1>
          <p className="mt-1 text-sm text-cv-fg-muted">主题是一份只含颜色、圆角、字体和玻璃参数的 JSON，可以导入导出，和角色皮肤互不干扰。</p>
        </div>
        <div className="flex gap-2">
          <Button variant="neu" size="sm" onClick={exportCurrent}><Download /> 导出当前</Button>
          <Button variant="accent" size="sm" onClick={() => setImportOpen(true)}><Upload /> 导入主题</Button>
        </div>
      </header>

      <section className="mb-8">
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-[0.14em] text-cv-fg-subtle">明暗模式</h2>
        <div className="neu-in inline-flex rounded-full p-1">
          {MODES.map((m) => {
            const Icon = m.icon
            const active = theme === m.id
            return (
              <button key={m.id} type="button" onClick={() => setTheme(m.id)} className={cn('flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-semibold transition-colors', active ? 'bg-cv-bg-elevated text-cv-fg shadow-neu-sm' : 'text-cv-fg-muted hover:text-cv-fg')}>
                <Icon className="size-4" />{m.label}
              </button>
            )
          })}
        </div>
      </section>

      <section className="mb-8">
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-[0.14em] text-cv-fg-subtle">内置主题</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {BUILTIN_THEMES.map((b) => {
            const t = themeSchema.parse(b.theme)
            const isActive = builtinActive ? Object.keys(t.tokens).length === 0 && (theme === t.mode || theme === 'system') : userTheme?.name === t.name
            const swatch = (k: string, fallback: string) => t.tokens[k as keyof typeof t.tokens] ?? fallback
            const dark = t.mode === 'dark'
            return (
              <button key={b.id} type="button" onClick={() => void applyBuiltin(b.id)} className={cn('glass flex items-center gap-4 rounded-cv-lg p-4 text-left transition-shadow hover:shadow-glass', isActive && 'ring-2 ring-cv-ring')}>
                <div className="flex shrink-0 -space-x-2">
                  {[swatch('bg', dark ? '#1c1410' : '#f2dece'), swatch('primary', dark ? '#9c4233' : '#41140e'), swatch('accent', dark ? '#e07a4c' : '#c9643b'), swatch('secondary', dark ? '#8ea0a9' : '#adbcc3')].map((c, i) => (
                    <span key={i} className="size-8 rounded-full border-2 border-cv-bg-elevated" style={{ background: c }} />
                  ))}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 font-semibold">{t.name}{isActive && <Check className="size-4 text-cv-success" />}</div>
                  <div className="truncate text-xs text-cv-fg-muted">{b.description}</div>
                </div>
              </button>
            )
          })}
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-[0.14em] text-cv-fg-subtle">我导入的主题</h2>
        {!user && <GlassPanel className="text-sm text-cv-fg-muted">登录后可以把主题保存到账号，多设备同步。</GlassPanel>}
        {user && themes.isLoading && <div className="flex items-center gap-2 text-sm text-cv-fg-muted"><Loader2 className="size-4 animate-spin" />加载中…</div>}
        {user && themes.data && themes.data.length === 0 && (
          <GlassPanel className="text-sm text-cv-fg-muted">还没有导入过主题。点右上角「导入主题」，或先「导出当前」拿到一份模板来改。</GlassPanel>
        )}
        <div className="grid gap-3 sm:grid-cols-2">
          {themes.data?.map((row) => {
            const r = themeSchema.safeParse(row.data)
            const isActive = row.id === activeId
            return (
              <div key={row.id} className={cn('glass flex items-center gap-3 rounded-cv-lg p-4', isActive && 'ring-2 ring-cv-ring')}>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 font-semibold">{row.name}{isActive && <Chip tone="success">使用中</Chip>}{!r.success && <Chip tone="danger">格式无效</Chip>}</div>
                  <div className="text-xs text-cv-fg-muted">{r.success ? `${r.data.mode === 'dark' ? '深色' : '浅色'} · ${Object.keys(r.data.tokens).length} 个颜色覆盖` : r.error.issues[0]?.message}</div>
                </div>
                {!isActive && r.success && <Button size="sm" variant="neu" onClick={() => void activateUserTheme(row)}>使用</Button>}
                <IconButton label="导出" variant="ghost" size="sm" onClick={() => download(row.name, JSON.stringify(row.data, null, 2))}><Download /></IconButton>
                <IconButton label="删除" variant="ghost" size="sm" onClick={async () => { if (confirm(`删除主题「${row.name}」？`)) { await del.mutateAsync(row.id); if (isActive) setUserTheme(null) } }}><Trash2 /></IconButton>
              </div>
            )
          })}
        </div>
      </section>

      <ThemeImportDialog open={importOpen} onOpenChange={setImportOpen} onImport={onImport} />
    </div>
  )
}
