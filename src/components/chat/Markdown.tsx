'use client'

import { memo } from 'react'
import ReactMarkdown, { type Components } from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { cn } from '@/lib/utils'

/** Hosts an <img> in a message may load from (zero-click exfiltration guard, plan A11). */
function allowedImageHosts(): string[] {
  const hosts: string[] = []
  try {
    const sb = process.env.NEXT_PUBLIC_SUPABASE_URL
    if (sb) hosts.push(new URL(sb).host)
    if (typeof window !== 'undefined') hosts.push(window.location.host)
  } catch {}
  return hosts
}

function isAllowedImage(src?: string): boolean {
  if (!src) return false
  if (src.startsWith('/') || src.startsWith('data:image/')) return true
  try {
    return allowedImageHosts().includes(new URL(src).host)
  } catch {
    return false
  }
}

const components: Components = {
  p: ({ children }) => <p className="my-2 first:mt-0 last:mb-0 leading-[1.7]">{children}</p>,
  strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
  em: ({ children }) => <em className="italic opacity-90">{children}</em>,
  a: ({ href, children }) => (
    <a href={href} target="_blank" rel="noopener noreferrer nofollow" className="text-cv-accent underline underline-offset-2">
      {children}
    </a>
  ),
  blockquote: ({ children }) => (
    <blockquote className="my-2 border-l-2 border-cv-accent/60 pl-3 text-cv-fg-muted italic">{children}</blockquote>
  ),
  ul: ({ children }) => <ul className="my-2 list-disc pl-5">{children}</ul>,
  ol: ({ children }) => <ol className="my-2 list-decimal pl-5">{children}</ol>,
  li: ({ children }) => <li className="my-0.5">{children}</li>,
  hr: () => <hr className="my-3 border-cv-border" />,
  code: ({ className, children }) => {
    const block = /language-/.test(className ?? '')
    return block ? (
      <code className={cn('font-mono text-[13px]', className)}>{children}</code>
    ) : (
      <code className="rounded-md bg-cv-fg/10 px-1.5 py-0.5 font-mono text-[0.85em]">{children}</code>
    )
  },
  pre: ({ children }) => (
    <pre className="my-2 overflow-x-auto rounded-cv-md bg-[var(--cv-ink-900)] p-3 text-[var(--cv-cream-200)]">{children}</pre>
  ),
  img: ({ src, alt }) => {
    const s = typeof src === 'string' ? src : undefined
    if (!isAllowedImage(s)) {
      return <span className="rounded-md bg-cv-fg/10 px-1.5 py-0.5 text-xs text-cv-fg-muted">[图片：{alt || '外部图片已拦截'}]</span>
    }
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={s} alt={alt ?? ''} loading="lazy" className="my-2 max-h-80 rounded-cv-md" />
  },
  table: ({ children }) => (
    <div className="my-2 overflow-x-auto"><table className="w-full text-sm [&_td]:border [&_td]:border-cv-border [&_td]:px-2 [&_td]:py-1 [&_th]:border [&_th]:border-cv-border [&_th]:px-2 [&_th]:py-1">{children}</table></div>
  ),
}

export const Markdown = memo(function Markdown({ text, className }: { text: string; className?: string }) {
  return (
    <div className={cn('cv-markdown text-[15px]', className)}>
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components} skipHtml>
        {text}
      </ReactMarkdown>
    </div>
  )
})
