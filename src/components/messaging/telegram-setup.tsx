'use client';

import { useState, useEffect } from 'react';
import { useUser } from '@/hooks/use-user';
import { useToast } from '@/hooks/use-toast';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { MessageCircle } from 'lucide-react';
import { updateUserPreferences } from '@/actions/user/lib/core';
import { getUserPreferences } from '@/actions/user/lib/core';

export function TelegramSetup() {
  const [isLoading, setIsLoading] = useState(false);
  const [preferences, setPreferences] = useState<any>(null);
  const { user } = useUser();
  const { toast } = useToast();

  // Fetch user preferences on component mount
  useEffect(() => {
    const fetchPreferences = async () => {
      if (user?.id) {
        const prefs = await getUserPreferences();
        setPreferences(prefs);
      }
    };

    fetchPreferences();
  }, [user?.id]);

  const handleTelegramSetup = async () => {
    if (!user?.id) {
      toast({
        title: 'Error',
        description: 'You must be logged in to set up Telegram',
        variant: 'destructive',
      });
      return;
    }

    try {
      setIsLoading(true);

      // Generate a unique deep link for the user
      const deepLink = `https://t.me/${process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME}?start=connect_${user.id}`;

      // Open the Telegram bot in a new window
      window.open(deepLink, '_blank');

      // Update user preferences to indicate Telegram setup is in progress
      const updatedPrefs = await updateUserPreferences({
        phone: preferences?.phone || '',
        prefer_sms: preferences?.prefer_sms || false,
        active_24h: preferences?.active_24h || true,
        quiet_hours_start: preferences?.quiet_hours_start || null,
        quiet_hours_end: preferences?.quiet_hours_end || null,
        weekends_enabled: preferences?.weekends_enabled || true,
        telegram_enabled: true,
        telegram_setup_in_progress: true,
      });

      setPreferences(updatedPrefs);

      toast({
        title: 'Telegram Setup Started',
        description: 'Please complete the setup in the Telegram app',
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to start Telegram setup',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleToggleTelegram = async (enabled: boolean) => {
    if (!user?.id) return;

    try {
      setIsLoading(true);
      const updatedPrefs = await updateUserPreferences({
        phone: preferences?.phone || '',
        prefer_sms: preferences?.prefer_sms || false,
        active_24h: preferences?.active_24h || true,
        quiet_hours_start: preferences?.quiet_hours_start || null,
        quiet_hours_end: preferences?.quiet_hours_end || null,
        weekends_enabled: preferences?.weekends_enabled || true,
        telegram_enabled: enabled,
      });

      setPreferences(updatedPrefs);

      toast({
        title: enabled ? 'Telegram Enabled' : 'Telegram Disabled',
        description: enabled
          ? 'You will now receive notifications via Telegram'
          : 'You will no longer receive notifications via Telegram',
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to update Telegram settings',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="mx-auto w-full max-w-md">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MessageCircle className="h-5 w-5" />
          Telegram Notifications
        </CardTitle>
        <CardDescription>Connect your Telegram account to receive notifications</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <Label htmlFor="telegram-enabled">Enable Telegram Notifications</Label>
          <Switch
            id="telegram-enabled"
            checked={preferences?.telegram_enabled || false}
            onCheckedChange={handleToggleTelegram}
            disabled={isLoading}
          />
        </div>
        {preferences?.telegram_enabled && !preferences?.telegram_chat_id && (
          <div className="text-sm text-muted-foreground">
            Your Telegram account is not connected. Click the button below to set it up.
          </div>
        )}
      </CardContent>
      <CardFooter>
        <Button
          onClick={handleTelegramSetup}
          disabled={isLoading || !!preferences?.telegram_chat_id}
          className="w-full"
        >
          {isLoading ? 'Connecting...' : 'Connect Telegram'}
        </Button>
      </CardFooter>
    </Card>
  );
}
