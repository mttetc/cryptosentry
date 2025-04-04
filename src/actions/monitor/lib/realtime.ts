'use server';

import { encodeSSE } from './sse-utils';

// Keep track of active SSE connections and their monitoring subscriptions
const SSE_CONNECTIONS = new Map<
  string,
  {
    controller: ReadableStreamController<Uint8Array>;
    userId: string;
    lastActivity: number;
    subscriptions: {
      price: Set<string>;
      social: Set<string>;
    };
  }
>();

export async function handleSSEConnection(
  userId: string,
  controller: ReadableStreamController<Uint8Array>
): Promise<string> {
  const connectionId = crypto.randomUUID();

  // Store connection info
  SSE_CONNECTIONS.set(connectionId, {
    controller,
    userId,
    lastActivity: Date.now(),
    subscriptions: {
      price: new Set(),
      social: new Set(),
    },
  });

  // Send initial connection message
  controller.enqueue(
    encodeSSE('init', {
      status: 'connected',
      connectionId,
      userId,
    })
  );

  return connectionId;
}

export async function subscribeToPriceUpdates(connectionId: string, symbol: string): Promise<void> {
  const connection = SSE_CONNECTIONS.get(connectionId);
  if (!connection) return;

  connection.subscriptions.price.add(symbol);
}

export async function subscribeToSocialUpdates(
  connectionId: string,
  platform: string,
  keyword: string
): Promise<void> {
  const connection = SSE_CONNECTIONS.get(connectionId);
  if (!connection) return;

  connection.subscriptions.social.add(`${platform}:${keyword}`);
}

export async function unsubscribeFromPriceUpdates(
  connectionId: string,
  symbol: string
): Promise<void> {
  const connection = SSE_CONNECTIONS.get(connectionId);
  if (!connection) return;

  connection.subscriptions.price.delete(symbol);
}

export async function unsubscribeFromSocialUpdates(
  connectionId: string,
  platform: string,
  keyword: string
): Promise<void> {
  const connection = SSE_CONNECTIONS.get(connectionId);
  if (!connection) return;

  connection.subscriptions.social.delete(`${platform}:${keyword}`);
}

export async function closeSSEConnection(connectionId: string): Promise<void> {
  const connection = SSE_CONNECTIONS.get(connectionId);
  if (!connection) return;

  // Close the controller
  try {
    connection.controller.close();
  } catch (error) {
    console.error('Error closing SSE controller:', error);
  }

  // Remove from connections map
  SSE_CONNECTIONS.delete(connectionId);
}

// Helper function to broadcast updates to subscribed clients
export async function broadcastUpdate(type: 'price' | 'social', data: any): Promise<void> {
  const eventType = type === 'price' ? 'price_update' : 'social_update';

  for (const [connectionId, connection] of SSE_CONNECTIONS.entries()) {
    try {
      if (type === 'price' && connection.subscriptions.price.has(data.symbol)) {
        connection.controller.enqueue(encodeSSE(eventType, data));
      } else if (
        type === 'social' &&
        connection.subscriptions.social.has(`${data.platform}:${data.keyword}`)
      ) {
        connection.controller.enqueue(encodeSSE(eventType, data));
      }
    } catch (error) {
      console.error(`Error broadcasting to connection ${connectionId}:`, error);
      await closeSSEConnection(connectionId);
    }
  }
}
