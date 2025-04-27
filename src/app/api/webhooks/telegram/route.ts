import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { verifyWebhookSignature } from '@/actions/messaging/providers/telegram';
import { extractUserFromTelegramMessage } from '@/actions/messaging/providers/telegram/telegram-utils';

export async function POST(request: Request) {
  try {
    const signature = request.headers.get('x-telegram-bot-api-secret-token');
    const timestamp = request.headers.get('x-telegram-bot-api-timestamp');

    if (!signature || !timestamp) {
      return NextResponse.json({ error: 'Missing signature or timestamp' }, { status: 400 });
    }

    const payload = await request.text();
    const isValid = await verifyWebhookSignature(payload, signature, timestamp);

    if (!isValid) {
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
    }

    const update = JSON.parse(payload);
    const message = update.message;

    if (!message) {
      return NextResponse.json({ error: 'No message in update' }, { status: 400 });
    }

    // Extract user info from the message
    const userInfo = extractUserFromTelegramMessage(message);
    if (!userInfo) {
      return NextResponse.json({ error: 'Could not extract user info' }, { status: 400 });
    }

    // Handle /start command with connect parameter
    if (message.text?.startsWith('/start connect_')) {
      const userId = message.text.split('connect_')[1];
      const supabase = await createServerSupabaseClient();

      // Update user preferences with Telegram chat ID
      const { error } = await supabase
        .from('user_notification_settings')
        .update({
          telegram_chat_id: userInfo.userId,
          telegram_setup_in_progress: false,
        })
        .eq('user_id', userId);

      if (error) {
        console.error('Failed to update user preferences:', error);
        return NextResponse.json({ error: 'Failed to update user preferences' }, { status: 500 });
      }

      // Send confirmation message to user
      const response = await fetch(
        `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            chat_id: userInfo.userId,
            text: '✅ Your Telegram account has been successfully connected! You will now receive notifications here.',
          }),
        }
      );

      if (!response.ok) {
        console.error('Failed to send confirmation message:', await response.text());
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error processing Telegram webhook:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
