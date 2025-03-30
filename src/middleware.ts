import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { updateSession } from '@/lib/supabase/middleware';
import { FEATURES } from './lib/config/features';

export async function middleware(request: NextRequest) {
  // First, update the session
  const res = await updateSession(request);

  // If in waitlist mode, block access to auth and dashboard routes
  if (FEATURES.isWaitlistMode) {
    const isProtectedRoute =
      request.nextUrl.pathname.startsWith('/auth') ||
      request.nextUrl.pathname.startsWith('/dashboard');

    if (isProtectedRoute) {
      const redirectUrl = new URL('/', request.url);
      return NextResponse.redirect(redirectUrl);
    }
  }

  // Create a Supabase client
  const supabase = await createServerSupabaseClient();

  const {
    data: { session },
  } = await supabase.auth.getSession();

  // Handle other middleware logic for non-waitlist mode
  if (!session) {
    if (request.nextUrl.pathname.startsWith('/dashboard')) {
      const redirectUrl = new URL('/auth', request.url);
      return NextResponse.redirect(redirectUrl);
    }
  }

  if (session && request.nextUrl.pathname.startsWith('/auth')) {
    const redirectUrl = new URL('/dashboard', request.url);
    return NextResponse.redirect(redirectUrl);
  }

  return res;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * Feel free to modify this pattern to include more paths.
     */
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};
