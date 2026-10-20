'use client'

import { memo, useEffect, useId, useRef, useState } from 'react'

/**
 * Renders author/model HTML (status bars, phone UIs, scripted cards) in a sandboxed iframe.
 *  - sandbox="allow-scripts" only: a separate opaque origin, no cookies/localStorage/parent DOM
 *  - CSP meta: no network except images/fonts over https, no forms, no navigation
 *  - height is reported back via postMessage so the frame fits its content
 * The surrounding theme is passed in as CSS variables so cards can match the chat.
 */
const CSP = [
  "default-src 'none'",
  "style-src 'unsafe-inline' https://fonts.googleapis.com",
  "font-src https: data:",
  "img-src https: data: blob:",
  "media-src https: data:",
  "script-src 'unsafe-inline'",
  "connect-src 'none'",
  "form-action 'none'",
  "base-uri 'none'",
].join('; ')

const RESIZE_SCRIPT = `
(function(){
  var last=-1;
  function send(){
    var h=Math.ceil(Math.max(document.documentElement.scrollHeight, document.body ? document.body.scrollHeight : 0));
    if(h!==last){ last=h; parent.postMessage({type:'cv-frame-height',height:h},'*'); }
  }
  new ResizeObserver(send).observe(document.documentElement);
  window.addEventListener('load',send);
  setTimeout(send,50); setTimeout(send,400); setTimeout(send,1500);
  document.addEventListener('click',function(e){var a=e.target&&e.target.closest&&e.target.closest('a[href]'); if(a){e.preventDefault();}}, true);
})();`

function buildDoc(html: string, vars: string): string {
  return `<!doctype html><html><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="${CSP}"><meta name="viewport" content="width=device-width, initial-scale=1"><style>
:root{${vars}}
html,body{margin:0;padding:0;background:transparent;color:var(--cv-fg);font-family:var(--cv-font-sans);font-size:15px;line-height:1.6;-webkit-font-smoothing:antialiased;}
body{overflow:hidden;}
img{max-width:100%;}
</style></head><body>${html}<script>${RESIZE_SCRIPT}</script></body></html>`
}

const PASS_VARS = ['--cv-bg', '--cv-bg-elevated', '--cv-fg', '--cv-fg-muted', '--cv-fg-subtle', '--cv-primary', '--cv-primary-fg', '--cv-secondary', '--cv-accent', '--cv-border', '--cv-glass-bg', '--cv-glass-border', '--cv-radius-md', '--cv-radius-lg']

function themeVars(): string {
  if (typeof window === 'undefined') return ''
  const cs = getComputedStyle(document.documentElement)
  const body = getComputedStyle(document.body)
  const parts = PASS_VARS.map((v) => `${v}:${cs.getPropertyValue(v).trim() || 'inherit'};`)
  parts.push(`--cv-font-sans:${body.fontFamily};`)
  return parts.join('')
}

export const HtmlBlockFrame = memo(function HtmlBlockFrame({ html, className }: { html: string; className?: string }) {
  const ref = useRef<HTMLIFrameElement>(null)
  const [height, setHeight] = useState(24)
  const [doc, setDoc] = useState<string | null>(null)
  const id = useId()

  useEffect(() => { setDoc(buildDoc(html, themeVars())) }, [html])

  useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      if (e.source !== ref.current?.contentWindow) return
      const d = e.data as { type?: string; height?: number }
      if (d?.type === 'cv-frame-height' && typeof d.height === 'number') {
        setHeight(Math.min(Math.max(d.height, 16), 4000))
      }
    }
    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
  }, [])

  if (doc === null) return <div className={className} style={{ height }} />
  return (
    <iframe
      ref={ref}
      title={`html-block-${id}`}
      sandbox="allow-scripts"
      referrerPolicy="no-referrer"
      srcDoc={doc}
      loading="lazy"
      className={className ?? 'my-1 block w-full border-0 bg-transparent'}
      style={{ height, colorScheme: 'normal' }}
    />
  )
})
