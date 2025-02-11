import { SETTINGS } from '@/actions/bulkvs';

interface MessageLimitsProps {
  remainingCalls: number;
  remainingSMS: number;
}

export function MessageLimits({ remainingCalls, remainingSMS }: MessageLimitsProps) {
  return (
    <div className="flex gap-4 text-sm text-muted-foreground">
      <div className="flex items-center gap-2">
        <span className="font-medium">Calls:</span>
        <span>{remainingCalls}/{SETTINGS.CALL.DAILY_LIMIT}</span>
      </div>
      <div className="flex items-center gap-2">
        <span className="font-medium">SMS:</span>
        <span>{remainingSMS}/{SETTINGS.SMS.DAILY_LIMIT}</span>
      </div>
    </div>
  );
} 