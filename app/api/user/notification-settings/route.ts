'use server';

import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export const runtime = 'edge';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session?.user.id) {
      return new NextResponse(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
    }

    const { data, error } = await supabase
      .from('user_notification_settings')
      .select('phone, prefer_sms, active_24h, quiet_hours_start, quiet_hours_end, weekends_enabled')
      .eq('user_id', session.user.id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        // Not found
        // Create default settings
        const defaultSettings = {
          user_id: session.user.id,
          phone: '',
          prefer_sms: false,
          active_24h: true,
          quiet_hours_start: null,
          quiet_hours_end: null,
          weekends_enabled: true,
        };

        const { error: insertError } = await supabase
          .from('user_notification_settings')
          .insert(defaultSettings);

        if (insertError) throw insertError;

        return new NextResponse(JSON.stringify(defaultSettings), {
          headers: {
            'Content-Type': 'application/json',
            'Cache-Control': 'no-store',
          },
        });
      }
      throw error;
    }

    return new NextResponse(JSON.stringify(data), {
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store',
      },
    });
  } catch (error) {
    console.error('Error fetching notification settings:', error);
    return new NextResponse(
      JSON.stringify({
        error: error instanceof Error ? error.message : 'Internal Server Error',
      }),
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session?.user.id) {
      return new NextResponse(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
    }

    const body = await request.json();

    // Validate phone number format
    if (body.phone && !/^\+?[1-9]\d{1,14}$/.test(body.phone)) {
      return new NextResponse(JSON.stringify({ error: 'Invalid phone number format' }), {
        status: 400,
      });
    }

    // Validate time format for quiet hours
    if (body.quiet_hours_start && !/^([01]\d|2[0-3]):([0-5]\d)$/.test(body.quiet_hours_start)) {
      return new NextResponse(JSON.stringify({ error: 'Invalid quiet hours start time format' }), {
        status: 400,
      });
    }

    if (body.quiet_hours_end && !/^([01]\d|2[0-3]):([0-5]\d)$/.test(body.quiet_hours_end)) {
      return new NextResponse(JSON.stringify({ error: 'Invalid quiet hours end time format' }), {
        status: 400,
      });
    }

    const { error } = await supabase.from('user_notification_settings').upsert({
      user_id: session.user.id,
      phone: body.phone,
      prefer_sms: Boolean(body.prefer_sms),
      active_24h: Boolean(body.active_24h),
      quiet_hours_start: body.quiet_hours_start || null,
      quiet_hours_end: body.quiet_hours_end || null,
      weekends_enabled: Boolean(body.weekends_enabled),
      updated_at: new Date().toISOString(),
    });

    if (error) throw error;

    return new NextResponse(JSON.stringify({ success: true }), {
      headers: {
        'Content-Type': 'application/json',
      },
    });
  } catch (error) {
    console.error('Error updating notification settings:', error);
    return new NextResponse(
      JSON.stringify({
        error: error instanceof Error ? error.message : 'Internal Server Error',
      }),
      { status: 500 }
    );
  }
}
