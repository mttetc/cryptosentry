'use client';

import { useCallback, useOptimistic, useTransition } from 'react';
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

  const { isConnected, error } = useSSE('/api/sse', {
    onEvent: {
      init: (data) => {
        toast({
          title: 'Connected',
          description: data.status,
        });
      },
      price_update: (data) => {
        startTransition(() => {
          const alerts = data.alerts.map(alert => ({
            ...alert,
            direction: alert.condition,
            updated_at: alert.created_at,
          })) as PriceAlert[];

          if (alerts.length > 0) {
            updateHealth((prev) => ({
              ...prev,
              priceAlerts: alerts,
              priceHealth: calculateHealthScore(alerts.length),
            }));
          }
        });
      },
      social_update: (data) => {
        startTransition(() => {
          const alerts = data.alerts.map(alert => ({
            ...alert,
            updated_at: alert.created_at,
          }));

          if (alerts.length > 0) {
            updateHealth((prev) => ({
              ...prev,
              socialAlerts: alerts,
              socialHealth: calculateHealthScore(alerts.length),
            }));
          }
        });
      },
      error: (data) => {
        toast({
          title: 'Error',
          description: data.message,
          variant: 'destructive',
        });
      },
    },
  });

  const getHealthIcon = useCallback((score: number) => {
    if (score >= HEALTH_THRESHOLDS.HEALTHY) return <CheckCircle className="w-4 h-4 text-green-500" />;
    if (score >= HEALTH_THRESHOLDS.WARNING) return <AlertTriangle className="w-4 h-4 text-yellow-500" />;
    return <Activity className="w-4 h-4 text-red-500" />;
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
            <div className="text-red-500 text-sm flex items-center gap-2">
              <AlertTriangle className="w-4 h-4" />
              {error}
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid gap-4">
          {/* Price Alerts Health */}
          <div className="flex items-center justify-between p-4 bg-background rounded-lg border">
            <div className="space-y-1">
              <p className="text-sm font-medium">Price Alerts</p>
              <p className="text-sm text-muted-foreground">
                {health.priceAlerts.length} active alerts
              </p>
            </div>
            {getHealthIcon(health.priceHealth)}
          </div>

          {/* Social Alerts Health */}
          <div className="flex items-center justify-between p-4 bg-background rounded-lg border">
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