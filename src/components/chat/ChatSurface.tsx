'use client'

import type { ReactNode } from 'react'
import { SkinStyle } from './SkinStyle'
import { cn } from '@/lib/utils'
import type { SessionSettings } from '@/lib/chat/settings'

export type ChatLayout = SessionSettings['layout']

export interface Backdrop {
  url?: string
  source: 'custom' | 'avatar' | null
  opacity: number
  blur: number
}

/**
 * The backdrop a session shows: its own image, else the character's avatar
 * (dimmed + blurred in flow mode, full-bleed in novel mode), else nothing.
 */
export function backdropFor(background: SessionSettings['background'], layout: ChatLayout, avatarUrl: string | null | undefined): Backdrop {
  const novel = layout === 'novel'
  if (background.url) return { url: background.url, source: 'custom', opacity: background.opacity, blur: background.blur }
  if (background.useAvatar && avatarUrl) return { url: avatarUrl, source: 'avatar', opacity: novel ? 1 : 0.5, blur: novel ? 0 : 16 }
  return { source: null, opacity: 1, blur: 0 }
}

interface Props {
  /** composed skin css (knobs first, then advanced); sanitized + scoped by SkinStyle */
  skinCss: string
  allowedUrlHosts?: string[]
  layout: ChatLayout
  backdrop: Backdrop
  header: ReactNode
  /** between header and body (e.g. the author-update banner) */
  banner?: ReactNode
  /** flow layout: message list, optional notice, composer */
  messageList: ReactNode
  notice?: ReactNode
  composer: ReactNode
  /** novel layout: the dialogue stage (replaces list + composer) */
  stage?: ReactNode
  /** right column (comments) */
  aside?: ReactNode
  /** sheets / dialogs rendered inside the root */
  children?: ReactNode
  /** sizing of the root: the live chat uses the viewport, the skin preview fills its box */
  className?: string
}

/**
 * The DOM of the chat page: `#cv_chat_root` > backdrop layers + `#cv_chat_row` > `#cv_chat_column[data-layout]`.
 * Every id / data attribute here is a stable hook for author skins, so the live chat (ChatView)
 * and the skin editor's preview render through this one component and can never drift apart.
 */
export function ChatSurface({ skinCss, allowedUrlHosts, layout, backdrop, header, banner, messageList, notice, composer, stage, aside, children, className }: Props) {
  const novel = layout === 'novel'
  return (
    <div id="cv_chat_root" className={cn('relative flex flex-col overflow-hidden', className ?? 'h-dvh')}>
      <SkinStyle css={skinCss} allowedUrlHosts={allowedUrlHosts} />
      {backdrop.url && (
        <>
          <div
            id="cv_background_image"
            aria-hidden
            data-source={backdrop.source ?? undefined}
            className="pointer-events-none absolute inset-0 -z-20 bg-cover"
            style={{
              backgroundImage: `url(${backdrop.url})`,
              backgroundPosition: novel ? 'center 18%' : 'center',
              opacity: backdrop.opacity,
              filter: backdrop.blur ? `blur(${backdrop.blur}px)` : undefined,
              transform: backdrop.blur ? 'scale(1.06)' : undefined,
            }}
          />
          <div id="cv_background_overlay" aria-hidden className={cn('pointer-events-none absolute inset-0 -z-10 bg-gradient-to-b', novel ? 'from-cv-bg/35 via-transparent to-transparent' : 'from-cv-bg/40 via-transparent to-cv-bg/60')} />
        </>
      )}

      {/* row: chat column + optional comments aside. #cv_chat_root keeps `flex flex-col` for skins. */}
      <div id="cv_chat_row" className="flex min-h-0 flex-1">
        <div id="cv_chat_column" data-layout={layout} className="relative flex min-w-0 flex-1 flex-col">
          {header}
          {banner}
          {novel && stage ? stage : (
            <>
              {messageList}
              {notice}
              {composer}
            </>
          )}
        </div>
        {aside}
      </div>

      {children}
    </div>
  )
}
