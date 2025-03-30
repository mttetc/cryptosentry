import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

interface User {
  id: string;
  email?: string;
  phone?: string;
}

export function useUser() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = createClient();

    // Get initial user
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUser(
        user
          ? {
              id: user.id,
              email: user.email || undefined,
              phone: user.phone || undefined,
            }
          : null
      );
      setLoading(false);
    });

    // Listen for changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      setUser(
        session?.user
          ? {
              id: session.user.id,
              email: session.user.email || undefined,
              phone: session.user.phone || undefined,
            }
          : null
      );
      setLoading(false);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  return { user, loading };
}
