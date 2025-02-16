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

type PriceAlert = {
  id: string;
  user_id: string;
  symbol: string;
  target_price: number;
  active: boolean;
  created_at: string;
  users?: {
    id: string;
    phone: string;
    prefer_sms: boolean;
  };
};

type SocialAlert = {
  id: string;
  user_id: string;
  account: string;
  keywords: string[];
  active: boolean;
  created_at: string;
  users?: {
    id: string;
    phone: string;
    prefer_sms: boolean;
  };
};

export type AlertFormState = {
  error: string;
  success: boolean;
};

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

    await createPriceAlert({ 
      symbol: String(symbol), 
      targetPrice: parseFloat(String(targetPrice)) 
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

    await createSocialAlert({ 
      account: String(account),
      keywords: String(keywords)
        .split(',')
        .map(k => k.trim())
        .filter(Boolean)
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
  combinedCondition?: {
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
    prices: Record<string, { price: number; change?: number }>;
  }
) {
  const supabase = await createServerSupabaseClient();
  
  // Get all active alerts for this symbol
  const { data: alerts } = await supabase
    .from('price_alerts')
    .select('*, users!inner(id, phone, prefer_sms)')
    .eq('symbol', symbol)
    .eq('active', true);

  if (!alerts?.length) return;

  // Check each alert
  for (const alert of alerts) {
    if (currentPrice >= alert.target_price) {
      try {
        let message: string;
        
        if (combinedCondition) {
          const conditions = combinedCondition.conditions.assets
            .map((asset) => {
              const priceInfo = combinedCondition.prices[asset.symbol];
              if (!priceInfo) return '';

              if (asset.isReference) {
                return `${asset.symbol} stayed within ${asset.percentageChange}% (${priceInfo.change?.toFixed(2)}%)`;
              } else {
                const direction = priceInfo.change && priceInfo.change > 0 ? '↗' : '↘';
                return `${asset.symbol} ${direction}${Math.abs(priceInfo.change || 0).toFixed(2)}%`;
              }
            })
            .filter(Boolean);

          const conditionMessage = conditions.join(
            combinedCondition.conditions.logicOperator === 'AND' ? ' AND ' : ' OR '
          );

          const priceDetails = Object.entries(combinedCondition.prices)
            .map(([sym, info]) => `${sym}: $${info.price.toFixed(2)}`)
            .join(', ');

          message = `Combined condition met: ${conditionMessage}\n\nCurrent prices: ${priceDetails}`;
        } else {
          message = `${symbol} has reached your target price of $${alert.target_price}. Current price: $${currentPrice}`;
        }

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
          .from('price_alerts')
          .update({ active: false })
          .eq('id', alert.id);

        // Log the alert trigger
        await supabase.from('alert_history').insert({
          user_id: alert.users.id,
          alert_id: alert.id,
          alert_type: combinedCondition ? 'combined' : 'price',
          symbol,
          triggered_price: currentPrice,
          target_price: alert.target_price,
          combined_condition: combinedCondition ? JSON.stringify(combinedCondition.conditions) : null,
          combined_prices: combinedCondition ? JSON.stringify(combinedCondition.prices) : null,
        });

        revalidatePath('/dashboard');
      } catch (error) {
        console.error('Failed to process price alert:', error);
      }
    }
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
