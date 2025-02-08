'use server';

import { z } from 'zod';
import { createServerSupabaseClient } from '@/lib/supabase';
import { revalidatePath } from 'next/cache';
import { makeCall, sendSMS } from '@/actions/twilio';

const alertSchema = z.object({
  phone: z.string().min(10),
  active24h: z.boolean(),
  symbol: z.string().min(1),
  priceTarget: z.string().min(1),
  alertAbove: z.boolean(),
  alertBelow: z.boolean(),
  percentageChange: z.string().optional(),
  quietHoursStart: z.string().optional(),
  quietHoursEnd: z.string().optional(),
  weekendsEnabled: z.boolean().optional(),
  preferSMS: z.boolean().optional().default(false),
  accounts: z.string(),
  keywords: z.string(),
  // New combined conditions
  combinedConditions: z
    .array(
      z.object({
        symbol: z.string(),
        condition: z.enum(['above', 'below', 'between']),
        value: z.number(),
        value2: z.number().optional(), // For 'between' condition
        percentageChange: z.number().optional(),
        timeWindow: z.number().optional(), // In minutes
      })
    )
    .optional(),
  logicOperator: z.enum(['AND', 'OR']).optional(),
});

export type AlertState = {
  error?: string;
  success?: boolean;
};

// Cache last prices to calculate percentage changes
const lastPrices = new Map<string, { price: number; timestamp: number }>();
const PRICE_CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours

// Rate limiting for notifications
const notificationRateLimit = new Map<string, number>();
const RATE_LIMIT_WINDOW = 5 * 60 * 1000; // 5 minutes

interface PriceAlert {
  id: string;
  user_id: string;
  symbol: string;
  target_price: number;
  target_price_2?: number;
  percentage_change?: number;
  alert_above: boolean;
  alert_below: boolean;
  condition_type?: 'above' | 'below' | 'between';
  time_window?: number;
}

interface User {
  id: string;
  phone: string;
  active_24h: boolean;
  quiet_hours_start?: string;
  quiet_hours_end?: string;
  weekends_enabled?: boolean;
  prefer_sms: boolean;
}

function isWithinQuietHours(user: User): boolean {
  if (!user.quiet_hours_start || !user.quiet_hours_end) return false;
  if (!user.active_24h) return false;

  const now = new Date();
  const currentHour = now.getHours();
  const currentMinute = now.getMinutes();
  const currentTime = currentHour * 60 + currentMinute;

  const [startHour, startMinute] = user.quiet_hours_start.split(':').map(Number);
  const [endHour, endMinute] = user.quiet_hours_end.split(':').map(Number);
  const startTime = startHour * 60 + startMinute;
  const endTime = endHour * 60 + endMinute;

  // Handle weekend check
  if (!user.weekends_enabled && (now.getDay() === 0 || now.getDay() === 6)) {
    return true;
  }

  // Handle quiet hours crossing midnight
  if (startTime > endTime) {
    return currentTime >= startTime || currentTime <= endTime;
  }

  return currentTime >= startTime && currentTime <= endTime;
}

function isRateLimited(userId: string): boolean {
  const lastNotification = notificationRateLimit.get(userId);
  const now = Date.now();

  if (!lastNotification || now - lastNotification > RATE_LIMIT_WINDOW) {
    notificationRateLimit.set(userId, now);
    return false;
  }

  return true;
}

function calculatePercentageChange(symbol: string, currentPrice: number): number | null {
  const lastPrice = lastPrices.get(symbol);
  if (!lastPrice) return null;

  const now = Date.now();
  if (now - lastPrice.timestamp > PRICE_CACHE_TTL) {
    lastPrices.delete(symbol);
    return null;
  }

  return ((currentPrice - lastPrice.price) / lastPrice.price) * 100;
}

interface CombinedConditionAlert {
  type: 'combined';
  conditions: {
    assets: Array<{
      symbol: string;
      condition: 'above' | 'below' | 'between' | 'change';
      value: number;
      value2?: number;
      percentageChange?: number;
      isReference?: boolean;
    }>;
    logicOperator: 'AND' | 'OR';
  };
  prices: Record<
    string,
    {
      price: number;
      change?: number;
    }
  >;
}

export async function saveAlerts(prevState: AlertState, formData: FormData): Promise<AlertState> {
  try {
    const validatedFields = alertSchema.parse({
      phone: formData.get('phone'),
      active24h: formData.get('active24h') === 'true',
      symbol: formData.get('symbol'),
      priceTarget: formData.get('priceTarget'),
      alertAbove: formData.get('alertAbove') === 'true',
      alertBelow: formData.get('alertBelow') === 'true',
      percentageChange: formData.get('percentageChange'),
      quietHoursStart: formData.get('quietHoursStart'),
      quietHoursEnd: formData.get('quietHoursEnd'),
      weekendsEnabled: formData.get('weekendsEnabled') === 'true',
      preferSMS: formData.get('preferSMS') === 'true',
      accounts: formData.get('accounts'),
      keywords: formData.get('keywords'),
      combinedConditions: formData.get('combinedConditions')
        ? JSON.parse(formData.get('combinedConditions') as string)
        : undefined,
      logicOperator: formData.get('logicOperator') as 'AND' | 'OR' | undefined,
    });

    const supabase = await createServerSupabaseClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      const { error } = await supabase.auth.signUp({
        email: `${Date.now()}@example.com`,
        password: 'password123',
      });
      if (error) throw error;
    }

    const userId = session?.user.id;

    // Save user data with quiet hours
    const { error: userError } = await supabase.from('users').upsert({
      id: userId,
      phone: validatedFields.phone,
      active_24h: validatedFields.active24h,
      quiet_hours_start: validatedFields.quietHoursStart,
      quiet_hours_end: validatedFields.quietHoursEnd,
      weekends_enabled: validatedFields.weekendsEnabled,
      prefer_sms: validatedFields.preferSMS,
    });

    if (userError) throw userError;

    // Save price alerts with combined conditions
    if (validatedFields.combinedConditions?.length) {
      for (const condition of validatedFields.combinedConditions) {
        const { error: priceError } = await supabase.from('price_alerts').upsert({
          user_id: userId,
          symbol: condition.symbol,
          target_price: condition.value,
          target_price_2: condition.value2,
          percentage_change: condition.percentageChange,
          condition_type: condition.condition,
          time_window: condition.timeWindow,
          alert_above: condition.condition === 'above',
          alert_below: condition.condition === 'below',
          logic_operator: validatedFields.logicOperator || 'AND',
        });

        if (priceError) throw priceError;
      }
    } else {
      // Save single price alert
      const { error: priceError } = await supabase.from('price_alerts').upsert({
        user_id: userId,
        symbol: validatedFields.symbol,
        target_price: parseFloat(validatedFields.priceTarget),
        percentage_change: validatedFields.percentageChange
          ? parseFloat(validatedFields.percentageChange)
          : null,
        alert_above: validatedFields.alertAbove,
        alert_below: validatedFields.alertBelow,
      });

      if (priceError) throw priceError;
    }

    // Save social alerts with keyword parsing
    const { error: socialError } = await supabase.from('social_alerts').upsert({
      user_id: userId,
      account: validatedFields.accounts,
      keywords: validatedFields.keywords.split(',').map((k) => k.trim()),
      keyword_logic: 'AND', // Default to AND logic for multiple keywords
    });

    if (socialError) throw socialError;

    // Test call to verify phone number
    await makeCall({
      phone: validatedFields.phone,
      message:
        'Your alerts have been set up successfully. You will receive calls when your conditions are met.',
      retryCount: 3,
      retryDelay: 120000, // 2 minutes between retries
      isEmergency: false,
      shouldFallbackToSMS: true,
    });

    revalidatePath('/');
    return { success: true };
  } catch (error) {
    return { error: 'Failed to save alerts. Please try again.' };
  }
}

export async function monitorPrice(
  symbol: string,
  currentPrice: number,
  combinedAlert?: CombinedConditionAlert
) {
  try {
    const supabase = await createServerSupabaseClient();

    // Update price cache
    lastPrices.set(symbol, { price: currentPrice, timestamp: Date.now() });

    // Get all active alerts for this symbol
    const { data: alerts, error: alertError } = await supabase
      .from('price_alerts')
      .select('*, users!inner(*)')
      .eq('symbol', symbol)
      .eq('active', true);

    if (alertError) throw alertError;
    if (!alerts?.length) return;

    const percentageChange = calculatePercentageChange(symbol, currentPrice);

    for (const alert of alerts) {
      const user = alert.users as unknown as User;

      // Skip if in quiet hours
      if (isWithinQuietHours(user)) continue;

      // Skip if rate limited
      if (isRateLimited(user.id)) continue;

      let shouldAlert = false;
      let alertMessage = '';

      if (combinedAlert) {
        // Handle combined condition alert
        shouldAlert = true; // Already validated in exchanges.ts
        alertMessage = formatCombinedAlertMessage(combinedAlert);
      } else {
        // Check individual price conditions
        if (alert.condition_type === 'between' && alert.target_price_2) {
          if (currentPrice >= alert.target_price && currentPrice <= alert.target_price_2) {
            shouldAlert = true;
            alertMessage = `${symbol} is now between $${alert.target_price} and $${alert.target_price_2}`;
          }
        } else {
          if (alert.alert_above && currentPrice >= alert.target_price) {
            shouldAlert = true;
            alertMessage = `${symbol} has risen above $${alert.target_price}`;
          }
          if (alert.alert_below && currentPrice <= alert.target_price) {
            shouldAlert = true;
            alertMessage = `${symbol} has fallen below $${alert.target_price}`;
          }
        }

        // Check percentage change conditions
        if (!shouldAlert && alert.percentage_change && percentageChange) {
          const absPercentageChange = Math.abs(percentageChange);
          if (absPercentageChange >= Math.abs(alert.percentage_change)) {
            shouldAlert = true;
            const direction = percentageChange > 0 ? 'increased' : 'decreased';
            alertMessage = `${symbol} has ${direction} by ${absPercentageChange.toFixed(2)}%`;
          }
        }
      }

      if (shouldAlert) {
        try {
          // Add current price to message
          if (!combinedAlert) {
            alertMessage += ` (Current price: $${currentPrice})`;
          }

          let result;
          if (user.prefer_sms) {
            // Send SMS directly if user prefers it
            result = await sendSMS({
              phone: user.phone,
              message: alertMessage,
            });
          } else {
            // Make call with SMS fallback
            result = await makeCall({
              phone: user.phone,
              message: alertMessage,
              retryCount: 3,
              retryDelay: 30000,
              isEmergency: false,
              shouldFallbackToSMS: true,
            });
          }

          // Log the alert with enhanced details
          await supabase.from('alert_history').insert({
            user_id: user.id,
            alert_id: alert.id,
            alert_type: combinedAlert ? 'combined' : 'price',
            symbol,
            target_price: alert.target_price,
            triggered_price: currentPrice,
            percentage_change: percentageChange,
            notification_success: result.success,
            notification_type: result.fallbackToSMS ? 'sms' : 'call',
            combined_condition: combinedAlert ? JSON.stringify(combinedAlert.conditions) : null,
            combined_prices: combinedAlert ? JSON.stringify(combinedAlert.prices) : null,
          });

          // Update user's notification count
          await supabase
            .from('users')
            .update({
              last_notification_at: new Date().toISOString(),
              notification_count: alert.users.notification_count + 1,
            })
            .eq('id', user.id);

          // Deactivate one-time alerts
          if (alert.deactivate_after_trigger) {
            await supabase.from('price_alerts').update({ active: false }).eq('id', alert.id);
          }
        } catch (error) {
          console.error('Failed to process alert:', error);

          // Log failed notification
          await supabase.from('alert_history').insert({
            user_id: user.id,
            alert_id: alert.id,
            alert_type: combinedAlert ? 'combined' : 'price',
            symbol,
            target_price: alert.target_price,
            triggered_price: currentPrice,
            notification_success: false,
            error_message: error instanceof Error ? error.message : 'Unknown error',
          });
        }
      }
    }
  } catch (error) {
    console.error('Error monitoring price:', error);
  }
}

function formatCombinedAlertMessage(alert: CombinedConditionAlert): string {
  const conditions = alert.conditions.assets
    .map((asset) => {
      const priceInfo = alert.prices[asset.symbol];
      if (!priceInfo) return '';

      if (asset.isReference) {
        return `${asset.symbol} stayed within ${asset.percentageChange}% (${priceInfo.change?.toFixed(2)}%)`;
      } else {
        const direction = priceInfo.change && priceInfo.change > 0 ? '↗' : '↘';
        return `${asset.symbol} ${direction}${Math.abs(priceInfo.change || 0).toFixed(2)}%`;
      }
    })
    .filter(Boolean);

  const message = conditions.join(alert.conditions.logicOperator === 'AND' ? ' AND ' : ' OR ');

  // Add current prices
  const priceDetails = Object.entries(alert.prices)
    .map(([symbol, info]) => `${symbol}: $${info.price.toFixed(2)}`)
    .join(', ');

  return `Combined condition met: ${message}\n\nCurrent prices: ${priceDetails}`;
}

export async function monitorSocial(account: string, content: string) {
  try {
    const supabase = await createServerSupabaseClient();

    // Get active social alerts for this account
    const { data: alerts } = await supabase
      .from('social_alerts')
      .select('*')
      .eq('account', account)
      .eq('active', true);

    if (!alerts?.length) return;

    for (const alert of alerts) {
      const keywordsMatched = alert.keywords.filter((keyword: string) =>
        content.toLowerCase().includes(keyword.toLowerCase())
      );

      if (keywordsMatched.length > 0) {
        const message = `${account} posted: ${content}\nMatched keywords: ${keywordsMatched.join(', ')}`;

        if (alert.user.prefer_sms) {
          await sendSMS({
            phone: alert.user.phone,
            message,
          });
        } else {
          await makeCall({
            phone: alert.user.phone,
            message,
            retryCount: 3,
            retryDelay: 30000,
            isEmergency: false,
            shouldFallbackToSMS: true,
          });
        }
      }
    }
  } catch (error) {
    console.error('Error monitoring social:', error);
  }
}
