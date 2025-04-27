'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { sendTestNotification } from '../app/actions/notifications';
import { useToast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';

export function TelegramTestNotification() {
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const handleSendTestNotification = async () => {
    setIsLoading(true);
    try {
      const result = await sendTestNotification();

      if (result.success) {
        toast({
          title: 'Test notification sent',
          description: 'Check your Telegram app to see if you received the notification.',
        });
      } else {
        toast({
          title: 'Failed to send test notification',
          description: result.error || 'An unknown error occurred',
          variant: 'destructive',
        });
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'An unknown error occurred',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="mx-auto w-full max-w-md">
      <CardHeader>
        <CardTitle>Test Telegram Notification</CardTitle>
        <CardDescription>
          Send a test notification to your Telegram account to verify the integration is working.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground">
          This will send a test message to your connected Telegram account. Make sure you have
          connected your Telegram account in the settings before testing.
        </p>
      </CardContent>
      <CardFooter>
        <Button onClick={handleSendTestNotification} disabled={isLoading} className="w-full">
          {isLoading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Sending...
            </>
          ) : (
            'Send Test Notification'
          )}
        </Button>
      </CardFooter>
    </Card>
  );
}
