'use client'

import { useEffect } from 'react'

interface CharacterStyleInjectorProps {
  customCss?: string | null
  scopeId?: string // 用于生成唯一的style tag ID，默认为 'character-custom-style'
}

/**
 * 清理用户提供的 CSS，剔除潜在危险内容：
 * - 移除 <script> 标签（虽然在 style 里本来就不该有）
 * - 移除 CSS 中的 @import、expression、javascript: 等危险指令
 * - 自动解包 <style>...</style> 包裹
 */
function sanitizeCss(raw: string): string {
  if (!raw) return ''

  let css = raw.trim()

  // 解包 <style>...</style>
  const styleMatch = css.match(/<style[^>]*>([\s\S]*?)<\/style>/i)
  if (styleMatch) {
    css = styleMatch[1]
  }

  // 移除所有 script 标签
  css = css.replace(/<script[\s\S]*?<\/script>/gi, '')
  // 移除所有其他 HTML 标签（防止 XSS via style context break）
  css = css.replace(/<\/?[a-z][^>]*>/gi, '')
  // 移除 @import（防止加载外部恶意样式）
  css = css.replace(/@import\s+[^;]+;?/gi, '')
  // 移除 IE expression
  css = css.replace(/expression\s*\([^)]*\)/gi, '')
  // 移除 javascript: 协议
  css = css.replace(/javascript\s*:/gi, '')
  // 移除 behavior (IE)
  css = css.replace(/behavior\s*:[^;]*;?/gi, '')

  return css.trim()
}

/**
 * 将角色卡中的自定义 CSS 注入到页面中，仅在聊天页面作用域下有效。
 * 利用 #cv_chat_root 作为 scope 前缀，避免污染其他页面样式。
 *
 * 注意：角色作者可以通过在 CSS 中显式写全局选择器来突破 scope，
 * 但这是角色作者主动决定的，我们只做基本清洗。
 */
export function CharacterStyleInjector({ customCss, scopeId = 'character-custom-style' }: CharacterStyleInjectorProps) {
  useEffect(() => {
    if (!customCss || !customCss.trim()) {
      // 如果没有自定义 CSS，清理可能残留的 style tag
      const existing = document.getElementById(scopeId)
      if (existing) existing.remove()
      return
    }

    const sanitized = sanitizeCss(customCss)
    if (!sanitized) return

    let styleEl = document.getElementById(scopeId) as HTMLStyleElement | null
    if (!styleEl) {
      styleEl = document.createElement('style')
      styleEl.id = scopeId
      styleEl.setAttribute('data-character-style', 'true')
      document.head.appendChild(styleEl)
    }
    styleEl.textContent = sanitized

    return () => {
      const el = document.getElementById(scopeId)
      if (el) el.remove()
    }
  }, [customCss, scopeId])

  return null
}

export default CharacterStyleInjector
