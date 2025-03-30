import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { SETTINGS } from '@/lib/config/messaging';

export const dynamic = 'force-dynamic';

interface UsageLimits {
  count: number;
  lastUsedAt: Date | null;
  remainingToday: number;
  isInCooldown: boolean;
  cooldownRemaining: number;
  isRateLimited: boolean;
  rateLimitReset: number;
  isBlocked: boolean;
  blockReason?: string;
  blockRemaining?: number;
  riskScore: number;
}

export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session?.user.id) {
      return new NextResponse(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
    }

    // Get parameters from query
    const { searchParams } = new URL(request.url);
    const phone = searchParams.get('phone');
    const type = searchParams.get('type') as 'call' | 'sms';

    if (!phone || !type || !['call', 'sms'].includes(type)) {
      return new NextResponse(JSON.stringify({ error: 'Missing or invalid parameters' }), {
        status: 400,
      });
    }

    const today = new Date().toISOString().split('T')[0];

    // Get security status first
    const { data: security } = await supabase
      .from('usage_limits')
      .select('blocked_until, block_reason, risk_score')
      .eq('user_id', session.user.id)
      .eq('phone_number', phone)
      .eq('date', today)
      .single();

    // Get or create today's usage record
    const { data: usage, error } = await supabase
      .from('usage_limits')
      .select('*')
      .eq('user_id', session.user.id)
      .eq('phone_number', phone)
      .eq('date', today)
      .single();

    if (error && error.code !== 'PGRST116') {
      // Not found error
      throw error;
    }

    let limits: UsageLimits;

    if (!usage) {
      // Create new usage record
      const { error: insertError } = await supabase
        .from('usage_limits')
        .insert({
          user_id: session.user.id,
          phone_number: phone,
          date: today,
          calls_last_minute: [],
          sms_last_minute: [],
          last_cleanup_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (insertError) throw insertError;

      limits = {
        count: 0,
        lastUsedAt: null,
        remainingToday: type === 'call' ? SETTINGS.CALL.LIMITS.DAILY : SETTINGS.SMS.LIMITS.DAILY,
        isInCooldown: false,
        cooldownRemaining: 0,
        isRateLimited: false,
        rateLimitReset: 0,
        isBlocked: false,
        riskScore: 0,
      };
    } else {
      const count = type === 'call' ? usage.call_count : usage.sms_count;
      const lastUsedAt = type === 'call' ? usage.last_call_at : usage.last_sms_at;
      const limit = type === 'call' ? SETTINGS.CALL.LIMITS.DAILY : SETTINGS.SMS.LIMITS.DAILY;
      const cooldownDuration =
        type === 'call' ? SETTINGS.CALL.COOLDOWN.DURATION : SETTINGS.SMS.COOLDOWN.DURATION;

      limits = {
        count,
        lastUsedAt,
        remainingToday: Math.max(0, limit - count),
        isInCooldown: lastUsedAt
          ? Date.now() - new Date(lastUsedAt).getTime() < cooldownDuration
          : false,
        cooldownRemaining: lastUsedAt
          ? Math.max(0, cooldownDuration - (Date.now() - new Date(lastUsedAt).getTime()))
          : 0,
        isRateLimited: false, // Implement rate limiting logic
        rateLimitReset: 0,
        isBlocked: security?.blocked_until
          ? new Date(security.blocked_until).getTime() > Date.now()
          : false,
        blockReason: security?.block_reason,
        blockRemaining: security?.blocked_until
          ? Math.max(0, new Date(security.blocked_until).getTime() - Date.now())
          : undefined,
        riskScore: security?.risk_score || 0,
      };
    }

    return new NextResponse(JSON.stringify(limits), {
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store, must-revalidate',
      },
    });
  } catch (error) {
    console.error('Error getting usage limits:', error);
    return new NextResponse(
      JSON.stringify({
        error: error instanceof Error ? error.message : 'Internal Server Error',
      }),
      { status: 500 }
    );
  }
}
