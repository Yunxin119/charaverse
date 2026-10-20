'use client'

import { Moon, Sun, MonitorSmartphone } from 'lucide-react'
import { useTheme, type ThemeMode } from '@/app/contexts/ThemeContext'
import { IconButton } from '@/components/glass'

const next: Record<ThemeMode, ThemeMode> = { light: 'dark', dark: 'system', system: 'light' }
const labels: Record<ThemeMode, string> = { light: '浅色', dark: '深色', system: '跟随系统' }

export function ThemeToggle({ className }: { className?: string }) {
  const { theme, setTheme } = useTheme()
  const Icon = theme === 'light' ? Sun : theme === 'dark' ? Moon : MonitorSmartphone
  return (
    <IconButton
      variant="ghost"
      size="md"
      label={`主题：${labels[theme]}（点击切换）`}
      onClick={() => setTheme(next[theme])}
      className={className}
    >
      <Icon />
    </IconButton>
  )
}
