#!/usr/bin/env node

/**
 * This script checks the status of the Telegram webhook.
 *
 * Usage:
 * node scripts/check-telegram-webhook.js
 */

require('dotenv').config();
const fetch = require('node-fetch');

async function checkWebhook() {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;

  if (!botToken) {
    console.error('Missing required environment variable: TELEGRAM_BOT_TOKEN');
    process.exit(1);
  }

  try {
    console.warn('Checking webhook status...');

    const response = await fetch(`https://api.telegram.org/bot${botToken}/getWebhookInfo`);

    const data = await response.json();

    if (data.ok) {
      const info = data.result;
      console.warn('Webhook status:');
      console.warn(`URL: ${info.url || 'Not set'}`);
      console.warn(`Has custom certificate: ${info.has_custom_certificate}`);
      console.warn(`Pending update count: ${info.pending_update_count}`);
      console.warn(`Max connections: ${info.max_connections}`);
      console.warn(`IP address: ${info.ip_address}`);
      console.warn(
        `Last error date: ${info.last_error_date ? new Date(info.last_error_date * 1000).toISOString() : 'None'}`
      );
      console.warn(`Last error message: ${info.last_error_message || 'None'}`);
    } else {
      console.error('Failed to get webhook info:', data.description);
    }
  } catch (error) {
    console.error('Error checking webhook:', error);
  }
}

checkWebhook();
