'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { useRouter } from 'next/navigation'
import type { Session, User } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase/client'

export interface AuthContextValue {
  user: User | null
  session: Session | null
  /** True until the initial session has been read from cookies. */
  loading: boolean
  signIn: (email: string, password: string) => Promise<User | null>
  /** `needsConfirmation` = email verification required before the account can sign in */
  signUp: (email: string, password: string, username: string) => Promise<{ user: User | null; needsConfirmation: boolean }>
  /** re-send the sign-up confirmation email */
  resendConfirmation: (email: string) => Promise<void>
  /** send the password-reset email (lands on /auth/reset via /auth/callback) */
  requestPasswordReset: (email: string) => Promise<void>
  /** set a new password for the signed-in (recovery) session */
  updatePassword: (password: string) => Promise<void>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const router = useRouter()
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false

    supabase.auth.getSession().then(({ data }) => {
      if (cancelled) return
      setSession(data.session)
      setLoading(false)
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, nextSession) => {
      setSession(nextSession)
      setLoading(false)
      if (event === 'SIGNED_IN' && nextSession?.user) {
        const u = nextSession.user
        const username = (u.user_metadata?.username as string | undefined)?.trim() || u.email?.split('@')[0] || '用户'
        // no-op when the trigger already created it
        void supabase.from('profiles').upsert({ id: u.id, username }, { onConflict: 'id', ignoreDuplicates: true })
      }
    })

    return () => {
      cancelled = true
      subscription.unsubscribe()
    }
  }, [])

  const signIn = useCallback(async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw error
    setSession(data.session)
    return data.user
  }, [])

  const signUp = useCallback(async (email: string, password: string, username: string) => {
    const trimmedUsername = username?.trim()
    if (!trimmedUsername) throw new Error('用户名不能为空')
    const origin = typeof window !== 'undefined' ? window.location.origin : ''
    // The profile row is created by the DB trigger handle_new_user() from this metadata;
    // we must not insert it here (no session yet when email confirmation is on).
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { username: trimmedUsername }, emailRedirectTo: `${origin}/auth/callback?next=/chat` },
    })
    if (error) throw error
    if (data.session) setSession(data.session)
    return { user: data.user, needsConfirmation: !data.session }
  }, [])

  const resendConfirmation = useCallback(async (email: string) => {
    const origin = typeof window !== 'undefined' ? window.location.origin : ''
    const { error } = await supabase.auth.resend({ type: 'signup', email, options: { emailRedirectTo: `${origin}/auth/callback?next=/chat` } })
    if (error) throw error
  }, [])

  const requestPasswordReset = useCallback(async (email: string) => {
    const origin = typeof window !== 'undefined' ? window.location.origin : ''
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${origin}/auth/callback?next=/auth/reset` })
    if (error) throw error
  }, [])

  const updatePassword = useCallback(async (password: string) => {
    const { error } = await supabase.auth.updateUser({ password })
    if (error) throw error
  }, [])

  const signOut = useCallback(async () => {
    const { error } = await supabase.auth.signOut()
    if (error) throw error
    setSession(null)
    router.push('/login')
    router.refresh()
  }, [router])

  const value = useMemo<AuthContextValue>(
    () => ({
      user: session?.user ?? null,
      session,
      loading,
      signIn,
      signUp,
      resendConfirmation,
      requestPasswordReset,
      updatePassword,
      signOut,
    }),
    [session, loading, signIn, signUp, resendConfirmation, requestPasswordReset, updatePassword, signOut]
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) {
    throw new Error('useAuth must be used within <AuthProvider>')
  }
  return ctx
}
