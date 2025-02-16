import { useToast } from '@/hooks/use-toast';
import { useMonitoringStore } from '@/stores/monitoring';
import { useSSE } from '@/hooks/useSSE';
import { PriceAlert, SocialAlert } from '@/types/alerts';

export function MonitoringStream() {
  const { toast } = useToast();
  const { 
    setPriceAlerts, 
    setSocialAlerts,
    setError,
    clearError
  } = useMonitoringStore();

  // Use the existing SSE hook
  const { isConnected, error } = useSSE('/api/sse', {
    onEvent: {
      init: (data) => {
        console.log('Monitoring stream connected:', data);
        clearError();
      },
      price_update: (data) => {
        // Map SSE data to PriceAlert type
        const alerts: PriceAlert[] = data.alerts.map(alert => ({
          ...alert,
          direction: alert.condition,
          updated_at: alert.created_at, // Fallback to created_at if updated_at is not provided
        }));
        setPriceAlerts(alerts);
        clearError();
      },
      social_update: (data) => {
        // Map SSE data to SocialAlert type
        const alerts: SocialAlert[] = data.alerts.map(alert => ({
          ...alert,
          platform: alert.platform as 'twitter' | 'reddit' | 'discord',
          updated_at: alert.created_at, // Fallback to created_at if updated_at is not provided
        }));
        setSocialAlerts(alerts);
        clearError();
      },
      error: (data) => {
        setError(data.message);
        toast({
          variant: "destructive",
          title: "Monitoring Error",
          description: data.message,
        });
      },
    },
    retryOnError: true,
    maxRetries: 5,
    onMaxRetriesReached: () => {
      setError('Maximum reconnection attempts reached. Please refresh the page.');
    },
  });

  // This component doesn't render anything
  return null;
} 