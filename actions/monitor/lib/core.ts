'use server';

import { monitorPrice } from '@/lib/services/monitoring/price';
import { monitorSocial } from '@/lib/services/monitoring/social';
import type { MonitorEvent, MonitorState } from '../schemas/monitor';

export async function monitorEvent(event: MonitorEvent): Promise<MonitorState> {
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
    console.error('Failed to handle monitor event:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to handle monitor event',
    };
  }
}
