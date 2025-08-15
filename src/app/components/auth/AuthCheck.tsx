'use client'

import { useEffect } from 'react'
import { useAppDispatch, useAppSelector } from '../../store/hooks'
import { checkAuth } from '../../store/authSlice'
import { Loader2, Sparkles } from 'lucide-react'

export function AuthCheck({ children }: { children: React.ReactNode }) {
  const dispatch = useAppDispatch()
  const { user, loading } = useAppSelector((state) => state.auth)

  useEffect(() => {
    dispatch(checkAuth())
  }, [dispatch])

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-slate-900 to-slate-700 mb-4 shadow-lg animate-pulse">
            <Sparkles className="w-8 h-8 text-white" />
          </div>
          <div className="flex items-center justify-center space-x-2">
            <Loader2 className="w-5 h-5 animate-spin text-slate-600" />
            <span className="text-slate-600">正在加载 CharaVerse...</span>
          </div>
        </div>
      </div>
    )
  }

  return <>{children}</>
} 