import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { sendDirectMessage } from '@/actions/messaging/lib/direct-messaging';
import type { NotificationPayload } from '@/actions/messaging/types';

export const runtime = 'edge';
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session?.user.id) {
      return new NextResponse(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
    }

    const body = await request.json();
    const { type, phone, message } = body;

    if (!type || !phone || !message) {
      return new NextResponse(JSON.stringify({ error: 'Missing required fields' }), {
        status: 400,
      });
    }

    // Validate notification type
    if (!['sms', 'call', 'both'].includes(type)) {
      return new NextResponse(JSON.stringify({ error: 'Invalid notification type' }), {
        status: 400,
      });
    }

    const result = await sendDirectMessage({
      userId: session.user.id,
      message,
      type,
    });

    if (result.error) {
      return new NextResponse(JSON.stringify({ error: result.error }), { status: 400 });
    }

    // Store message in history
    await supabase.from('message_history').insert({
      user_id: session.user.id,
      type,
      phone,
      message,
      status: 'sent',
      sms_message_id: result.smsMessageId,
      call_id: result.callId,
    });

    return new NextResponse(
      JSON.stringify({
        success: true,
        smsMessageId: result.smsMessageId,
        callId: result.callId,
      }),
      {
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );
  } catch (error) {
    console.error('Error sending message:', error);
    return new NextResponse(
      JSON.stringify({
        error: error instanceof Error ? error.message : 'Internal Server Error',
      }),
      { status: 500 }
    );
  }
}
