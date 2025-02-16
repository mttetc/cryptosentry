'use client';

import { useFormState, useFormStatus } from 'react-dom';
import { useCallback, useOptimistic, useTransition } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  createPriceAlertAction, 
  createSocialAlertAction, 
  initialAlertState,
  type AlertFormState 
} from '@/actions/alerts';

function SubmitButton() {
  const { pending } = useFormStatus();
  
  return (
    <Button 
      type="submit" 
      disabled={pending}
      aria-disabled={pending}
      className="w-full"
    >
      {pending ? 'Creating...' : 'Create Alert'}
    </Button>
  );
}

export function CreateAlertForm() {
  const [isPending, startTransition] = useTransition();
  const [priceState, priceAction] = useFormState(createPriceAlertAction, initialAlertState);
  const [socialState, socialAction] = useFormState(createSocialAlertAction, initialAlertState);
  
  const [optimisticPrice, addOptimisticPrice] = useOptimistic(
    priceState,
    (state: AlertFormState, optimisticValue: AlertFormState) => optimisticValue
  );

  const [optimisticSocial, addOptimisticSocial] = useOptimistic(
    socialState,
    (state: AlertFormState, optimisticValue: AlertFormState) => optimisticValue
  );

  const handlePriceSubmit = useCallback(async (formData: FormData) => {
    startTransition(() => {
      // Show optimistic success state
      addOptimisticPrice({ success: true, error: '' });
      
      // Reset form fields
      const form = document.querySelector('form[data-type="price"]') as HTMLFormElement;
      if (form) {
        form.reset();
      }
      
      // Perform the action
      priceAction(formData);
    });
  }, [priceAction, addOptimisticPrice]);

  const handleSocialSubmit = useCallback(async (formData: FormData) => {
    startTransition(() => {
      // Show optimistic success state
      addOptimisticSocial({ success: true, error: '' });
      
      // Reset form fields
      const form = document.querySelector('form[data-type="social"]') as HTMLFormElement;
      if (form) {
        form.reset();
      }
      
      // Perform the action
      socialAction(formData);
    });
  }, [socialAction, addOptimisticSocial]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Create New Alert</CardTitle>
        <CardDescription>Set up price or social media monitoring</CardDescription>
      </CardHeader>
      <CardContent>
        {(optimisticPrice.error || optimisticSocial.error) && (
          <div 
            className="mb-4 p-2 text-sm text-red-500 bg-red-50 rounded" 
            role="alert"
            aria-live="polite"
          >
            {optimisticPrice.error || optimisticSocial.error}
          </div>
        )}
        
        {(optimisticPrice.success || optimisticSocial.success) && (
          <div 
            className="mb-4 p-2 text-sm text-green-500 bg-green-50 rounded" 
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
            <form 
              action={handlePriceSubmit}
              className="space-y-4"
              data-type="price"
            >
              <div>
                <label htmlFor="symbol" className="block text-sm font-medium mb-1">
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
                <label htmlFor="targetPrice" className="block text-sm font-medium mb-1">
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
            <form 
              action={handleSocialSubmit}
              className="space-y-4"
              data-type="social"
            >
              <div>
                <label htmlFor="account" className="block text-sm font-medium mb-1">
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
                <label htmlFor="keywords" className="block text-sm font-medium mb-1">
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