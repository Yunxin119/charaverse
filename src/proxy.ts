import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

const PUBLIC_PATHS = new Set(['/login'])

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          response = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // Always use getUser() (validates the JWT with Supabase and refreshes the
  // cookie); never trust getSession() here.
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { pathname } = request.nextUrl

  const redirectTo = (path: string, search?: Record<string, string>) => {
    const url = request.nextUrl.clone()
    url.pathname = path
    url.search = ''
    if (search) {
      for (const [k, v] of Object.entries(search)) url.searchParams.set(k, v)
    }
    const redirect = NextResponse.redirect(url)
    // Carry over any refreshed auth cookies.
    response.cookies.getAll().forEach((c) => redirect.cookies.set(c))
    return redirect
  }

  if (pathname === '/') {
    return redirectTo(user ? '/chat' : '/login')
  }

  if (PUBLIC_PATHS.has(pathname)) {
    return user ? redirectTo('/chat') : response
  }

  if (!user) {
    const next = pathname + request.nextUrl.search
    return redirectTo('/login', { next })
  }

  return response
}

export const config = {
  matcher: [
    /*
     * Run on every path except:
     * - /api/* (API routes do their own Bearer auth via src/lib/server/auth.ts)
     * - /_next/* (static assets, image optimizer, RSC payload internals)
     * - favicon.ico, manifest.json, /icons/*
     * - any file with an extension (static files in /public)
     */
    '/((?!api|_next|favicon\\.ico|manifest\\.json|icons/|.*\\..*).*)',
  ],
}
