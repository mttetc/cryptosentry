export const TELEGRAM_CONFIG = {
  API_BASE: 'https://api.telegram.org/bot',
  WEBHOOK_BASE: 'https://api.telegram.org/bot',
  MAX_MESSAGE_LENGTH: 4096,
  SUPPORTED_PARSE_MODES: ['HTML', 'Markdown', 'MarkdownV2'] as const,
  VOICE_CHAT_TYPES: ['voice', 'video'] as const,
};
