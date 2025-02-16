import { useEffect, useRef, useState, useCallback } from "react";
import { useToast } from "@/hooks/use-toast";

export type SSEEvent = {
  price_update: {
    alerts: Array<{
      id: string;
      symbol: string;
      price: number;
      condition: 'above' | 'below';
      target_price: number;
      user_id: string;
      active: boolean;
      created_at: string;
    }>;
    prices: Array<{
      symbol: string;
      price: number;
      timestamp: number;
      source: string;
    }>;
    timestamp: number;
  };
  social_update: {
    alerts: Array<{
      id: string;
      platform: "twitter" | "reddit" | "discord";
      keyword: string;
      user_id: string;
      active: boolean;
      created_at: string;
    }>;
    monitoring: Array<{
      platform: string;
      keyword: string;
      last_checked: string;
    }>;
    timestamp: number;
  };
  error: {
    type: 'price_monitoring' | 'social_monitoring' | 'stream';
    message: string;
  };
  init: {
    status: string;
    connectionId: string;
  };
};

export type SSEEventType = keyof SSEEvent;

interface UseSSEOptions {
  onEvent?: Partial<{
    [K in SSEEventType]: (data: SSEEvent[K]) => void;
  }>;
  retryOnError?: boolean;
  maxRetries?: number;
  onMaxRetriesReached?: () => void;
}

export function useSSE(url: string, options: UseSSEOptions = {}) {
  const {
    onEvent,
    retryOnError = true,
    maxRetries = 5,
    onMaxRetriesReached,
  } = options;

  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);
  const eventListenersRef = useRef<Map<string, EventListener>>(new Map());
  const reconnectAttemptsRef = useRef(0);
  const connectionIdRef = useRef<string | null>(null);
  const { toast } = useToast();

  const connect = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }

    const eventSource = new EventSource(url);
    eventSourceRef.current = eventSource;

    // Store the open handler
    const openHandler: EventListener = (event) => {
      setIsConnected(true);
      setError(null);
      if (connectionIdRef.current) {
        reconnectAttemptsRef.current = 0;
      }
    };
    eventSource.addEventListener('open', openHandler);
    eventListenersRef.current.set('open', openHandler);

    // Handle different event types
    const handleEvent = (eventType: SSEEventType) => {
      const callback = onEvent?.[eventType];
      if (!callback) return;

      const eventHandler: EventListener = (event) => {
        if (event instanceof MessageEvent) {
          try {
            const data = JSON.parse(event.data);
            
            if (eventType === 'init') {
              connectionIdRef.current = data.connectionId;
            }
            
            callback(data);
          } catch (err) {
            console.error(`Failed to parse ${eventType} event:`, err);
            toast({
              title: "Error",
              description: `Failed to process ${eventType} update`,
              variant: "destructive",
            });
          }
        }
      };

      eventSource.addEventListener(eventType, eventHandler);
      eventListenersRef.current.set(eventType, eventHandler);
    };

    // Set up event listeners for each event type
    (Object.keys(onEvent || {}) as SSEEventType[]).forEach(handleEvent);

    // Store the error handler
    const errorHandler: EventListener = (event) => {
      if (eventSource.readyState === EventSource.CLOSED) {
        setIsConnected(false);
        setError("Connection lost");
        eventSource.close();

        if (retryOnError) {
          handleReconnect();
        }
      }
    };
    eventSource.addEventListener('error', errorHandler);
    eventListenersRef.current.set('error', errorHandler);

  }, [url, onEvent, retryOnError, toast]);

  const handleReconnect = useCallback(() => {
    if (reconnectAttemptsRef.current < maxRetries) {
      const retryTimeout = Math.min(1000 * Math.pow(2, reconnectAttemptsRef.current), 30000);
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
        // Remove all stored event listeners
        eventListenersRef.current.forEach((listener, eventType) => {
          eventSource.removeEventListener(eventType, listener);
        });
        eventListenersRef.current.clear();
        
        // Close the connection
        eventSource.close();
        eventSourceRef.current = null;
      }
    };
  }, [connect, onEvent]);

  return {
    isConnected,
    error,
    connectionId: connectionIdRef.current,
  };
}