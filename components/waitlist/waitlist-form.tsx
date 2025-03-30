'use client';

import { useFormStatus } from 'react-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/components/ui/use-toast';
import { joinWaitlist } from '@/actions/waitlist';
import { useActionState, useEffect } from 'react';

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} className="w-full">
      {pending ? 'Joining...' : 'Get Early Access'}
    </Button>
  );
}

const initialState = {
  error: undefined,
  success: false,
};

export function WaitlistForm() {
  const { toast } = useToast();
  const [state, formAction] = useActionState(joinWaitlist, initialState);

  useEffect(() => {
    if (state.success) {
      toast({
        title: 'Welcome aboard! 🚀',
        description: "You're on the list! We'll notify you when we launch.",
      });
    } else if (state.error) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: state.error,
      });
    }
  }, [state, toast]);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <Input
        type="email"
        name="email"
        placeholder="Enter your email for early access"
        required
        className="h-12"
      />
      <SubmitButton />
    </form>
  );
}
