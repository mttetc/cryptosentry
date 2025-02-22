import { NextResponse } from 'next/server';
import { telnyxProvider } from '@/actions/messaging/providers/telnyx';

export const runtime = 'edge';

export async function POST() {
  try {
    if (!telnyxProvider.optimizePhoneNumberSettings) {
      return NextResponse.json({ error: 'Phone number optimization not supported' }, { status: 400 });
    }

    await telnyxProvider.optimizePhoneNumberSettings();
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error optimizing phone numbers:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to optimize phone numbers' },
      { status: 500 }
    );
  }
} 