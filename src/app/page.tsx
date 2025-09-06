'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAppSelector } from './store/hooks'

export default function RootPage() {
  const { user, loading } = useAppSelector((state) => state.auth)
  const router = useRouter()

  useEffect(() => {
    if (!loading) {
      if (!user) {
        // 如果用户未登录，重定向到登录页
        router.push('/login')
      } else {
        // 如果用户已登录，重定向到聊天页面
        router.push('/chat')
      }
    }
  }, [user, loading, router])

  // 显示加载状态
  if (loading) {
    return (
      <div className="h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="w-8 h-8 mx-auto animate-spin rounded-full border-2 border-slate-900 border-t-transparent" />
          <p className="text-slate-600">正在加载...</p>
        </div>
      </div>
    )
  }

  return null // 用户会被重定向，这里不应该渲染任何内容
}
