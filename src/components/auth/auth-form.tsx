'use client';

import { signIn, signUp } from '@/actions/auth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { useActionState, useState } from 'react';
import { useFormStatus } from 'react-dom';

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? 'Loading...' : 'Submit'}
    </Button>
  );
}

export function AuthForm() {
  const [isSignUp, setIsSignUp] = useState(false);
  const [signInState, signInAction] = useActionState(signIn, { error: undefined, success: false });
  const [signUpState, signUpAction] = useActionState(signUp, { error: undefined, success: false });
  const { toast } = useToast();

  // Show error or success messages
  if (signInState.error || signUpState.error) {
    toast({
      variant: 'destructive',
      title: 'Error',
      description: signInState.error || signUpState.error,
    });
  }

  if (signInState.success || signUpState.success) {
    toast({
      title: 'Success',
      description: isSignUp ? 'Account created successfully' : 'Signed in successfully',
    });
  }

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle>{isSignUp ? 'Create Account' : 'Sign In'}</CardTitle>
        <CardDescription>
          {isSignUp ? 'Create a new account to get started' : 'Sign in to your account to continue'}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form action={isSignUp ? signUpAction : signInAction} className="space-y-4">
          <div className="space-y-2">
            <label htmlFor="email">Email</label>
            <Input id="email" name="email" type="email" required placeholder="Enter your email" />
          </div>
          <div className="space-y-2">
            <label htmlFor="password">Password</label>
            <Input
              id="password"
              name="password"
              type="password"
              required
              placeholder="Enter your password"
            />
          </div>
          <SubmitButton />
          <Button
            type="button"
            variant="ghost"
            className="w-full"
            onClick={() => setIsSignUp(!isSignUp)}
          >
            {isSignUp ? 'Already have an account?' : 'Don&apos;t have an account?'}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
