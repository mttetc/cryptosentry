import { useEffect, useRef, useState, useCallback } from "react";
import { useToast } from "@/hooks/use-toast";
import { sseConfig } from "@/config/sse";
import { sseEventSchema } from "@/actions/monitor/schemas/sse";

interface UseSSEOptions {
  onPriceUpdate?: (data: { symbol: string; price: number; timestamp: number }) => void;
  onSocialUpdate?: (data: { platform: string; content: string; timestamp: number }) => void;
  retryOnError?: boolean;
  maxRetries?: number;
  onMaxRetriesReached?: () => void;
}

export function useSSE(url: string, options: UseSSEOptions = {}) {
  const {
    onPriceUpdate,
    onSocialUpdate,
    retryOnError = true,
    maxRetries = sseConfig.maxRetries,
    onMaxRetriesReached,
  } = options;

  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const { toast } = useToast();

  const connect = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }

    const eventSource = new EventSource(url);
    eventSourceRef.current = eventSource;

    // Handle connection open
    eventSource.addEventListener('open', () => {
      setIsConnected(true);
      setError(null);
      reconnectAttemptsRef.current = 0;
    });

    // Handle price updates
    if (onPriceUpdate) {
      eventSource.addEventListener('price_update', (event) => {
        if (event instanceof MessageEvent) {
          try {
            const data = JSON.parse(event.data);
            const validationResult = sseEventSchema.safeParse(data);
            
            if (!validationResult.success) {
              console.error('Invalid price update data:', validationResult.error);
              return;
            }

            const validatedEvent = validationResult.data;
            if (validatedEvent.type === 'price_update') {
              onPriceUpdate(validatedEvent.data);
            }
          } catch (err) {
            console.error('Failed to process price update:', err);
          }
        }
      });
    }

    // Handle social updates
    if (onSocialUpdate) {
      eventSource.addEventListener('social_update', (event) => {
        if (event instanceof MessageEvent) {
          try {
            const data = JSON.parse(event.data);
            const validationResult = sseEventSchema.safeParse(data);
            
            if (!validationResult.success) {
              console.error('Invalid social update data:', validationResult.error);
              return;
            }

            const validatedEvent = validationResult.data;
            if (validatedEvent.type === 'social_update') {
              onSocialUpdate(validatedEvent.data);
            }
          } catch (err) {
            console.error('Failed to process social update:', err);
          }
        }
      });
    }

    // Handle connection errors
    eventSource.addEventListener('error', () => {
      if (eventSource.readyState === EventSource.CLOSED) {
        setIsConnected(false);
        setError("Connection lost");
        eventSource.close();

        if (retryOnError) {
          handleReconnect();
        }
      }
    });

  }, [url, onPriceUpdate, onSocialUpdate, retryOnError, toast]);

  const handleReconnect = useCallback(() => {
    if (reconnectAttemptsRef.current < maxRetries) {
      // Use configured backoff multiplier
      const retryTimeout = Math.min(
        sseConfig.interval * Math.pow(sseConfig.backoffMultiplier, reconnectAttemptsRef.current),
        30000 // Max timeout cap
      );
      
      setTimeout(() => {
        reconnectAttemptsRef.current += 1;
        connect();

        toast({
          title: "Reconnecting",
          description: `Attempt ${reconnectAttemptsRef.current} of ${maxRetries}`,
        });
      }, retryTimeout);
    } else {
      setError("Maximum reconnection attempts reached");
      onMaxRetriesReached?.();
      
      toast({
        title: "Connection Failed",
        description: "Please refresh the page to try again",
        variant: "destructive",
      });
    }
  }, [connect, maxRetries, toast, onMaxRetriesReached]);

  useEffect(() => {
    connect();

    return () => {
      const eventSource = eventSourceRef.current;
      if (eventSource) {
        eventSource.close();
        eventSourceRef.current = null;
      }
    };
  }, [connect]);

  return {
    isConnected,
    error,
  };
}