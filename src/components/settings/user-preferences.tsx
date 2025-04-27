'use client';

import { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { TimeInput } from '@/components/ui/time-input';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { updateUserPreferences, getUserPreferences } from '@/actions/user/lib/core';
import { Skeleton } from '@/components/ui/skeleton';
import type { NotificationPreferences } from '@/actions/user/types/index';
import { AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils/';

const DEFAULT_PREFERENCES: NotificationPreferences = {
  phone: '',
  prefer_sms: false,
  active_24h: true,
  quiet_hours_start: null,
  quiet_hours_end: null,
  weekends_enabled: true,
};

// E.164 phone number format validation
const PHONE_REGEX = /^\+[1-9]\d{1,14}$/;

export function UserPreferences() {
  const [preferences, setPreferences] = useState<NotificationPreferences>(DEFAULT_PREFERENCES);
  const [isPending, setIsPending] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [phoneError, setPhoneError] = useState('');
  const { toast } = useToast();

  useEffect(() => {
    async function fetchPreferences() {
      try {
        const prefs = await getUserPreferences();
        if (prefs) {
          setPreferences(prefs);
        }
      } catch (error) {
        toast({
          title: 'Error',
          description: error instanceof Error ? error.message : 'Failed to load preferences',
          variant: 'destructive',
        });
      } finally {
        setIsLoading(false);
      }
    }

    fetchPreferences();
  }, [toast]);

  const validatePhone = (phone: string) => {
    if (!phone) {
      setPhoneError('Phone number is required');
      return false;
    }
    if (!PHONE_REGEX.test(phone)) {
      setPhoneError('Phone number must be in E.164 format (e.g., +33612345678)');
      return false;
    }
    setPhoneError('');
    return true;
  };

  const handleSave = async () => {
    if (!validatePhone(preferences.phone)) {
      return;
    }

    try {
      setIsPending(true);
      const result = await updateUserPreferences(preferences);

      if (result.error) {
        throw new Error(result.error);
      }

      toast({
        title: 'Success',
        description: 'Your notification preferences have been updated.',
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to update preferences',
        variant: 'destructive',
      });
    } finally {
      setIsPending(false);
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Notification Preferences</CardTitle>
          <CardDescription>Configure how you want to receive alerts</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-4">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-10 w-full" />
          </div>
          <div className="space-y-4">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-10 w-full" />
          </div>
          <div className="space-y-4">
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-10 w-full" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Notification Preferences</CardTitle>
        <CardDescription>Configure how you want to receive alerts</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="phone">Phone Number</Label>
            <Input
              id="phone"
              value={preferences.phone}
              onChange={(e) => setPreferences({ ...preferences, phone: e.target.value })}
              placeholder="+33612345678"
              className={cn(phoneError && 'border-red-500')}
            />
            {phoneError && (
              <p className="flex items-center gap-1 text-sm text-red-500">
                <AlertCircle className="h-4 w-4" />
                {phoneError}
              </p>
            )}
          </div>

          <div className="flex items-center justify-between">
            <Label htmlFor="prefer_sms">Prefer SMS over Email</Label>
            <Switch
              id="prefer_sms"
              checked={preferences.prefer_sms}
              onCheckedChange={(checked) => setPreferences({ ...preferences, prefer_sms: checked })}
            />
          </div>

          <div className="flex items-center justify-between">
            <Label htmlFor="active_24h">Active 24/7</Label>
            <Switch
              id="active_24h"
              checked={preferences.active_24h}
              onCheckedChange={(checked) => setPreferences({ ...preferences, active_24h: checked })}
            />
          </div>

          {!preferences.active_24h && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="quiet_hours_start">Quiet Hours Start</Label>
                <TimeInput
                  id="quiet_hours_start"
                  value={preferences.quiet_hours_start || ''}
                  onChange={(value) => setPreferences({ ...preferences, quiet_hours_start: value })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="quiet_hours_end">Quiet Hours End</Label>
                <TimeInput
                  id="quiet_hours_end"
                  value={preferences.quiet_hours_end || ''}
                  onChange={(value) => setPreferences({ ...preferences, quiet_hours_end: value })}
                />
              </div>

              <div className="flex items-center justify-between">
                <Label htmlFor="weekends_enabled">Enable on Weekends</Label>
                <Switch
                  id="weekends_enabled"
                  checked={preferences.weekends_enabled}
                  onCheckedChange={(checked) =>
                    setPreferences({ ...preferences, weekends_enabled: checked })
                  }
                />
              </div>
            </div>
          )}
        </div>

        <Button onClick={handleSave} disabled={isPending}>
          {isPending ? 'Saving...' : 'Save Preferences'}
        </Button>
      </CardContent>
    </Card>
  );
}
