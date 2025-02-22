import { NextResponse } from 'next/server';
import { telnyxProvider } from '@/actions/messaging/providers/telnyx';

export const runtime = 'edge';

export async function POST() {
  try {
    const response = await fetch(`${process.env.TELNYX_API_BASE}/messaging_profiles`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.TELNYX_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        name: 'Default Messaging Profile',
        enabled: true,
        webhook_url: process.env.TELNYX_WEBHOOK_URL,
        webhook_failover_url: process.env.TELNYX_WEBHOOK_FAILOVER_URL,
        url_shortener_settings: {
          provider: 'tinyurl',
          domain: null,
          replace_url_in_message: true
        },
        number_pool_settings: {
          sticky_sender: true,
          geomatch: true,
          skip_unhealthy: true
        },
        whitelisted_destinations: ['US', 'CA', 'FR', 'CN'],
        v1_secret: process.env.TELNYX_PUBLIC_KEY
      })
    });

    if (!response.ok) {
      throw new Error('Failed to create messaging profile');
    }

    const data = await response.json();
    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error('Error setting up messaging profile:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to setup messaging profile' },
      { status: 500 }
    );
  }
} 