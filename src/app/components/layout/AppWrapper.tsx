'use client'

import { usePathname } from 'next/navigation'
import { useAppSelector } from '../../store/hooks'
import { Sidebar } from './Sidebar'
import { Navbar } from './Navbar'

export function AppWrapper({ children }: { children: React.ReactNode }) {
  const { user } = useAppSelector((state) => state.auth)
  const pathname = usePathname()
  
  // 不显示侧边栏和导航栏的页面
  const noLayoutPages = ['/login', '/register']
  const shouldShowLayout = user && !noLayoutPages.includes(pathname)

  if (!shouldShowLayout) {
    return <>{children}</>
  }

  return (
    <div className="min-h-screen bg-slate-50 flex">
      {/* Sidebar */}
      <Sidebar />
      
      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
        <Navbar />
        <main className="flex-1 p-6">
          {children}
        </main>
      </div>
    </div>
  )
} 