import { SETTINGS } from '@/lib/config/messaging';

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

  // Adjust speech rate based on recipient type
  const speechRate =
    recipientType === 'machine'
      ? SETTINGS.CALL.SPEECH.RATE * 0.8 // Slower for machines
      : recipientType === 'human_business'
        ? SETTINGS.CALL.SPEECH.RATE * 1.2 // Faster for business
        : SETTINGS.CALL.SPEECH.RATE; // Default for residential

  // Ensure proper SSML formatting with dynamic speech rate
  optimized = `<speak><prosody rate="${speechRate}">${optimized}</prosody></speak>`;

  return optimized;
}
