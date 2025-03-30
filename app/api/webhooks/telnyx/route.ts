import { NextRequest, NextResponse } from 'next/server';
import { telnyxProvider } from '@/actions/messaging/providers/telnyx';
import { TelnyxWebhookPayload } from '@/actions/messaging/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function validateAndParseWebhook(request: NextRequest) {
  const payload = await request.text();
  const signature = request.headers.get('telnyx-signature-ed25519') || '';
  const timestamp = request.headers.get('telnyx-timestamp') || '';

  if (!telnyxProvider.validateWebhook(signature, payload, timestamp)) {
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

    // Route based on event type
    if (data.event_type.startsWith('message.')) {
      await telnyxProvider.handleSMSWebhook(data);
    } else if (data.event_type.startsWith('call.')) {
      await telnyxProvider.handleCallWebhook(data);
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
