import { useToast } from '@/hooks/use-toast';
import { useMonitoringStore } from '@/stores/monitoring';
import { useSSE } from '@/hooks/useSSE';
import { useEffect } from 'react';

export function MonitoringStream() {
  const { toast } = useToast();
  const { setError, clearError, updatePrice, updateSocial } = useMonitoringStore();

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
      // Update store with latest price
      updatePrice({
        symbol: data.symbol,
        price: data.price,
        timestamp: data.timestamp,
      });
      clearError();
    },
    onSocialUpdate: (data) => {
      // Update store with latest social content
      updateSocial({
        platform: data.platform,
        content: data.content,
        timestamp: data.timestamp,
      });
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
