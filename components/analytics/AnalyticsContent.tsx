'use client';

import { useCallback, useOptimistic, useTransition } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Activity, AlertTriangle, CheckCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { ErrorBoundary } from './ErrorBoundary';
import { useSSE } from '@/hooks/useSSE';
import { calculateHealthScore } from '@/lib/utils';
import { PriceAlert, SocialAlert } from '@/types/alerts';
import { getActiveAlerts } from '@/actions/alerts/lib/core';
import { useUser } from '@/hooks/use-user';

// Types
interface HealthScore {
  priceHealth: number;
  socialHealth: number;
  priceAlerts: PriceAlert[];
  socialAlerts: SocialAlert[];
  lastPriceUpdate: number;
  lastSocialUpdate: number;
}

// Constants
const HEALTH_THRESHOLDS = {
  HEALTHY: 90,
  WARNING: 70,
} as const;

const DEFAULT_HEALTH: HealthScore = {
  priceHealth: 100,
  socialHealth: 100,
  priceAlerts: [],
  socialAlerts: [],
  lastPriceUpdate: 0,
  lastSocialUpdate: 0,
};

function HealthDashboard() {
  const [isPending, startTransition] = useTransition();
  const [health, updateHealth] = useOptimistic<HealthScore>(DEFAULT_HEALTH);
  const { toast } = useToast();
  const { user } = useUser();

  const { isConnected, error, connectionId } = useSSE('/api/sse', {
    onInit: async (data) => {
      if (!user?.id) return;

      try {
        const { price, social } = await getActiveAlerts();
        updateHealth((prev) => ({
          ...prev,
          priceAlerts: price,
          socialAlerts: social,
          priceHealth: calculateHealthScore(price.length),
          socialHealth: calculateHealthScore(social.length),
        }));
      } catch (error) {
        toast({
          title: 'Error',
          description: 'Failed to fetch alerts',
          variant: 'destructive',
        });
      }

      toast({
        title: 'Analytics Connected',
        description: `Connection established (ID: ${data.connectionId.substring(0, 8)}...)`,
      });
    },
    onPriceUpdate: (data) => {
      startTransition(() => {
        updateHealth((prev) => ({
          ...prev,
          lastPriceUpdate: data.timestamp,
        }));
      });
    },
    onSocialUpdate: (data) => {
      startTransition(() => {
        updateHealth((prev) => ({
          ...prev,
          lastSocialUpdate: data.timestamp,
        }));
      });
    },
    onTimeout: (data) => {
      toast({
        title: 'Connection Timeout',
        description: data.reason,
        variant: 'destructive',
      });
    },
    onError: (data) => {
      toast({
        title: 'Error',
        description: data.message,
        variant: 'destructive',
      });
    },
    retryOnError: true,
    maxRetries: 5,
    onMaxRetriesReached: () => {
      toast({
        title: 'Connection Failed',
        description: 'Maximum reconnection attempts reached',
        variant: 'destructive',
      });
    },
  });

  const getHealthIcon = useCallback((score: number) => {
    if (score >= HEALTH_THRESHOLDS.HEALTHY)
      return <CheckCircle className="h-4 w-4 text-green-500" />;
    if (score >= HEALTH_THRESHOLDS.WARNING)
      return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
    return <Activity className="h-4 w-4 text-red-500" />;
  }, []);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>System Health</CardTitle>
            <CardDescription>
              {isConnected ? 'Real-time monitoring active' : 'Connecting to monitoring service...'}
            </CardDescription>
          </div>
          {error && (
            <div className="flex items-center gap-2 text-sm text-red-500">
              <AlertTriangle className="h-4 w-4" />
              {error}
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid gap-4">
          {/* Price Alerts Health */}
          <div className="flex items-center justify-between rounded-lg border bg-background p-4">
            <div className="space-y-1">
              <p className="text-sm font-medium">Price Alerts</p>
              <p className="text-sm text-muted-foreground">
                {health.priceAlerts.length} active alerts
              </p>
            </div>
            {getHealthIcon(health.priceHealth)}
          </div>

          {/* Social Alerts Health */}
          <div className="flex items-center justify-between rounded-lg border bg-background p-4">
            <div className="space-y-1">
              <p className="text-sm font-medium">Social Alerts</p>
              <p className="text-sm text-muted-foreground">
                {health.socialAlerts.length} active alerts
              </p>
            </div>
            {getHealthIcon(health.socialHealth)}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function AnalyticsContent() {
  return (
    <ErrorBoundary>
      <div className="grid gap-4">
        <HealthDashboard />
      </div>
    </ErrorBoundary>
  );
}
