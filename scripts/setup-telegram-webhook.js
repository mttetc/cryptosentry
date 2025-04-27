#!/usr/bin/env node

/**
 * This script sets up the Telegram webhook for the bot.
 * It should be run after deploying the application to production.
 *
 * Usage:
 * node scripts/setup-telegram-webhook.js
 */

require('dotenv').config();
const fetch = require('node-fetch');

async function setupWebhook() {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  const webhookUrl = process.env.TELEGRAM_WEBHOOK_URL;
  const webhookSecret = process.env.TELEGRAM_WEBHOOK_SECRET;

  if (!botToken || !webhookUrl || !webhookSecret) {
    console.error('Missing required environment variables:');
    if (!botToken) console.error('- TELEGRAM_BOT_TOKEN');
    if (!webhookUrl) console.error('- TELEGRAM_WEBHOOK_URL');
    if (!webhookSecret) console.error('- TELEGRAM_WEBHOOK_SECRET');
    process.exit(1);
  }

  try {
    console.log(`Setting up webhook for ${webhookUrl}...`);

    const response = await fetch(`https://api.telegram.org/bot${botToken}/setWebhook`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        url: webhookUrl,
        secret_token: webhookSecret,
        allowed_updates: ['message', 'callback_query'],
      }),
    });

    const data = await response.json();

    if (data.ok) {
      console.log('Webhook set up successfully!');
      console.log(`Webhook URL: ${data.result.url}`);
      console.log(`Has custom certificate: ${data.result.has_custom_certificate}`);
      console.log(`Pending update count: ${data.result.pending_update_count}`);
      console.log(`Max connections: ${data.result.max_connections}`);
      console.log(`IP address: ${data.result.ip_address}`);
    } else {
      console.error('Failed to set up webhook:', data.description);
    }
  } catch (error) {
    console.error('Error setting up webhook:', error);
  }
}

setupWebhook();
