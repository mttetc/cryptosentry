import { SETTINGS } from '@/config/messaging';

export function optimizeMessage(
  message: string,
  recipientType?: 'human_residence' | 'human_business' | 'machine'
): string {
  let optimized = message;

  // Format crypto alerts
  optimized = optimized.replace(/(\w+) price (\w+) \$?([\d,.]+)/gi, '$1 is now $3 dollars');

  // Format social alerts
  optimized = optimized.replace(/@(\w+) posted: (.*)/gi, '$1 just posted: $2');

  // Add pauses between different alerts
  optimized = optimized.replace(/\. /g, '. <break time="0.8s"/> ');

  // Ensure proper SSML formatting
  optimized = `<speak><prosody rate="${SETTINGS.CALL.SPEECH.RATE}">${optimized}</prosody></speak>`;

  return optimized;
}
