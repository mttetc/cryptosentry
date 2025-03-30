'use client';

import { useState } from 'react';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Check } from 'lucide-react';
import { SUBSCRIPTION_TIERS } from '@/config/subscriptions';
import { useToast } from '@/hooks/use-toast';

const FEATURES = {
  BASIC: [
    'Real-time price monitoring',
    'Social media alerts',
    'SMS notifications',
    'Voice calls',
    'Email support',
  ],
  PRO: [
    'All Basic features',
    'Priority notifications',
    'Advanced analytics',
    'Team collaboration',
    'Priority support',
    'Custom integrations',
  ],
} as const;

export function PricingTiers() {
  const [isLoading, setIsLoading] = useState<string | null>(null);
  const { toast } = useToast();

  const handleSubscribe = async (tier: 'BASIC' | 'PRO') => {
    try {
      setIsLoading(tier);

      const response = await fetch('/api/subscriptions/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ tier }),
      });

      if (!response.ok) {
        throw new Error('Failed to create subscription');
      }

      const data = await response.json();

      // Redirect to Stripe checkout
      window.location.href = data.url;
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to process subscription',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(null);
    }
  };

  return (
    <div className="grid gap-6 md:grid-cols-2 lg:gap-8">
      {/* Basic Tier */}
      <Card className="relative">
        <CardHeader>
          <CardTitle>{SUBSCRIPTION_TIERS.BASIC.name}</CardTitle>
          <CardDescription>Perfect for individual traders</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-bold">${SUBSCRIPTION_TIERS.BASIC.price}</span>
            <span className="text-muted-foreground">/month</span>
          </div>
          <ul className="space-y-2">
            {FEATURES.BASIC.map((feature) => (
              <li key={feature} className="flex items-center gap-2">
                <Check className="h-4 w-4 text-green-500" />
                <span>{feature}</span>
              </li>
            ))}
          </ul>
        </CardContent>
        <CardFooter>
          <Button
            className="w-full"
            onClick={() => handleSubscribe('BASIC')}
            disabled={isLoading !== null}
          >
            {isLoading === 'BASIC' ? 'Processing...' : 'Subscribe to Basic'}
          </Button>
        </CardFooter>
      </Card>

      {/* Pro Tier */}
      <Card className="relative border-primary">
        <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-primary px-3 py-1 text-xs text-primary-foreground">
          Popular
        </div>
        <CardHeader>
          <CardTitle>{SUBSCRIPTION_TIERS.PRO.name}</CardTitle>
          <CardDescription>For serious traders and teams</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-bold">${SUBSCRIPTION_TIERS.PRO.price}</span>
            <span className="text-muted-foreground">/month</span>
          </div>
          <ul className="space-y-2">
            {FEATURES.PRO.map((feature) => (
              <li key={feature} className="flex items-center gap-2">
                <Check className="h-4 w-4 text-green-500" />
                <span>{feature}</span>
              </li>
            ))}
          </ul>
        </CardContent>
        <CardFooter>
          <Button
            className="w-full"
            onClick={() => handleSubscribe('PRO')}
            disabled={isLoading !== null}
            variant="default"
          >
            {isLoading === 'PRO' ? 'Processing...' : 'Subscribe to Pro'}
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
