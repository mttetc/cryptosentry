import { createBrowserClient, createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export async function createServerSupabaseClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        async getAll(options?: { name?: string }) {
          const cookieList = cookieStore.getAll();
          if (options?.name) {
            return cookieList.filter((cookie) => cookie.name === options.name);
          }
          return cookieList;
        },
        async setAll(cookieList) {
          for (const cookie of cookieList) {
            cookieStore.set(cookie);
          }
        },
      },
    }
  );
}

export function createBrowserSupabaseClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
