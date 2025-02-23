'use server';

import { createServerSupabaseClient } from '@/lib/supabase';
import { getActiveAlerts } from '@/actions/alerts/lib/core';
import { deliverAlert } from '@/actions/alerts/lib/alert-delivery';
import type { AlertCondition } from '@/actions/alerts/schemas';

export interface MonitorState {
  error?: string;
  success: boolean;
}

export interface MonitorEvent {
  type: 'price' | 'social';
  data: {
    symbol?: string;
    price?: number;
    account?: string;
    content?: string;
  };
}

interface PriceData {
  symbol: string;
  price: number;
  timestamp: string;
}

interface SocialData {
  account: string;
  content: string;
  timestamp: string;
}

async function checkPriceCondition(
  condition: AlertCondition,
  targetPrice: number,
  currentPrice: number
): Promise<boolean> {
  switch (condition) {
    case 'above':
      return currentPrice >= targetPrice;
    case 'below':
      return currentPrice <= targetPrice;
    case 'between':
      // This would need additional logic and parameters
      return false;
    case 'change':
      // This would need historical price data
      return false;
    default:
      return false;
  }
}

export async function monitorPrice(symbol: string, currentPrice: number): Promise<MonitorState> {
  try {
    const supabase = await createServerSupabaseClient();
    
    // Update latest price
    await supabase
      .from('latest_prices')
      .upsert({
        symbol: symbol.toUpperCase(),
        price: currentPrice,
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'symbol',
      });

    // Get active alerts for this symbol
    const { price: priceAlerts } = await getActiveAlerts();
    const relevantAlerts = priceAlerts.filter(alert => alert.symbol === symbol);

    // Check each alert condition
    for (const alert of relevantAlerts) {
      const isTriggered = await checkPriceCondition(
        alert.condition,
        alert.target_price,
        currentPrice
      );

      if (isTriggered) {
        // Deliver alert via SMS or Call
        await deliverAlert({
          userId: alert.user_id,
          alertId: alert.id,
          type: 'price',
          message: '', // Will be formatted by delivery handler
          data: {
            symbol,
            price: currentPrice,
            condition: alert.condition,
            targetPrice: alert.target_price
          }
        });

        // Record the trigger
        await supabase
          .from('alert_triggers')
          .insert({
            alert_id: alert.id,
            triggered_at: new Date().toISOString(),
            price: currentPrice,
          });

        // Optionally deactivate one-time alerts
        if (!alert.is_recurring) {
          await supabase
            .from('price_alerts')
            .update({ active: false })
            .eq('id', alert.id);
        }
      }
    }

    return { success: true };
  } catch (error) {
    console.error('Failed to monitor price:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to monitor price',
    };
  }
}

export async function monitorSocial(account: string, content: string): Promise<MonitorState> {
  try {
    const supabase = await createServerSupabaseClient();
    
    // Get active social alerts for this account
    const { social: socialAlerts } = await getActiveAlerts();
    const relevantAlerts = socialAlerts.filter(alert => alert.account === account);

    // Check each alert's keywords
    for (const alert of relevantAlerts) {
      const hasMatchingKeywords = alert.keywords.some((keyword: string) => 
        content.toLowerCase().includes(keyword.toLowerCase())
      );

      if (hasMatchingKeywords) {
        // Deliver alert via SMS or Call
        await deliverAlert({
          userId: alert.user_id,
          alertId: alert.id,
          type: 'social',
          message: '', // Will be formatted by delivery handler
          data: {
            account,
            keywords: alert.keywords
          }
        });

        // Record the trigger
        await supabase
          .from('alert_triggers')
          .insert({
            alert_id: alert.id,
            triggered_at: new Date().toISOString(),
            content: content,
          });

        // Optionally deactivate one-time alerts
        if (!alert.is_recurring) {
          await supabase
            .from('social_alerts')
            .update({ active: false })
            .eq('id', alert.id);
        }
      }
    }

    return { success: true };
  } catch (error) {
    console.error('Failed to monitor social:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to monitor social',
    };
  }
}

export async function handleMonitorEvent(event: MonitorEvent): Promise<MonitorState> {
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
      error: error instanceof Error ? error.message : 'Failed to handle monitor event'
    };
  }
} 