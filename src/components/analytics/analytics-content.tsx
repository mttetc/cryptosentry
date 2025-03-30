'use client';

import { useOptimistic } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { AlertTriangle, Bell } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useSSE } from '@/hooks/use-sse';
import { PriceAlert, SocialAlert } from '@/types/alerts';
import { getActiveAlerts } from '@/actions/alerts/lib/core';
import { useUser } from '@/hooks/use-user';
import { ErrorBoundary } from '@/components/error-boundary';

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

  const { isConnected } = useSSE('/api/sse', {
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
              {isConnected ? (
                <span className="flex items-center gap-2 text-green-500">
                  <Bell className="h-4 w-4" />
                  Connected
                </span>
              ) : (
                <span className="flex items-center gap-2 text-red-500">
                  <AlertTriangle className="h-4 w-4" />
                  Disconnected
                </span>
              )}
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid gap-4">
          {/* Price Alerts */}
          {state.priceAlerts.map((alert) => (
            <div
              key={alert.id}
              className="flex items-center justify-between rounded-lg border bg-background p-4"
            >
              <div className="space-y-2">
                <p className="font-semibold">{alert.symbol}</p>
                <p className="text-sm text-muted-foreground">Target: ${alert.target_price}</p>
                <p className="text-xs text-muted-foreground">
                  Last update: {new Date(state.lastPriceUpdate).toLocaleString()}
                </p>
              </div>
              <span className="rounded-full bg-primary/10 px-2 py-1 text-xs text-primary">
                Active
              </span>
            </div>
          ))}

          {/* Social Alerts */}
          {state.socialAlerts.map((alert) => (
            <div
              key={alert.id}
              className="flex items-center justify-between rounded-lg border bg-background p-4"
            >
              <div className="space-y-2">
                <p className="font-semibold">{alert.platform}</p>
                <p className="text-sm text-muted-foreground">
                  Keywords: {alert.keywords?.join(', ')}
                </p>
                <p className="text-xs text-muted-foreground">
                  Last update: {new Date(state.lastSocialUpdate).toLocaleString()}
                </p>
              </div>
              <span className="rounded-full bg-primary/10 px-2 py-1 text-xs text-primary">
                Active
              </span>
            </div>
          ))}

          {state.priceAlerts.length === 0 && state.socialAlerts.length === 0 && (
            <p className="text-sm text-muted-foreground">No active alerts</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export function AnalyticsContent() {
  return (
    <ErrorBoundary onError={(error) => console.error('Analytics Error:', error)}>
      <AlertsOverview />
    </ErrorBoundary>
  );
}
