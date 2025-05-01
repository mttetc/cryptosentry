'use client';

import { useToast } from '@/hooks/use-toast';
import { useMonitoringStore } from '@/stores/monitoring';
import { useSSE } from '@/hooks/use-sse';

export function MonitoringStream() {
  const { toast } = useToast();
  const { setError, clearError, updatePrice, updateSocial } = useMonitoringStore();

  // Use the enhanced SSE hook with the correct interface
  useSSE('/api/sse', {
    onInit: () => {
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
  });

  // This component doesn't render anything
  return null;
}
