import { Users, Globe, MessageSquare, UserRound, type LucideIcon } from 'lucide-react'

export interface NavItem {
  name: string
  href: string
  icon: LucideIcon
  /** pathname prefixes that count as active (besides exact match) */
  match?: string[]
}

export const NAV_ITEMS: NavItem[] = [
  { name: '聊天', href: '/chat', icon: MessageSquare, match: ['/chat'] },
  { name: '角色', href: '/characters', icon: Users, match: ['/characters', '/character'] },
  { name: '探索', href: '/explore', icon: Globe, match: ['/explore', '/user'] },
  { name: '我的', href: '/settings', icon: UserRound, match: ['/settings'] },
]

export function isNavActive(item: NavItem, pathname: string): boolean {
  if (pathname === item.href) return true
  return (item.match ?? []).some((p) => pathname === p || pathname.startsWith(p + '/'))
}

/** Routes that take the whole viewport (no bottom tabs on mobile, no page padding). */
export function isImmersiveRoute(pathname: string): boolean {
  return /^\/chat\/[^/]+\/?$/.test(pathname) || pathname.startsWith('/character/public/')
}
