'use client';

import { useFormState, useFormStatus } from 'react-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/components/ui/use-toast';
import { joinWaitlist } from '@/actions/waitlist';
import { getUserCountry } from '@/lib/geolocation';
import { useEffect } from 'react';

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? 'Joining...' : 'Join Waitlist'}
    </Button>
  );
}

const initialState = {
  error: undefined,
  success: false,
};

export function WaitlistForm() {
  const { toast } = useToast();
  const [state, formAction] = useFormState(joinWaitlist, initialState);

  useEffect(() => {
    if (state.success) {
      toast({
        title: 'Success!',
        description: "You've been added to our waitlist. We'll notify you when we launch!",
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
    <form
      action={async (formData) => {
        formData.set('country', await getUserCountry());
        formAction(formData);
      }}
      className="mx-auto w-full max-w-md space-y-4"
    >
      <div className="space-y-2">
        <Input
          type="email"
          name="email"
          placeholder="Enter your email"
          required
          className="w-full"
        />
        <p className="text-sm text-muted-foreground">
          We'll use your location to provide better service.
        </p>
      </div>
      <SubmitButton />
    </form>
  );
}
