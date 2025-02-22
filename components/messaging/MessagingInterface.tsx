import { useState } from 'react';
import { MessageLimits } from './MessageLimits';
import { telnyxProvider } from '@/actions/messaging/providers/telnyx';
import { useUser } from '@/hooks/use-user';
import { SETTINGS } from '@/actions/messaging/config';

export function MessagingInterface() {
  const [remainingCalls, setRemainingCalls] = useState<number>(SETTINGS.CALL.LIMITS.DAILY);
  const [remainingSMS, setRemainingSMS] = useState<number>(SETTINGS.SMS.LIMITS.DAILY);
  const { user } = useUser();

  const handleSendMessage = async (message: string, type: 'call' | 'sms') => {
    if (!user?.id) return;

    try {
      if (type === 'call' && remainingCalls > 0) {
        const result = await telnyxProvider.makeCall({ 
          userId: user.id,
          phone: '1234567890', 
          message,
          recipientType: 'human_residence',
          amdConfig: {
            totalAnalysisTimeMillis: SETTINGS.CALL.AMD.DEFAULT_CONFIG.TOTAL_ANALYSIS_TIME,
            afterGreetingSilenceMillis: SETTINGS.CALL.AMD.DEFAULT_CONFIG.AFTER_GREETING_SILENCE,
            betweenWordsSilenceMillis: SETTINGS.CALL.AMD.DEFAULT_CONFIG.BETWEEN_WORDS_SILENCE,
            greetingDurationMillis: SETTINGS.CALL.AMD.DEFAULT_CONFIG.GREETING_DURATION,
            initialSilenceMillis: SETTINGS.CALL.AMD.DEFAULT_CONFIG.INITIAL_SILENCE,
            maximumNumberOfWords: SETTINGS.CALL.AMD.DEFAULT_CONFIG.MAX_WORDS,
            maximumWordLengthMillis: SETTINGS.CALL.AMD.DEFAULT_CONFIG.MAX_WORD_LENGTH,
            silenceThreshold: SETTINGS.CALL.AMD.DEFAULT_CONFIG.SILENCE_THRESHOLD,
            greetingTotalAnalysisTimeMillis: SETTINGS.CALL.AMD.DEFAULT_CONFIG.GREETING_TOTAL_ANALYSIS_TIME,
            greetingSilenceDurationMillis: SETTINGS.CALL.AMD.DEFAULT_CONFIG.GREETING_SILENCE_DURATION
          }
        });
        if ('remainingCalls' in result && typeof result.remainingCalls === 'number') {
          setRemainingCalls(result.remainingCalls);
        }
      } else if (type === 'sms' && remainingSMS > 0) {
        const result = await telnyxProvider.sendSMS({ 
          userId: user.id,
          phone: '1234567890', 
          message: message.slice(0, SETTINGS.SMS.MESSAGE.MAX_LENGTH)
        });
        if ('remainingSMS' in result && typeof result.remainingSMS === 'number') {
          setRemainingSMS(result.remainingSMS);
        }
      }
    } catch (error) {
      console.error('Error sending message:', error);
    }
  };

  return (
    <div className="space-y-4">
      <MessageLimits 
        remainingCalls={remainingCalls}
        remainingSMS={remainingSMS}
        dailyCallLimit={SETTINGS.CALL.LIMITS.DAILY}
        dailySMSLimit={SETTINGS.SMS.LIMITS.DAILY}
      />
      {/* Your existing messaging interface components */}
    </div>
  );
} 