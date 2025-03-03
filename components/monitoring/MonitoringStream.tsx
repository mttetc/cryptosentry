import { useToast } from '@/hooks/use-toast';
import { useMonitoringStore } from '@/stores/monitoring';
import { useSSE } from '@/hooks/useSSE';
import { PriceAlert, SocialAlert } from '@/types/alerts';
import { useEffect } from 'react';

export function MonitoringStream() {
  const { toast } = useToast();
  const { priceAlerts, socialAlerts, setPriceAlerts, setSocialAlerts, setError, clearError } =
    useMonitoringStore();

  // Use the enhanced SSE hook with the correct interface
  const { isConnected, error, connectionId } = useSSE('/api/sse', {
    onInit: (data) => {
      console.log(`Monitoring stream connected with ID: ${data.connectionId}`);
      clearError();
      toast({
        title: 'Monitoring Connected',
        description: 'Real-time alerts are now active',
      });
    },
    onPriceUpdate: (data) => {
      // Create a price alert from the SSE data
      const priceAlert: PriceAlert = {
        id: `price-${data.symbol}-${data.timestamp}`,
        user_id: 'system', // This should be replaced with actual user ID if available
        symbol: data.symbol,
        target_price: data.price,
        direction: 'above', // Default value, should be determined by your business logic
        created_at: new Date(data.timestamp).toISOString(),
        updated_at: new Date(data.timestamp).toISOString(),
        active: true,
      };

      // Update the store with the new alert
      setPriceAlerts([...priceAlerts, priceAlert]);
      clearError();
    },
    onSocialUpdate: (data) => {
      // Create a social alert from the SSE data
      const socialAlert: SocialAlert = {
        id: `social-${data.platform}-${data.timestamp}`,
        user_id: 'system', // This should be replaced with actual user ID if available
        platform: data.platform as 'twitter' | 'reddit' | 'discord',
        keyword: data.content.substring(0, 50), // Using first 50 chars as keyword
        created_at: new Date(data.timestamp).toISOString(),
        updated_at: new Date(data.timestamp).toISOString(),
        active: true,
      };

      // Update the store with the new alert
      setSocialAlerts([...socialAlerts, socialAlert]);
      clearError();
    },
    onTimeout: (data) => {
      setError(`Connection timeout: ${data.reason}`);
      toast({
        variant: 'destructive',
        title: 'Monitoring Timeout',
        description: data.reason,
      });
    },
    onError: (data) => {
      setError(data.message);
      toast({
        variant: 'destructive',
        title: 'Monitoring Error',
        description: data.message,
      });
    },
    retryOnError: true,
    maxRetries: 5,
    onMaxRetriesReached: () => {
      setError('Maximum reconnection attempts reached. Please refresh the page.');
      toast({
        variant: 'destructive',
        title: 'Connection Failed',
        description: 'Maximum reconnection attempts reached. Please refresh the page.',
      });
    },
  });

  // Handle connection status changes
  useEffect(() => {
    if (!isConnected && connectionId) {
      // We were connected before but lost connection
      setError('Connection lost. Attempting to reconnect...');
      toast({
        variant: 'destructive',
        title: 'Connection Lost',
        description: 'Attempting to reconnect to monitoring service...',
      });
    }
  }, [isConnected, connectionId, setError, toast]);

  // This component doesn't render anything
  return null;
}
