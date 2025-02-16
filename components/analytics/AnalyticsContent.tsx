'use client';

import { useCallback, useEffect, useOptimistic, useTransition } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Activity, AlertTriangle, CheckCircle, Loader2 } from 'lucide-react';
import { getSystemHealth, subscribeToHealth, type HealthScore } from '@/actions/analytics';
import { useToast } from '@/hooks/use-toast';
import { ErrorBoundary } from './ErrorBoundary';

// Constants
const HEALTH_THRESHOLDS = {
  HEALTHY: 90,
  WARNING: 70,
} as const;

const RECONNECT_TIMEOUT = 3000; // 3 seconds
const MAX_RETRIES = 3;
const BACKOFF_MULTIPLIER = 1.5;

function HealthDashboard() {
  const [isPending, startTransition] = useTransition();
  const [health, updateHealth] = useOptimistic<HealthScore | null>(null);
  const { toast } = useToast();

  // Subscribe to health updates with improved error handling
  useEffect(() => {
    let retryCount = 0;
    let retryTimeout: NodeJS.Timeout;
    const abortController = new AbortController();

    async function subscribe() {
      if (retryCount >= MAX_RETRIES) {
        toast({
          title: 'Connection Error',
          description: 'Failed to connect to health monitoring service. Please try again later.',
          variant: 'destructive',
        });
        return;
      }

      try {
        // Get initial health data
        const initialHealth = await getSystemHealth();
        if (initialHealth.success && initialHealth.health) {
          updateHealth(initialHealth.health);
          // Reset retry count on successful connection
          retryCount = 0;
        } else {
          throw new Error('Failed to get initial health data');
        }

        // Subscribe to updates
        for await (const data of subscribeToHealth(abortController.signal)) {
          if (abortController.signal.aborted) break;
          updateHealth(data);
        }
      } catch (error) {
        console.error('Health subscription error:', error);
        retryCount++;
        
        // Clear any existing retry timeout
        if (retryTimeout) {
          clearTimeout(retryTimeout);
        }
        
        // Attempt to reconnect with exponential backoff
        const delay = RECONNECT_TIMEOUT * Math.pow(BACKOFF_MULTIPLIER, retryCount - 1);
        retryTimeout = setTimeout(subscribe, delay);
        
        if (retryCount === 1) {
          toast({
            title: 'Connection Lost',
            description: 'Attempting to reconnect...',
            variant: 'default',
          });
        }
      }
    }

    subscribe();

    return () => {
      abortController.abort();
      if (retryTimeout) {
        clearTimeout(retryTimeout);
      }
    };
  }, [toast, updateHealth]);

  // Utility functions
  const getHealthColor = useCallback((score: number) => {
    if (score >= HEALTH_THRESHOLDS.HEALTHY) return 'text-green-500';
    if (score >= HEALTH_THRESHOLDS.WARNING) return 'text-yellow-500';
    return 'text-red-500';
  }, []);

  const getHealthIcon = useCallback((score: number) => {
    if (score >= HEALTH_THRESHOLDS.HEALTHY) return <CheckCircle className="h-8 w-8 text-green-500" />;
    if (score >= HEALTH_THRESHOLDS.WARNING) return <AlertTriangle className="h-8 w-8 text-yellow-500" />;
    return <AlertTriangle className="h-8 w-8 text-red-500" />;
  }, []);

  const getHealthStatus = useCallback((score: number) => {
    if (score >= HEALTH_THRESHOLDS.HEALTHY) return 'Healthy';
    if (score >= HEALTH_THRESHOLDS.WARNING) return 'Warning';
    return 'Critical';
  }, []);

  if (!health) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <Activity className="h-6 w-6 text-primary" />
        {isPending && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>Updating...</span>
          </div>
        )}
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        {(Object.entries(health) as [keyof HealthScore, number][]).map(([service, score]) => (
          <Card key={service} className={isPending ? 'opacity-60' : ''}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                {service.charAt(0).toUpperCase() + service.slice(1)} Service
              </CardTitle>
              {getHealthIcon(score)}
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                <span className={getHealthColor(score)}>{score.toFixed(1)}%</span>
              </div>
              <p className="text-xs text-muted-foreground">
                {getHealthStatus(score)}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className={isPending ? 'opacity-60' : ''}>
        <CardHeader>
          <CardTitle>System Performance</CardTitle>
          <CardDescription>Real-time monitoring of critical metrics</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-8">
            {(Object.entries(health) as [keyof HealthScore, number][]).map(([service, score]) => (
              <div key={service} className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">
                    {service.charAt(0).toUpperCase() + service.slice(1)} Health
                  </span>
                  <span className={`text-sm ${getHealthColor(score)}`}>
                    {score.toFixed(1)}%
                  </span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-secondary">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${
                      score >= HEALTH_THRESHOLDS.HEALTHY
                        ? 'bg-green-500'
                        : score >= HEALTH_THRESHOLDS.WARNING
                          ? 'bg-yellow-500'
                          : 'bg-red-500'
                    }`}
                    style={{ width: `${score}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export function AnalyticsContent() {
  return (
    <ErrorBoundary>
      <HealthDashboard />
    </ErrorBoundary>
  );
} 