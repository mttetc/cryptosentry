'use server';

import { TELEGRAM_CONFIG } from './telegram-config';

/**
 * Optimizes a message for Telegram by truncating it if necessary
 * and ensuring it's properly formatted for the Telegram API.
 */
export function optimizeTelegramMessage(message: string): string {
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
export function formatPhoneNumberForTelegram(phone: string): string {
  // Remove any non-digit characters
  const digitsOnly = phone.replace(/\D/g, '');

  // Ensure it starts with +
  return digitsOnly.startsWith('+') ? digitsOnly : `+${digitsOnly}`;
}

/**
 * Extracts user information from a Telegram message
 */
export function extractUserFromTelegramMessage(
  message: any
): { userId: string; username?: string } | null {
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
export function generateTelegramDeepLink(
  botUsername: string,
  command: string,
  params?: Record<string, string>
): string {
  let deepLink = `https://t.me/${botUsername}?start=${command}`;

  if (params) {
    const queryParams = new URLSearchParams(params);
    deepLink += `_${queryParams.toString()}`;
  }

  return deepLink;
}
