#!/usr/bin/env node

/**
 * This script deletes the Telegram webhook.
 *
 * Usage:
 * node scripts/delete-telegram-webhook.js
 */

require('dotenv').config();
const fetch = require('node-fetch');

async function deleteWebhook() {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;

  if (!botToken) {
    console.error('Missing required environment variable: TELEGRAM_BOT_TOKEN');
    process.exit(1);
  }

  try {
    console.warn('Deleting webhook...');

    const response = await fetch(`https://api.telegram.org/bot${botToken}/deleteWebhook`);

    const data = await response.json();

    if (data.ok) {
      console.warn('Webhook deleted successfully');
    } else {
      console.error('Failed to delete webhook:', data.description);
    }
  } catch (error) {
    console.error('Error deleting webhook:', error);
  }
}

deleteWebhook();
