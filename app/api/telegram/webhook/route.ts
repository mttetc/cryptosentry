import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Verify webhook secret
const webhookSecret = process.env.TELEGRAM_WEBHOOK_SECRET;

export async function POST(request: NextRequest) {
  try {
    // Verify webhook secret if provided
    const secretToken = request.headers.get('x-telegram-bot-api-secret-token');
    if (webhookSecret && secretToken !== webhookSecret) {
      console.error('Invalid webhook secret token');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Parse the webhook update
    const update = await request.json();
    console.log('Received Telegram webhook update:', JSON.stringify(update, null, 2));

    // Handle message updates
    if (update.message) {
      const message = update.message;
      const chatId = message.chat.id;
      const text = message.text || '';

      console.log(`Received message from chat ${chatId}: ${text}`);

      // Check if this is a start command with a connection token
      if (text.startsWith('/start')) {
        const parts = text.split(' ');
        if (parts.length > 1 && parts[1].startsWith('connect_')) {
          const userId = parts[1].replace('connect_', '');
          console.log(`Connection request from user ${userId} for chat ${chatId}`);

          // Update user preferences with the Telegram chat ID
          const { data, error } = await supabase
            .from('user_notification_settings')
            .update({
              telegram_chat_id: chatId.toString(),
              telegram_setup_in_progress: false,
            })
            .eq('user_id', userId)
            .select();

          if (error) {
            console.error('Error updating user preferences:', error);
            return NextResponse.json(
              { error: 'Failed to update user preferences' },
              { status: 500 }
            );
          }

          console.log('User preferences updated successfully:', data);

          // Send confirmation message to the user
          await sendTelegramMessage(
            chatId,
            'Your Telegram account has been successfully connected to CryptoSentry! You will now receive notifications here.'
          );
        }
      }
    }

    // Handle callback queries (for inline keyboard buttons)
    if (update.callback_query) {
      const callbackQuery = update.callback_query;
      const data = callbackQuery.data;
      const chatId = callbackQuery.message.chat.id;

      console.log(`Received callback query from chat ${chatId}: ${data}`);

      // Process different callback data types
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
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Error processing webhook:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

async function sendTelegramMessage(chatId: number, text: string) {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;

  if (!botToken) {
    console.error('Missing required environment variable: TELEGRAM_BOT_TOKEN');
    return;
  }

  try {
    const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        chat_id: chatId,
        text: text,
      }),
    });

    const data = await response.json();

    if (data.ok) {
      console.log(`Message sent successfully to chat ${chatId}`);
    } else {
      console.error('Failed to send message:', data.description);
    }
  } catch (error) {
    console.error('Error sending message:', error);
  }
}

async function answerCallbackQuery(callbackQueryId: string) {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;

  if (!botToken) {
    console.error('Missing required environment variable: TELEGRAM_BOT_TOKEN');
    return;
  }

  try {
    const response = await fetch(`https://api.telegram.org/bot${botToken}/answerCallbackQuery`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        callback_query_id: callbackQueryId,
      }),
    });

    const data = await response.json();

    if (data.ok) {
      console.log(`Callback query ${callbackQueryId} answered successfully`);
    } else {
      console.error('Failed to answer callback query:', data.description);
    }
  } catch (error) {
    console.error('Error answering callback query:', error);
  }
}
