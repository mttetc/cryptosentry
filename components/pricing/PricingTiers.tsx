'use client';

import { useState } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Check } from 'lucide-react';
import { SUBSCRIPTION_TIERS } from '@/actions/messaging/config';
import { useToast } from '@/hooks/use-toast';

export function PricingTiers() {
  const [isLoading, setIsLoading] = useState<string | null>(null);
  const { toast } = useToast();

  const handleSubscribe = async (tier: 'BASIC' | 'PRO') => {
    try {
      setIsLoading(tier);
      // TODO: Implement subscription logic with Stripe
      toast({
        title: 'Coming Soon',
        description: 'Subscription functionality will be available soon!',
      });
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
            <li className="flex items-center gap-2">
              <Check className="h-4 w-4 text-green-500" />
              <span>{SUBSCRIPTION_TIERS.BASIC.limits.calls.daily} calls per day</span>
            </li>
            <li className="flex items-center gap-2">
              <Check className="h-4 w-4 text-green-500" />
              <span>{SUBSCRIPTION_TIERS.BASIC.limits.sms.daily} SMS per day</span>
            </li>
            <li className="flex items-center gap-2">
              <Check className="h-4 w-4 text-green-500" />
              <span>Basic monitoring features</span>
            </li>
            <li className="flex items-center gap-2">
              <Check className="h-4 w-4 text-green-500" />
              <span>Email support</span>
            </li>
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
            <li className="flex items-center gap-2">
              <Check className="h-4 w-4 text-green-500" />
              <span>{SUBSCRIPTION_TIERS.PRO.limits.calls.daily} calls per day</span>
            </li>
            <li className="flex items-center gap-2">
              <Check className="h-4 w-4 text-green-500" />
              <span>{SUBSCRIPTION_TIERS.PRO.limits.sms.daily} SMS per day</span>
            </li>
            <li className="flex items-center gap-2">
              <Check className="h-4 w-4 text-green-500" />
              <span>Advanced monitoring features</span>
            </li>
            <li className="flex items-center gap-2">
              <Check className="h-4 w-4 text-green-500" />
              <span>Priority support</span>
            </li>
            <li className="flex items-center gap-2">
              <Check className="h-4 w-4 text-green-500" />
              <span>Team collaboration</span>
            </li>
          </ul>
        </CardContent>
        <CardFooter>
          <Button 
            className="w-full" 
            variant="default"
            onClick={() => handleSubscribe('PRO')}
            disabled={isLoading !== null}
          >
            {isLoading === 'PRO' ? 'Processing...' : 'Subscribe to Pro'}
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
} 