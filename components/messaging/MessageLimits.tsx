import { SETTINGS } from '@/actions/messaging/config';

interface MessageLimitsProps {
  remainingCalls: number;
  remainingSMS: number;
}

export function MessageLimits({ remainingCalls, remainingSMS }: MessageLimitsProps) {
  return (
    <div className="flex gap-4 text-sm text-muted-foreground">
      <div className="flex items-center gap-2">
        <span className="font-medium">Calls:</span>
        <span>{remainingCalls}/{SETTINGS.CALL.LIMITS.DAILY}</span>
      </div>
      <div className="flex items-center gap-2">
        <span className="font-medium">SMS:</span>
        <span>{remainingSMS}/{SETTINGS.SMS.LIMITS.DAILY}</span>
      </div>
    </div>
  );
} 