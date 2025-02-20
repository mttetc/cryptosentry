'use client';

import { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { TimeInput } from '@/components/ui/time-input';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { updateUserPreferences } from '@/actions/user';
import { Skeleton } from '@/components/ui/skeleton';

interface NotificationPreferences {
  phone: string;
  prefer_sms: boolean;
  active_24h: boolean;
  quiet_hours_start: string | null;
  quiet_hours_end: string | null;
  weekends_enabled: boolean;
}

const DEFAULT_PREFERENCES: NotificationPreferences = {
  phone: '',
  prefer_sms: false,
  active_24h: true,
  quiet_hours_start: null,
  quiet_hours_end: null,
  weekends_enabled: true,
};

export function UserPreferences() {
  const [preferences, setPreferences] = useState<NotificationPreferences>(DEFAULT_PREFERENCES);
  const [isPending, setIsPending] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    async function fetchPreferences() {
      try {
        const response = await fetch('/api/user/notification-settings');
        if (!response.ok) {
          throw new Error('Failed to fetch preferences');
        }
        const data = await response.json();
        setPreferences(data);
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

  const handleSave = async () => {
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
          <Skeleton className="h-8 w-[200px]" />
          <Skeleton className="h-4 w-[300px]" />
        </CardHeader>
        <CardContent className="space-y-6">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Skeleton className="h-5 w-[150px]" />
                <Skeleton className="h-4 w-[200px]" />
              </div>
              <Skeleton className="h-6 w-[42px] rounded-full" />
            </div>
          ))}
          <Skeleton className="h-10 w-full" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Notification Preferences</CardTitle>
        <CardDescription>
          Customize how and when you want to receive alerts
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* 24/7 Monitoring */}
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label>24/7 Monitoring</Label>
            <p className="text-sm text-muted-foreground">
              Receive alerts at any time
            </p>
          </div>
          <Switch
            checked={preferences.active_24h}
            onCheckedChange={(checked: boolean) => 
              setPreferences(prev => ({ ...prev, active_24h: checked }))
            }
          />
        </div>

        {/* Quiet Hours */}
        <div className="space-y-4">
          <div className="space-y-0.5">
            <Label>Quiet Hours</Label>
            <p className="text-sm text-muted-foreground">
              Don't send alerts during these hours
            </p>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Start Time</Label>
              <TimeInput
                value={preferences.quiet_hours_start || ''}
                onChange={(time: string) => 
                  setPreferences(prev => ({ ...prev, quiet_hours_start: time }))
                }
                disabled={preferences.active_24h}
              />
            </div>
            <div className="space-y-2">
              <Label>End Time</Label>
              <TimeInput
                value={preferences.quiet_hours_end || ''}
                onChange={(time: string) => 
                  setPreferences(prev => ({ ...prev, quiet_hours_end: time }))
                }
                disabled={preferences.active_24h}
              />
            </div>
          </div>
        </div>

        {/* Weekend Alerts */}
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label>Weekend Alerts</Label>
            <p className="text-sm text-muted-foreground">
              Allow alerts during weekends
            </p>
          </div>
          <Switch
            checked={preferences.weekends_enabled}
            onCheckedChange={(checked: boolean) => 
              setPreferences(prev => ({ ...prev, weekends_enabled: checked }))
            }
            disabled={preferences.active_24h}
          />
        </div>

        {/* Notification Method */}
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label>Prefer SMS</Label>
            <p className="text-sm text-muted-foreground">
              Use SMS instead of calls for alerts
            </p>
          </div>
          <Switch
            checked={preferences.prefer_sms}
            onCheckedChange={(checked: boolean) => 
              setPreferences(prev => ({ ...prev, prefer_sms: checked }))
            }
          />
        </div>

        <Button 
          onClick={handleSave} 
          disabled={isPending}
          className="w-full"
        >
          Save Preferences
        </Button>
      </CardContent>
    </Card>
  );
} 