import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { rateLimit } from '@/lib/rate-limit'

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll(name?: string) {
          if (name) {
            const cookie = request.cookies.get(name);
            return cookie ? [{ name, value: cookie.value }] : [];
          }
          return Array.from(request.cookies.getAll()).map(cookie => ({
            name: cookie.name,
            value: cookie.value,
          }));
        },
        setAll(cookies) {
          cookies.forEach((cookie) => {
            response.cookies.set({
              name: cookie.name,
              value: cookie.value,
              ...cookie.options,
            });
          });
        },
      },
    }
  )

  const { data: { session } } = await supabase.auth.getSession()

  // Handle dashboard button clicks for unauthenticated users
  if (!session && request.nextUrl.pathname === '/dashboard') {
    return NextResponse.redirect(new URL('/auth', request.url))
  }

  // If user is signed in and on the landing page, redirect to dashboard
  if (session && request.nextUrl.pathname === '/') {
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  // If user is not signed in and the current path is not /, /auth, or public paths,
  // redirect the user to /auth
  if (!session && 
      !request.nextUrl.pathname.startsWith('/auth') && 
      request.nextUrl.pathname !== '/' &&
      !request.nextUrl.pathname.startsWith('/api/webhooks')
  ) {
    return NextResponse.redirect(new URL('/auth', request.url))
  }

  // If user is signed in and the current path is /auth,
  // redirect the user to /dashboard
  if (session && request.nextUrl.pathname.startsWith('/auth')) {
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  // Apply rate limiting to all routes
  const forwarded = request.headers.get('x-forwarded-for');
  const ip = forwarded ? forwarded.split(',')[0] : request.headers.get('x-real-ip') || 'anonymous';
  const userAgent = request.headers.get('user-agent') || 'unknown';
  const country = request.headers.get('cf-ipcountry') || undefined;

  const { success, remaining, resetAt } = await rateLimit(
    ip,
    request.nextUrl.pathname,
    userAgent,
    country
  );

  // Add rate limit headers to all responses
  response.headers.set('X-RateLimit-Remaining', remaining.toString());
  response.headers.set('X-RateLimit-Reset', resetAt.toString());

  if (!success) {
    // Return a more informative rate limit response
    return new NextResponse(
      JSON.stringify({
        error: 'Too Many Requests',
        message: `Rate limit exceeded. Please try again in ${Math.ceil((resetAt - Date.now()) / 1000)} seconds.`,
        retryAfter: Math.ceil((resetAt - Date.now()) / 1000),
      }),
      {
        status: 429,
        headers: {
          'Content-Type': 'application/json',
          'Retry-After': Math.ceil((resetAt - Date.now()) / 1000).toString(),
          'X-RateLimit-Remaining': remaining.toString(),
          'X-RateLimit-Reset': resetAt.toString(),
        },
      }
    );
  }

  return response;
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
} 