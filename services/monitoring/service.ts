import { WebSocket } from 'ws';
import { config } from '@/config/monitoring';
import { createServerSupabaseClient } from '@/lib/supabase';
import { logError } from '@/lib/logger';
import { startSocialMonitoring, stopSocialMonitoring } from '@/actions/social';
import { startPriceMonitoring, stopPriceMonitoring } from '@/actions/exchanges';

// Types
interface MonitoringState {
  isActive: boolean;
  priceSocket: WebSocket | null;
  socialSocket: WebSocket | null;
  heartbeatInterval: NodeJS.Timeout | null;
  socialHeartbeatInterval: NodeJS.Timeout | null;
  lastError: Error | null;
  startTime: number | null;
}

// Service state
let state: MonitoringState = {
  isActive: false,
  priceSocket: null,
  socialSocket: null,
  heartbeatInterval: null,
  socialHeartbeatInterval: null,
  lastError: null,
  startTime: null,
};

let initializationPromise: Promise<void> | null = null;

// Initialize the monitoring service
export async function initialize(): Promise<void> {
  if (initializationPromise) {
    return initializationPromise;
  }

  initializationPromise = (async () => {
    try {
      // Initialize database connection
      const supabase = await createServerSupabaseClient();
      const { error } = await supabase.from('health_check').select('count');
      if (error) throw error;

      // Start price monitoring
      await startPriceMonitoring();
      const priceSocket = new WebSocket('wss://stream.binance.com:9443/ws');
      
      const heartbeatInterval = setInterval(() => {
        if (priceSocket.readyState === WebSocket.OPEN) {
          priceSocket.ping();
        }
      }, config.monitoring.websocket.pingInterval);

      // Set up price socket reconnection
      priceSocket.on('close', () => {
        const backoff = Math.min(
          config.monitoring.websocket.initialBackoff * 
          Math.pow(config.monitoring.websocket.backoffMultiplier, 1),
          config.monitoring.websocket.maxBackoff
        );
        setTimeout(async () => {
          try {
            await startPriceMonitoring();
          } catch (error) {
            logError('Failed to reconnect price monitoring:', error);
          }
        }, backoff);
      });

      // Start social monitoring
      await startSocialMonitoring();
      
      if (!process.env.SOCIAL_STREAM_ENDPOINT) {
        throw new Error('SOCIAL_STREAM_ENDPOINT not configured');
      }

      const socialSocket = new WebSocket(process.env.SOCIAL_STREAM_ENDPOINT);
      
      const socialHeartbeatInterval = setInterval(() => {
        if (socialSocket.readyState === WebSocket.OPEN) {
          socialSocket.ping();
        }
      }, config.monitoring.websocket.pingInterval);

      // Set up social socket reconnection
      socialSocket.on('close', () => {
        const backoff = Math.min(
          config.monitoring.websocket.initialBackoff * 
          Math.pow(config.monitoring.websocket.backoffMultiplier, 1),
          config.monitoring.websocket.maxBackoff
        );
        setTimeout(async () => {
          try {
            await startSocialMonitoring();
          } catch (error) {
            logError('Failed to reconnect social monitoring:', error);
          }
        }, backoff);
      });

      // Update state
      state = {
        isActive: true,
        priceSocket,
        socialSocket,
        heartbeatInterval,
        socialHeartbeatInterval,
        lastError: null,
        startTime: Date.now(),
      };

    } catch (error) {
      state = {
        ...state,
        isActive: false,
        lastError: error instanceof Error ? error : new Error('Unknown error'),
      };
      throw error;
    }
  })();

  return initializationPromise;
}

// Clean up all resources
export async function cleanup(): Promise<void> {
  try {
    // Stop monitoring services
    await Promise.all([
      stopPriceMonitoring(),
      stopSocialMonitoring(),
    ]);

    // Clean up WebSocket connections
    if (state.priceSocket) {
      state.priceSocket.close();
    }
    if (state.socialSocket) {
      state.socialSocket.close();
    }

    // Clear intervals
    if (state.heartbeatInterval) {
      clearInterval(state.heartbeatInterval);
    }
    if (state.socialHeartbeatInterval) {
      clearInterval(state.socialHeartbeatInterval);
    }

  } catch (error) {
    logError('Failed to cleanup monitoring service:', error);
  } finally {
    // Reset state
    state = {
      isActive: false,
      priceSocket: null,
      socialSocket: null,
      heartbeatInterval: null,
      socialHeartbeatInterval: null,
      lastError: null,
      startTime: null,
    };
    initializationPromise = null;
  }
}

// Restart the service
export async function restart(): Promise<void> {
  await cleanup();
  await initialize();
}

// Get current service status
export function getStatus() {
  return {
    isActive: state.isActive,
    startTime: state.startTime,
    lastError: state.lastError?.message,
    connections: {
      database: true, // We assume database is always available due to server-side nature
      priceMonitoring: !!state.priceSocket && state.priceSocket.readyState === WebSocket.OPEN,
      socialMonitoring: !!state.socialSocket && state.socialSocket.readyState === WebSocket.OPEN,
    },
    uptime: state.startTime ? Date.now() - state.startTime : 0,
  };
} 