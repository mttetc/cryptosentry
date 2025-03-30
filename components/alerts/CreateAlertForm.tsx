'use client';

import { createPriceAlert, createSocialAlert, initialAlertState } from '@/actions/alerts';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useCallback, useOptimistic } from 'react';
import { useFormStatus } from 'react-dom';

function SubmitButton() {
  const { pending } = useFormStatus();

  return (
    <Button type="submit" disabled={pending} aria-disabled={pending} className="w-full">
      {pending ? 'Creating...' : 'Create Alert'}
    </Button>
  );
}

export function CreateAlertForm() {
  const [optimisticState, setOptimisticState] = useOptimistic(initialAlertState);

  const handlePriceSubmit = useCallback(
    async (formData: FormData) => {
      // Show optimistic success state
      setOptimisticState({ success: true });

      // Reset form fields
      const form = document.querySelector('form[data-type="price"]') as HTMLFormElement;
      if (form) {
        form.reset();
      }

      // Get form data
      const data = {
        symbol: formData.get('symbol') as string,
        targetPrice: parseFloat(formData.get('targetPrice') as string),
        condition: 'above' as const, // Default condition
      };

      // Perform the action
      const result = await createPriceAlert(data);
      setOptimisticState(result);
    },
    [setOptimisticState]
  );

  const handleSocialSubmit = useCallback(
    async (formData: FormData) => {
      // Show optimistic success state
      setOptimisticState({ success: true });

      // Reset form fields
      const form = document.querySelector('form[data-type="social"]') as HTMLFormElement;
      if (form) {
        form.reset();
      }

      // Get form data
      const data = {
        account: formData.get('account') as string,
        keywords: (formData.get('keywords') as string).split(',').map((k) => k.trim()),
      };

      // Perform the action
      const result = await createSocialAlert(data);
      setOptimisticState(result);
    },
    [setOptimisticState]
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>Create New Alert</CardTitle>
        <CardDescription>Set up price or social media monitoring</CardDescription>
      </CardHeader>
      <CardContent>
        {optimisticState.error && (
          <div
            className="mb-4 rounded bg-red-50 p-2 text-sm text-red-500"
            role="alert"
            aria-live="polite"
          >
            {optimisticState.error}
          </div>
        )}

        {optimisticState.success && (
          <div
            className="mb-4 rounded bg-green-50 p-2 text-sm text-green-500"
            role="status"
            aria-live="polite"
          >
            Alert created successfully!
          </div>
        )}

        <Tabs defaultValue="price">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="price">Price Alert</TabsTrigger>
            <TabsTrigger value="social">Social Alert</TabsTrigger>
          </TabsList>

          <TabsContent value="price">
            <form action={handlePriceSubmit} className="space-y-4" data-type="price">
              <div>
                <label htmlFor="symbol" className="mb-1 block text-sm font-medium">
                  Symbol
                </label>
                <Input
                  id="symbol"
                  name="symbol"
                  placeholder="BTC"
                  required
                  minLength={1}
                  autoComplete="off"
                  aria-label="Cryptocurrency symbol"
                  aria-required="true"
                  className="uppercase"
                />
              </div>

              <div>
                <label htmlFor="targetPrice" className="mb-1 block text-sm font-medium">
                  Target Price
                </label>
                <Input
                  id="targetPrice"
                  name="targetPrice"
                  type="number"
                  placeholder="30000"
                  required
                  min={0}
                  step="any"
                  autoComplete="off"
                  aria-label="Target price in USD"
                  aria-required="true"
                />
              </div>

              <SubmitButton />
            </form>
          </TabsContent>

          <TabsContent value="social">
            <form action={handleSocialSubmit} className="space-y-4" data-type="social">
              <div>
                <label htmlFor="account" className="mb-1 block text-sm font-medium">
                  Account
                </label>
                <Input
                  id="account"
                  name="account"
                  placeholder="elonmusk"
                  required
                  minLength={1}
                  autoComplete="off"
                  aria-label="Social media account to monitor"
                  aria-required="true"
                />
              </div>

              <div>
                <label htmlFor="keywords" className="mb-1 block text-sm font-medium">
                  Keywords (comma-separated)
                </label>
                <Input
                  id="keywords"
                  name="keywords"
                  placeholder="bitcoin, crypto, btc"
                  required
                  minLength={1}
                  autoComplete="off"
                  aria-label="Keywords to monitor, separated by commas"
                  aria-required="true"
                />
              </div>

              <SubmitButton />
            </form>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
