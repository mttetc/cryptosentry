#!/usr/bin/env node

/**
 * This script processes incoming Telegram webhook updates.
 * It can be used to test webhook processing locally or as a reference for the server implementation.
 *
 * Usage:
 * node scripts/process-telegram-webhook.js <webhook-data-file>
 */

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing required environment variables:');
  if (!supabaseUrl) console.error('- NEXT_PUBLIC_SUPABASE_URL');
  if (!supabaseServiceKey) console.error('- SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function processWebhookUpdate(update) {
  console.log('Processing webhook update:', JSON.stringify(update, null, 2));

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
          return;
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
  }
}

async function sendTelegramMessage(chatId, text) {
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

async function main() {
  const webhookDataFile = process.argv[2];

  if (!webhookDataFile) {
    console.error('Please provide a webhook data file path');
    console.error('Usage: node scripts/process-telegram-webhook.js <webhook-data-file>');
    process.exit(1);
  }

  try {
    const webhookData = JSON.parse(fs.readFileSync(webhookDataFile, 'utf8'));
    await processWebhookUpdate(webhookData);
  } catch (error) {
    console.error('Error processing webhook data:', error);
  }
}

main();
