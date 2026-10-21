import { NextResponse, type NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'

/**
 * Email confirmation / magic-link landing. Supabase redirects here with `?code=` (PKCE) or
 * `?token_hash=&type=`; we turn it into a cookie session and send the user on.
 */
export async function GET(request: NextRequest) {
  const url = request.nextUrl
  const code = url.searchParams.get('code')
  const tokenHash = url.searchParams.get('token_hash')
  const type = url.searchParams.get('type')
  const rawNext = url.searchParams.get('next') ?? '/chat'
  const next = rawNext.startsWith('/') && !rawNext.startsWith('//') ? rawNext : '/chat'

  const redirect = NextResponse.redirect(new URL(next, url.origin))
  const supabase = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (cookies) => cookies.forEach(({ name, value, options }) => redirect.cookies.set(name, value, options)),
    },
  })

  let errorMessage: string | null = null
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (error) errorMessage = error.message
  } else if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type: type as 'signup' | 'email' | 'recovery' | 'magiclink' | 'invite' | 'email_change' })
    if (error) errorMessage = error.message
  } else {
    errorMessage = url.searchParams.get('error_description') || '链接缺少验证参数'
  }

  if (errorMessage) {
    const fail = new URL('/login', url.origin)
    fail.searchParams.set('verify', 'failed')
    fail.searchParams.set('reason', errorMessage.slice(0, 120))
    return NextResponse.redirect(fail)
  }
  redirect.headers.set('Cache-Control', 'no-store')
  return redirect
}
