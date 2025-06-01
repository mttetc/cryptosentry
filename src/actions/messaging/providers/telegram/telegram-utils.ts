'use server';

import { TELEGRAM_CONFIG } from './telegram-config';

/**
 * Optimizes a message for Telegram by truncating it if necessary
 * and ensuring it's properly formatted for the Telegram API.
 */
export async function optimizeTelegramMessage(message: string): Promise<string> {
  // Truncate message if it exceeds Telegram's maximum length
  if (message.length > TELEGRAM_CONFIG.MAX_MESSAGE_LENGTH) {
    return message.substring(0, TELEGRAM_CONFIG.MAX_MESSAGE_LENGTH - 3) + '...';
  }

  // Escape special characters for MarkdownV2 format if needed
  // This is a simple implementation and might need to be enhanced
  // based on the specific formatting requirements
  return message;
}

/**
 * Formats a phone number for Telegram API
 * Telegram doesn't require a specific format for phone numbers,
 * but we'll standardize it to E.164 format for consistency
 */
export async function formatPhoneNumberForTelegram(phone: string): Promise<string> {
  // Remove any non-digit characters
  const digitsOnly = phone.replace(/\D/g, '');

  // Ensure it starts with +
  return digitsOnly.startsWith('+') ? digitsOnly : `+${digitsOnly}`;
}

/**
 * Extracts user information from a Telegram message
 */
export async function extractUserFromTelegramMessage(
  message: any
): Promise<{ userId: string; username?: string } | null> {
  if (!message || !message.from) {
    return null;
  }

  return {
    userId: message.from.id.toString(),
    username: message.from.username,
  };
}

/**
 * Generates a deep link for a Telegram bot
 */
export async function generateTelegramDeepLink(
  botUsername: string,
  command: string,
  params?: Record<string, string>
): Promise<string> {
  let deepLink = `https://t.me/${botUsername}?start=${command}`;

  if (params) {
    const queryParams = new URLSearchParams(params);
    deepLink += `_${queryParams.toString()}`;
  }

  return deepLink;
}

/**
 * Sends a message to a Telegram chat
 */
export async function sendTelegramMessage(chatId: string, text: string): Promise<void> {
  const response = await fetch(
    `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        chat_id: chatId,
        text: optimizeTelegramMessage(text),
      }),
    }
  );

  if (!response.ok) {
    console.error('Failed to send Telegram message:', await response.text());
  }
}

/**
 * Answers a callback query to remove the loading state
 */
export async function answerCallbackQuery(callbackQueryId: string): Promise<void> {
  const response = await fetch(
    `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/answerCallbackQuery`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        callback_query_id: callbackQueryId,
      }),
    }
  );

  if (!response.ok) {
    console.error('Failed to answer callback query:', await response.text());
  }
}
