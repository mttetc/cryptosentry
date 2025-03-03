'use client';

import { useCallback, useEffect, useOptimistic, useTransition } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Activity, AlertTriangle, CheckCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { ErrorBoundary } from './ErrorBoundary';
import { useSSE } from '@/hooks/useSSE';
import { calculateHealthScore } from '@/lib/utils';
import { PriceAlert, SocialAlert } from '@/types/alerts';

// Types
interface HealthScore {
  priceHealth: number;
  socialHealth: number;
  priceAlerts: PriceAlert[];
  socialAlerts: SocialAlert[];
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
};

function HealthDashboard() {
  const [isPending, startTransition] = useTransition();
  const [health, updateHealth] = useOptimistic<HealthScore>(DEFAULT_HEALTH);
  const { toast } = useToast();

  const { isConnected, error, connectionId } = useSSE('/api/sse', {
    onInit: (data) => {
      toast({
        title: 'Analytics Connected',
        description: `Connection established (ID: ${data.connectionId.substring(0, 8)}...)`,
      });
    },
    onPriceUpdate: (data) => {
      startTransition(() => {
        // Create a price alert from the SSE data
        const priceAlert: PriceAlert = {
          id: `price-${data.symbol}-${data.timestamp}`,
          user_id: 'system',
          symbol: data.symbol,
          target_price: data.price,
          direction: 'above',
          created_at: new Date(data.timestamp).toISOString(),
          updated_at: new Date(data.timestamp).toISOString(),
          active: true,
        };

        updateHealth((prev) => ({
          ...prev,
          priceAlerts: [...prev.priceAlerts, priceAlert],
          priceHealth: calculateHealthScore(prev.priceAlerts.length + 1),
        }));
      });
    },
    onSocialUpdate: (data) => {
      startTransition(() => {
        // Create a social alert from the SSE data
        const socialAlert: SocialAlert = {
          id: `social-${data.platform}-${data.timestamp}`,
          user_id: 'system',
          platform: data.platform as 'twitter' | 'reddit' | 'discord',
          keyword: data.content.substring(0, 50),
          created_at: new Date(data.timestamp).toISOString(),
          updated_at: new Date(data.timestamp).toISOString(),
          active: true,
        };

        updateHealth((prev) => ({
          ...prev,
          socialAlerts: [...prev.socialAlerts, socialAlert],
          socialHealth: calculateHealthScore(prev.socialAlerts.length + 1),
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

  // Handle connection status changes
  useEffect(() => {
    if (!isConnected && connectionId) {
      // We were connected before but lost connection
      toast({
        title: 'Connection Lost',
        description: 'Attempting to reconnect to analytics service...',
        variant: 'destructive',
      });
    }
  }, [isConnected, connectionId, toast]);

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
