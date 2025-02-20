'use server';

import { createServerSupabaseClient } from '@/lib/supabase';
import { revalidatePath } from 'next/cache';
import { experimental_taintObjectReference } from 'react';
import { makeCall, sendSMS } from '@/actions/messaging/providers/bulkvs';
import { z } from 'zod';

// Schemas
// ----------------------------------------

const priceAlertSchema = z.object({
  symbol: z.string().min(1).toUpperCase(),
  targetPrice: z.number().positive(),
});

const socialAlertSchema = z.object({
  account: z.string().min(1).toLowerCase().transform(val => val.replace('@', '')),
  keywords: z.array(z.string().min(1)),
});

// Types
// ----------------------------------------

export type AlertCondition = 'above' | 'below' | 'between' | 'change';
export type LogicOperator = 'AND' | 'OR';

export interface AssetCondition {
  symbol: string;
  condition: AlertCondition;
  value: number;
  value2?: number;
  percentageChange?: number;
  isReference?: boolean;
}

export interface CombinedCondition {
  type: 'combined';
  conditions: {
    assets: AssetCondition[];
    logicOperator: LogicOperator;
  };
  prices: Record<string, { price: number; change?: number }>;
}

export interface AlertFormState {
  error: string;
  success: boolean;
}

// Form State
// ----------------------------------------

export const initialAlertState: AlertFormState = {
  error: '',
  success: false,
};

// Alert Creation
// ----------------------------------------

export async function createPriceAlert(input: z.infer<typeof priceAlertSchema>) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { session } } = await supabase.auth.getSession();

    if (!session?.user.id) {
      throw new Error('Unauthorized');
    }

    // Validate input
    const validated = priceAlertSchema.parse(input);

    // Create alert
    const { data, error } = await supabase
      .from('price_alerts')
      .insert({
        user_id: session.user.id,
        symbol: validated.symbol,
        target_price: validated.targetPrice,
        active: true,
      })
      .select()
      .single();

    if (error) throw error;

    experimental_taintObjectReference(
      'Do not pass raw alert data to client',
      data
    );

    revalidatePath('/dashboard');
    return { success: true };
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new Error('Invalid input: ' + error.errors[0].message);
    }
    console.error('Failed to create price alert:', error);
    throw error;
  }
}

export async function createSocialAlert(input: z.infer<typeof socialAlertSchema>) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { session } } = await supabase.auth.getSession();

    if (!session?.user.id) {
      throw new Error('Unauthorized');
    }

    // Validate input
    const validated = socialAlertSchema.parse(input);

    // Create alert
    const { data, error } = await supabase
      .from('social_alerts')
      .insert({
        user_id: session.user.id,
        account: validated.account,
        keywords: validated.keywords,
        active: true,
      })
      .select()
      .single();

    if (error) throw error;

    experimental_taintObjectReference(
      'Do not pass raw alert data to client',
      data
    );

    revalidatePath('/dashboard');
    return { success: true };
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new Error('Invalid input: ' + error.errors[0].message);
    }
    console.error('Failed to create social alert:', error);
    throw error;
  }
}

// Form Actions
// ----------------------------------------

export async function createPriceAlertAction(
  state: AlertFormState, 
  formData: FormData
): Promise<AlertFormState> {
  try {
    const symbol = formData.get('symbol');
    const targetPrice = formData.get('targetPrice');

    if (!symbol || !targetPrice) {
      return { error: 'Please fill in all fields', success: false };
    }

    const price = parseFloat(String(targetPrice));
    if (isNaN(price) || price <= 0) {
      return { error: 'Invalid price value', success: false };
    }

    await createPriceAlert({ 
      symbol: String(symbol).toUpperCase(), 
      targetPrice: price
    });
    
    return { success: true, error: '' };
  } catch (err) {
    return { 
      error: err instanceof Error ? err.message : 'Failed to create price alert',
      success: false 
    };
  }
}

export async function createSocialAlertAction(
  state: AlertFormState, 
  formData: FormData
): Promise<AlertFormState> {
  try {
    const account = formData.get('account');
    const keywords = formData.get('keywords');

    if (!account || !keywords) {
      return { error: 'Please fill in all fields', success: false };
    }

    const cleanedKeywords = String(keywords)
      .split(',')
      .map(k => k.trim())
      .filter(Boolean);

    if (cleanedKeywords.length === 0) {
      return { error: 'Please provide at least one keyword', success: false };
    }

    await createSocialAlert({ 
      account: String(account).toLowerCase().replace(/^@/, ''),
      keywords: cleanedKeywords
    });
    
    return { success: true, error: '' };
  } catch (err) {
    return { 
      error: err instanceof Error ? err.message : 'Failed to create social alert',
      success: false 
    };
  }
}

// Alert Monitoring
// ----------------------------------------

export async function monitorPrice(
  symbol: string, 
  currentPrice: number,
  combinedCondition?: CombinedCondition
) {
  try {
    if (!symbol || typeof currentPrice !== 'number' || currentPrice <= 0) {
      throw new Error('Invalid price monitoring parameters');
    }

    const supabase = await createServerSupabaseClient();
    
    // Get active alerts first
    const { data: alerts, error: alertsError } = await supabase
      .from('price_alerts')
      .select('id, target_price, user_id')
      .eq('symbol', symbol.toUpperCase())
      .eq('active', true);

    if (alertsError) throw alertsError;
    if (!alerts?.length) return { success: true };

    // Only update price if we have active alerts
    const { error: priceError } = await supabase
      .from('latest_prices')
      .upsert({
        symbol: symbol.toUpperCase(),
        price: currentPrice,
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'symbol',
      });

    if (priceError) throw priceError;

    // Process each alert
    for (const alert of alerts) {
      if (currentPrice >= alert.target_price) {
        try {
          // Get user notification preferences separately
          const { data: userPrefs, error: prefsError } = await supabase
            .from('user_notification_settings')
            .select('phone, prefer_sms')
            .eq('user_id', alert.user_id)
            .single();

          if (prefsError) {
            console.error('Failed to get user preferences:', prefsError);
            continue;
          }
          if (!userPrefs?.phone) continue;

          let message: string;
          
          if (combinedCondition) {
            const conditions = combinedCondition.conditions.assets
              .map((asset) => {
                const priceInfo = combinedCondition.prices[asset.symbol];
                if (!priceInfo?.price) return '';

                if (asset.isReference && typeof asset.percentageChange === 'number') {
                  return `${asset.symbol} stayed within ${asset.percentageChange}% (${priceInfo.change?.toFixed(2)}%)`;
                } else {
                  const direction = (priceInfo.change ?? 0) > 0 ? '↗' : '↘';
                  return `${asset.symbol} ${direction}${Math.abs(priceInfo.change ?? 0).toFixed(2)}%`;
                }
              })
              .filter(Boolean);

            const conditionMessage = conditions.join(
              combinedCondition.conditions.logicOperator === 'AND' ? ' AND ' : ' OR '
            );

            message = `Combined condition met: ${conditionMessage}`;
          } else {
            message = `${symbol} has reached your target price of $${alert.target_price}. Current price: $${currentPrice}`;
          }

          // Use the user's preferred notification method
          if (userPrefs.prefer_sms) {
            await sendSMS({
              userId: alert.user_id,
              phone: userPrefs.phone,
              message,
              isEmergency: false,
              bypassLimits: false,
            });
          } else {
            await makeCall({
              userId: alert.user_id,
              phone: userPrefs.phone,
              message,
              isEmergency: false,
              bypassDailyLimit: false,
              shouldFallbackToSMS: true,
              retryCount: 3,
              retryDelay: 30000,
            });
          }

          // Update alert status with trigger information
          const { error: updateError } = await supabase
            .from('price_alerts')
            .update({ 
              active: false,
              triggered_at: new Date().toISOString(),
              triggered_price: currentPrice
            })
            .eq('id', alert.id);

          if (updateError) throw updateError;

          // Log minimal alert history
          const { error: historyError } = await supabase
            .from('alert_history')
            .insert({
              alert_id: alert.id,
              alert_type: combinedCondition ? 'combined' : 'price',
              symbol,
              triggered_price: currentPrice,
              condition_type: combinedCondition ? combinedCondition.conditions.logicOperator : 'single',
              assets_involved: combinedCondition 
                ? combinedCondition.conditions.assets.map(a => a.symbol)
                : [symbol]
            });

          if (historyError) throw historyError;

          revalidatePath('/dashboard');
        } catch (error) {
          console.error('Failed to process price alert:', error);
          // Continue processing other alerts even if one fails
          continue;
        }
      }
    }

    return { success: true };
  } catch (error) {
    console.error('Error monitoring price:', error);
    return { 
      success: false,
      error: error instanceof Error ? error.message : 'Failed to monitor price'
    };
  }
}

export async function monitorSocial(account: string, content: string) {
  const supabase = await createServerSupabaseClient();
  
  // Get all active alerts for this account
  const { data: alerts } = await supabase
    .from('social_alerts')
    .select('*, users!inner(id, phone, prefer_sms)')
    .eq('account', account)
    .eq('active', true);

  if (!alerts?.length) return;

  // Check each alert
  for (const alert of alerts) {
    const matchedKeywords = alert.keywords.filter((keyword: string) => 
      content.toLowerCase().includes(keyword.toLowerCase())
    );

    if (matchedKeywords.length > 0) {
      try {
        const message = `New post from ${account} matches your keywords: ${matchedKeywords.join(', ')}. Content: ${content.slice(0, 200)}${content.length > 200 ? '...' : ''}`;

        // Use the user's preferred notification method
        if (alert.users.prefer_sms) {
          await sendSMS({
            userId: alert.users.id,
            phone: alert.users.phone,
            message,
            isEmergency: false,
            bypassLimits: false,
          });
        } else {
          await makeCall({
            userId: alert.users.id,
            phone: alert.users.phone,
            message,
            isEmergency: false,
            bypassDailyLimit: false,
            shouldFallbackToSMS: true,
            retryCount: 3,
            retryDelay: 30000,
          });
        }

        // Deactivate alert after successful notification
        await supabase
          .from('social_alerts')
          .update({ active: false })
          .eq('id', alert.id);

        // Log the alert trigger
        await supabase.from('alert_history').insert({
          user_id: alert.users.id,
          alert_id: alert.id,
          alert_type: 'social',
          account,
          matched_keywords: matchedKeywords,
          content: content.slice(0, 500), // Store truncated content
        });

        revalidatePath('/dashboard');
      } catch (error) {
        console.error('Failed to process social alert:', error);
      }
    }
  }
}
