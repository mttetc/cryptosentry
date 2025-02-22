import { NextResponse } from 'next/server';
import { telnyxProvider } from '@/actions/messaging/providers/telnyx';

export const runtime = 'edge';

export async function POST() {
  try {
    const result = await telnyxProvider.makeCall({
      userId: 'test-user',
      phone: '+33659525364',
      message: 'This is a test call from your crypto alert system.',
      recipientType: 'human_residence',
      amdConfig: {
        totalAnalysisTimeMillis: 5000,
        afterGreetingSilenceMillis: 800,
        betweenWordsSilenceMillis: 500,
        greetingDurationMillis: 3500,
        initialSilenceMillis: 3000,
        maximumNumberOfWords: 5,
        maximumWordLengthMillis: 3000,
        silenceThreshold: 500,
        greetingTotalAnalysisTimeMillis: 5000,
        greetingSilenceDurationMillis: 1500
      }
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error making test call:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to make test call' },
      { status: 500 }
    );
  }
} 