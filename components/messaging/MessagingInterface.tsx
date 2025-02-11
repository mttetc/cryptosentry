import { useState } from 'react';
import { MessageLimits } from './MessageLimits';
import { makeCall, sendSMS } from '@/actions/messaging';
import { useUser } from '@/hooks/use-user';

export function MessagingInterface() {
  const [remainingCalls, setRemainingCalls] = useState<number>(30); // Will be updated after each call
  const [remainingSMS, setRemainingSMS] = useState<number>(50); // Will be updated after each SMS
  const { user } = useUser();

  const handleSendMessage = async (message: string, type: 'call' | 'sms') => {
    if (!user?.id) return;

    try {
      if (type === 'call') {
        const result = await makeCall({ 
          userId: user.id,
          phone: '1234567890', 
          message 
        });
        if ('remainingCalls' in result && typeof result.remainingCalls === 'number') {
          setRemainingCalls(result.remainingCalls);
        }
      } else {
        const result = await sendSMS({ 
          userId: user.id,
          phone: '1234567890', 
          message 
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
      />
      {/* Your existing messaging interface components */}
    </div>
  );
} 