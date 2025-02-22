import { NextResponse } from 'next/server';
import { telnyxProvider } from '@/actions/messaging/providers/telnyx';

export const runtime = 'edge';

export async function POST() {
  try {
    if (!telnyxProvider.setupDefaultOutboundVoiceProfile) {
      return NextResponse.json({ error: 'Profile setup not supported' }, { status: 400 });
    }
    await telnyxProvider.setupDefaultOutboundVoiceProfile();
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error setting up voice profile:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to setup voice profile' },
      { status: 500 }
    );
  }
} 