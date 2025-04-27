import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { verifyWebhookSignature } from '@/actions/messaging/providers/telegram';
import {
  extractUserFromTelegramMessage,
  sendTelegramMessage,
  answerCallbackQuery,
} from '@/actions/messaging/providers/telegram/telegram-utils';

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
    console.warn('Received Telegram update:', JSON.stringify(update, null, 2));

    // Handle callback queries (for inline keyboard buttons)
    if (update.callback_query) {
      const callbackQuery = update.callback_query;
      const data = callbackQuery.data;
      const chatId = callbackQuery.message.chat.id;

      console.warn(`Processing callback query from chat ${chatId}: ${data}`);

      if (data.startsWith('action_')) {
        const action = data.replace('action_', '');

        if (action === 'help') {
          await sendTelegramMessage(
            chatId,
            'CryptoSentry is a cryptocurrency monitoring service. You will receive alerts about significant price movements and other important events.'
          );
        }
      }

      // Answer the callback query to remove the loading state
      await answerCallbackQuery(callbackQuery.id);
      return NextResponse.json({ success: true });
    }

    // Handle regular messages
    const message = update.message;
    if (!message) {
      return NextResponse.json({ error: 'No message in update' }, { status: 400 });
    }

    // Extract user info from the message
    const userInfo = extractUserFromTelegramMessage(message);
    if (!userInfo) {
      return NextResponse.json({ error: 'Could not extract user info' }, { status: 400 });
    }

    console.warn(`Processing message from user ${userInfo.userId}: ${message.text}`);

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
      await sendTelegramMessage(
        userInfo.userId,
        '✅ Your Telegram account has been successfully connected! You will now receive notifications here.'
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error processing Telegram webhook:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
