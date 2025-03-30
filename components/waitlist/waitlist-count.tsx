import { Users } from 'lucide-react';
import { getWaitlistCount } from '@/actions/waitlist';

export async function WaitlistCount() {
  const count = await getWaitlistCount();

  return (
    <div className="flex items-center gap-2 text-sm text-muted-foreground">
      <Users className="h-4 w-4" />
      <span>{count || 20}+ waiting for access</span>
    </div>
  );
}
