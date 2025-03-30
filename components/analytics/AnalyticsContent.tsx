'use client';

import { useOptimistic } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { AlertTriangle, Bell } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { ErrorBoundary } from './ErrorBoundary';
import { useSSE } from '@/hooks/useSSE';
import { PriceAlert, SocialAlert } from '@/types/alerts';
import { getActiveAlerts } from '@/actions/alerts/lib/core';
import { useUser } from '@/hooks/use-user';

// Types
interface AlertsState {
  priceAlerts: PriceAlert[];
  socialAlerts: SocialAlert[];
  lastPriceUpdate: number;
  lastSocialUpdate: number;
}

const DEFAULT_STATE: AlertsState = {
  priceAlerts: [],
  socialAlerts: [],
  lastPriceUpdate: 0,
  lastSocialUpdate: 0,
};

function AlertsOverview() {
  const [state, updateState] = useOptimistic<AlertsState>(DEFAULT_STATE);
  const { toast } = useToast();
  const { user } = useUser();

  const { isConnected, error } = useSSE('/api/sse', {
    onInit: async (data) => {
      if (!user?.id) return;

      try {
        const { price, social } = await getActiveAlerts();
        updateState((prev) => ({
          ...prev,
          priceAlerts: price,
          socialAlerts: social,
        }));
      } catch (err) {
        toast({
          title: 'Error',
          description: err instanceof Error ? err.message : 'Failed to fetch alerts',
          variant: 'destructive',
        });
      }

      toast({
        title: 'Monitoring Connected',
        description: `Connection established (ID: ${data.connectionId.substring(0, 8)}...)`,
      });
    },
    onPriceUpdate: (data) => {
      updateState((prev) => ({
        ...prev,
        lastPriceUpdate: data.timestamp,
      }));
    },
    onSocialUpdate: (data) => {
      updateState((prev) => ({
        ...prev,
        lastSocialUpdate: data.timestamp,
      }));
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

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Active Alerts</CardTitle>
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
          {/* Price Alerts */}
          <div className="flex items-center justify-between rounded-lg border bg-background p-4">
            <div className="space-y-1">
              <p className="text-sm font-medium">Price Alerts</p>
              <p className="text-sm text-muted-foreground">
                {state.priceAlerts.length} active alerts
              </p>
              {state.lastPriceUpdate > 0 && (
                <p className="text-xs text-muted-foreground">
                  Last update: {new Date(state.lastPriceUpdate).toLocaleTimeString()}
                </p>
              )}
            </div>
            <Bell className="h-4 w-4 text-blue-500" />
          </div>

          {/* Social Alerts */}
          <div className="flex items-center justify-between rounded-lg border bg-background p-4">
            <div className="space-y-1">
              <p className="text-sm font-medium">Social Alerts</p>
              <p className="text-sm text-muted-foreground">
                {state.socialAlerts.length} active alerts
              </p>
              {state.lastSocialUpdate > 0 && (
                <p className="text-xs text-muted-foreground">
                  Last update: {new Date(state.lastSocialUpdate).toLocaleTimeString()}
                </p>
              )}
            </div>
            <Bell className="h-4 w-4 text-purple-500" />
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
        <AlertsOverview />
      </div>
    </ErrorBoundary>
  );
}
