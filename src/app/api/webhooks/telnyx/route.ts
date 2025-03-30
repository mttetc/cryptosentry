import { NextRequest, NextResponse } from 'next/server';
import { verifyWebhookSignature } from '@/actions/messaging/providers/telnyx';
import { TelnyxWebhookPayload } from '@/actions/messaging/types';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function validateAndParseWebhook(request: NextRequest) {
  const payload = await request.text();
  const signature = request.headers.get('telnyx-signature-ed25519') || '';
  const timestamp = request.headers.get('telnyx-timestamp') || '';

  if (!(await verifyWebhookSignature(signature, payload, timestamp))) {
    return { error: 'Invalid signature' };
  }

  return { data: JSON.parse(payload) as TelnyxWebhookPayload };
}

export async function POST(request: NextRequest) {
  try {
    const result = await validateAndParseWebhook(request);

    if ('error' in result) {
      return NextResponse.json({ error: result.error }, { status: 401 });
    }

    const data = result.data;
    const supabase = await createServerSupabaseClient();
    const userId = data.payload.custom_headers?.['X-User-ID'];

    if (!userId) {
      console.warn('Missing userId in webhook payload');
      return NextResponse.json({ success: true });
    }

    // Route based on event type
    if (data.event_type.startsWith('message.')) {
      await supabase.from('sms_analytics').insert({
        user_id: userId,
        message_id: data.call_control_id,
        event_type: data.event_type,
        direction: data.payload.direction,
        from: data.payload.from,
        to: data.payload.to,
        status: data.payload.state,
        cost: data.payload.cost,
        created_at: new Date().toISOString(),
      });
    } else if (data.event_type.startsWith('call.')) {
      await supabase.from('call_analytics').insert({
        user_id: userId,
        call_id: data.call_control_id,
        event_type: data.event_type,
        duration: data.payload.duration,
        direction: data.payload.direction,
        from: data.payload.from,
        to: data.payload.to,
        status: data.payload.state,
        result: data.payload.result,
        amd_result: data.payload.amd_result,
        cost: data.payload.cost,
        recorded: data.payload.recorded,
        created_at: new Date().toISOString(),
      });
    } else {
      console.warn('Unexpected event type:', data.event_type);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error handling webhook:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal Server Error' },
      { status: 500 }
    );
  }
}
