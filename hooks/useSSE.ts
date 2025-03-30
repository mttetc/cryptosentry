import { useEffect, useRef, useState, useCallback } from 'react';
import { useToast } from '@/hooks/use-toast';
import { sseConfig } from '@/config/sse';
import { sseEventSchema } from '@/actions/monitor/schemas/sse';

interface UseSSEOptions {
  onPriceUpdate?: (data: { symbol: string; price: number; timestamp: number }) => void;
  onSocialUpdate?: (data: { platform: string; content: string; timestamp: number }) => void;
  onInit?: (data: { connectionId: string; status: string; userId?: string }) => void;
  onTimeout?: (data: { reason: string; timestamp: number }) => void;
  onError?: (data: { message: string; code?: string; details?: any }) => void;
  retryOnError?: boolean;
  maxRetries?: number;
  onMaxRetriesReached?: () => void;
}

export function useSSE(url: string, options: UseSSEOptions = {}) {
  const {
    onPriceUpdate,
    onSocialUpdate,
    onInit,
    onTimeout,
    onError,
    retryOnError = true,
    maxRetries = sseConfig.maxRetries,
    onMaxRetriesReached,
  } = options;

  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [connectionId, setConnectionId] = useState<string | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const lastActivityRef = useRef<number>(Date.now());
  const { toast } = useToast();

  const connect = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }

    try {
      const eventSource = new EventSource(url);
      eventSourceRef.current = eventSource;

      // Handle connection open
      eventSource.addEventListener('open', () => {
        setIsConnected(true);
        setError(null);
        reconnectAttemptsRef.current = 0;
        lastActivityRef.current = Date.now();
      });

      // Handle init event
      eventSource.addEventListener('init', (event) => {
        if (event instanceof MessageEvent) {
          try {
            const data = JSON.parse(event.data);
            const validationResult = sseEventSchema.safeParse({
              type: 'init',
              data,
            });

            if (!validationResult.success) {
              console.error('Invalid init data:', validationResult.error);
              return;
            }

            const validatedEvent = validationResult.data;
            setConnectionId(data.connectionId);
            lastActivityRef.current = Date.now();

            if (onInit) {
              onInit(data);
            }
          } catch (err) {
            console.error('Failed to process init event:', err);
          }
        }
      });

      // Handle ping events (heartbeat)
      eventSource.addEventListener('ping', (event) => {
        if (event instanceof MessageEvent) {
          try {
            lastActivityRef.current = Date.now();
          } catch (err) {
            console.error('Failed to process ping event:', err);
          }
        }
      });

      // Handle price updates
      if (onPriceUpdate) {
        eventSource.addEventListener('price_update', (event) => {
          if (event instanceof MessageEvent) {
            try {
              const data = JSON.parse(event.data);
              const validationResult = sseEventSchema.safeParse({
                type: 'price_update',
                data,
              });

              if (!validationResult.success) {
                console.error('Invalid price update data:', validationResult.error);
                return;
              }

              lastActivityRef.current = Date.now();
              onPriceUpdate(data);
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
              const validationResult = sseEventSchema.safeParse({
                type: 'social_update',
                data,
              });

              if (!validationResult.success) {
                console.error('Invalid social update data:', validationResult.error);
                return;
              }

              lastActivityRef.current = Date.now();
              onSocialUpdate(data);
            } catch (err) {
              console.error('Failed to process social update:', err);
            }
          }
        });
      }

      // Handle timeout events
      if (onTimeout) {
        eventSource.addEventListener('timeout', (event) => {
          if (event instanceof MessageEvent) {
            try {
              const data = JSON.parse(event.data);
              const validationResult = sseEventSchema.safeParse({
                type: 'timeout',
                data,
              });

              if (!validationResult.success) {
                console.error('Invalid timeout data:', validationResult.error);
                return;
              }

              onTimeout(data);
              eventSource.close();
              setIsConnected(false);
              setError(`Connection timeout: ${data.reason}`);
            } catch (err) {
              console.error('Failed to process timeout event:', err);
            }
          }
        });
      }

      // Handle error events from server
      eventSource.addEventListener('error', (event) => {
        if (event instanceof MessageEvent) {
          try {
            const data = JSON.parse(event.data);
            const validationResult = sseEventSchema.safeParse({
              type: 'error',
              data,
            });

            if (!validationResult.success) {
              console.error('Invalid error data:', validationResult.error);
              return;
            }

            if (onError) {
              onError(data);
            }

            setError(data.message);

            if (data.code === 'UNAUTHORIZED') {
              // Don't retry on auth errors
              eventSource.close();
              setIsConnected(false);
            }
          } catch (err) {
            console.error('Failed to process error event:', err);
          }
        } else if (eventSource.readyState === EventSource.CLOSED) {
          // Handle connection errors
          setIsConnected(false);
          setError('Connection lost');
          eventSource.close();

          if (retryOnError) {
            handleReconnect();
          }
        }
      });
    } catch (err) {
      console.error('Failed to create EventSource:', err);
      setError('Failed to connect to event source');

      if (retryOnError) {
        handleReconnect();
      }
    }
  }, [url, onPriceUpdate, onSocialUpdate, onInit, onTimeout, onError, retryOnError, toast]);

  const handleReconnect = useCallback(() => {
    if (reconnectAttemptsRef.current < maxRetries) {
      // Use configured backoff multiplier
      const retryTimeout = Math.min(
        sseConfig.reconnectInterval *
          Math.pow(sseConfig.backoffMultiplier, reconnectAttemptsRef.current),
        30000 // Max timeout cap
      );

      setTimeout(() => {
        reconnectAttemptsRef.current += 1;
        connect();

        toast({
          title: 'Reconnecting',
          description: `Attempt ${reconnectAttemptsRef.current} of ${maxRetries}`,
        });
      }, retryTimeout);
    } else {
      setError('Maximum reconnection attempts reached');
      onMaxRetriesReached?.();

      toast({
        title: 'Connection Failed',
        description: 'Please refresh the page to try again',
        variant: 'destructive',
      });
    }
  }, [connect, maxRetries, toast, onMaxRetriesReached]);

  // Set up inactivity detection
  useEffect(() => {
    if (!isConnected) return;

    const checkInactivity = setInterval(() => {
      const now = Date.now();
      const inactiveTime = now - lastActivityRef.current;

      // If no activity for 2x the heartbeat interval, consider the connection stale
      if (inactiveTime > sseConfig.heartbeatInterval * 2) {
        console.warn('SSE connection appears stale, reconnecting...');

        if (eventSourceRef.current) {
          eventSourceRef.current.close();
        }

        setIsConnected(false);
        setError('Connection stale');

        if (retryOnError) {
          handleReconnect();
        }
      }
    }, sseConfig.heartbeatInterval);

    return () => {
      clearInterval(checkInactivity);
    };
  }, [isConnected, handleReconnect, retryOnError]);

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
    connectionId,
  };
}
