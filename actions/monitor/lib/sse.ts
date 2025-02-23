'use server';

import { createServerSupabaseClient } from '@/lib/supabase';
import { monitorPrice, monitorSocial } from './core';
import type { MonitorState } from './core';

export interface SSEEvent {
  type: 'price' | 'social';
  data: {
    symbol?: string;
    price?: number;
    account?: string;
    content?: string;
  };
}

export async function handleSSEEvent(event: SSEEvent): Promise<MonitorState> {
  try {
    switch (event.type) {
      case 'price':
        if (!event.data.symbol || !event.data.price) {
          throw new Error('Invalid price event data');
        }
        return await monitorPrice(event.data.symbol, event.data.price);

      case 'social':
        if (!event.data.account || !event.data.content) {
          throw new Error('Invalid social event data');
        }
        return await monitorSocial(event.data.account, event.data.content);

      default:
        throw new Error('Unknown event type');
    }
  } catch (error) {
    console.error('Failed to handle SSE event:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to handle SSE event'
    };
  }
} 