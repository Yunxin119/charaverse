'use client'

import Link from 'next/link'

// Root-level error boundary. It replaces the root layout, so it renders its own
// <html>/<body> and inlines minimal styles: globals.css / tokens.css may not be
// loaded here. The literal hex values below are the token palette (cream / ink /
// oxblood / sienna) and are the one allowed exception to the tokens-only rule.
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="zh-CN">
      <body
        style={{
          margin: 0,
          minHeight: '100dvh',
          display: 'grid',
          placeItems: 'center',
          padding: '24px 16px',
          boxSizing: 'border-box',
          background: '#f2dece',
          color: '#33251b',
          fontFamily: '-apple-system, "SF Pro", "PingFang SC", "Noto Sans SC", "Segoe UI", sans-serif',
        }}
      >
        <main
          style={{
            position: 'relative',
            overflow: 'hidden',
            width: '100%',
            maxWidth: 560,
            boxSizing: 'border-box',
            padding: 32,
            borderRadius: 24,
            background: '#41140e',
            color: '#f2dece',
            boxShadow: '0 20px 50px -20px rgba(51, 37, 27, 0.35)',
          }}
        >
          <span
            aria-hidden
            style={{ position: 'absolute', right: -40, bottom: -64, width: 208, height: 208, borderRadius: '50%', background: '#c9643b', opacity: 0.85 }}
          />
          <span
            aria-hidden
            style={{ position: 'absolute', right: 56, top: -48, width: 112, height: 112, borderRadius: '50%', background: '#adbcc3', opacity: 0.9 }}
          />
          <div style={{ position: 'relative' }}>
            <p style={{ margin: 0, fontFamily: '"SF Mono", ui-monospace, Menlo, monospace', fontSize: 11, letterSpacing: '0.2em', textTransform: 'uppercase', opacity: 0.7 }}>
              CharaVerse
            </p>
            <h1 style={{ margin: '40px 0 0', fontFamily: 'Fraunces, "Playfair Display", Georgia, serif', fontSize: 34, lineHeight: 1.1, fontWeight: 600, letterSpacing: '-0.01em' }}>
              出了点问题
            </h1>
            <p style={{ margin: '12px 0 0', maxWidth: 360, fontSize: 15, lineHeight: 1.6, opacity: 0.8 }}>
              应用外壳没能正常加载。刷新一次通常就好；如果反复出现，请把下面的编号告诉我们。
            </p>
            {error.digest && (
              <p style={{ margin: '16px 0 0', fontFamily: '"SF Mono", ui-monospace, Menlo, monospace', fontSize: 11, letterSpacing: '0.08em', opacity: 0.5 }}>
                digest · {error.digest}
              </p>
            )}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginTop: 32 }}>
              <button
                type="button"
                onClick={() => reset()}
                style={{
                  height: 40,
                  padding: '0 20px',
                  borderRadius: 999,
                  border: 0,
                  background: '#c9643b',
                  color: '#ffffff',
                  fontSize: 14,
                  fontWeight: 600,
                  cursor: 'pointer',
                  boxShadow: '0 10px 24px -10px #c9643b',
                }}
              >
                重试
              </button>
              <Link
                href="/chat"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  height: 40,
                  padding: '0 20px',
                  borderRadius: 999,
                  border: '1px solid rgba(242, 222, 206, 0.25)',
                  color: '#f2dece',
                  fontSize: 14,
                  fontWeight: 600,
                  textDecoration: 'none',
                }}
              >
                回到对话
              </Link>
            </div>
          </div>
        </main>
      </body>
    </html>
  )
}
