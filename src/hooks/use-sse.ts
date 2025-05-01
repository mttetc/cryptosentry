import { sseEventSchema } from '@/actions/monitor/schemas/sse';
import { useCallback, useEffect, useRef, useState } from 'react';

interface UseSSEOptions {
  onPriceUpdate?: (_data: { symbol: string; price: number; timestamp: number }) => void;
  onSocialUpdate?: (_data: { platform: string; content: string; timestamp: number }) => void;
  onInit?: (_data: { connectionId: string; status: string; userId?: string }) => void;
  onTimeout?: (_data: { reason: string; timestamp: number }) => void;
  onError?: (_data: { message: string; code?: string; details?: any }) => void;
}

export function useSSE(url: string, options: UseSSEOptions = {}) {
  const { onPriceUpdate, onSocialUpdate, onInit, onTimeout, onError } = options;

  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [connectionId, setConnectionId] = useState<string | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);
  const lastActivityRef = useRef<number>(Date.now());

  const connect = useCallback((): void => {
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
        }
      });
    } catch (err) {
      console.error('Failed to create EventSource:', err);
      setError('Failed to connect to event source');
    }
  }, [url, onPriceUpdate, onSocialUpdate, onInit, onTimeout, onError]);

  // Cleanup on unmount
  useEffect(() => {
    connect();

    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
    };
  }, []);

  return {
    isConnected,
    error,
    connectionId,
  };
}
