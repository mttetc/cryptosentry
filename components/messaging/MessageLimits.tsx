interface MessageLimitsProps {
  remainingCalls: number;
  remainingSMS: number;
  dailyCallLimit: number;
  dailySMSLimit: number;
}

export function MessageLimits({
  remainingCalls,
  remainingSMS,
  dailyCallLimit,
  dailySMSLimit,
}: MessageLimitsProps) {
  return (
    <div className="flex gap-4">
      <div className="rounded-lg border bg-background p-4">
        <h3 className="font-medium">Remaining Calls</h3>
        <p className="text-2xl font-bold">
          {remainingCalls}/{dailyCallLimit}
        </p>
      </div>
      <div className="rounded-lg border bg-background p-4">
        <h3 className="font-medium">Remaining SMS</h3>
        <p className="text-2xl font-bold">
          {remainingSMS}/{dailySMSLimit}
        </p>
      </div>
    </div>
  );
}
