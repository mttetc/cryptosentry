'use client';

import { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { TimeInput } from '@/components/ui/time-input';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { updateUserPreferences, getUserPreferences } from '@/actions/user';
import { Skeleton } from '@/components/ui/skeleton';
import type { NotificationPreferences } from '@/actions/user/types';
import { AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

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
          <Skeleton className="h-8 w-[200px]" />
          <Skeleton className="h-4 w-[300px]" />
        </CardHeader>
        <CardContent className="space-y-6">
          {Array.from({ length: 5 }).map((_, i) => (
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
        {/* Phone Number */}
        <div className="space-y-2">
          <Label htmlFor="phone">Phone Number</Label>
          <Input
            id="phone"
            type="tel"
            placeholder="+33612345678"
            value={preferences.phone}
            onChange={(e) => {
              setPreferences(prev => ({ ...prev, phone: e.target.value }));
              validatePhone(e.target.value);
            }}
            className={cn(phoneError && "border-destructive")}
          />
          {phoneError && (
            <div className="flex items-center gap-2 text-sm text-destructive">
              <AlertCircle className="h-4 w-4" />
              {phoneError}
            </div>
          )}
        </div>

        {/* 24/7 Alerts */}
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label>24/7 Alerts</Label>
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
        <div className="space-y-2">
          <Label>Quiet Hours</Label>
          <div className="flex items-center gap-4">
            <TimeInput
              value={preferences.quiet_hours_start || ''}
              onChange={(value) => 
                setPreferences(prev => ({ ...prev, quiet_hours_start: value || null }))
              }
              disabled={preferences.active_24h}
              placeholder="Start time"
            />
            <span>to</span>
            <TimeInput
              value={preferences.quiet_hours_end || ''}
              onChange={(value) => 
                setPreferences(prev => ({ ...prev, quiet_hours_end: value || null }))
              }
              disabled={preferences.active_24h}
              placeholder="End time"
            />
          </div>
          {!preferences.active_24h && !preferences.quiet_hours_start && !preferences.quiet_hours_end && (
            <p className="text-sm text-muted-foreground">
              Set quiet hours to prevent notifications during specific times
            </p>
          )}
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
          disabled={isPending || !!phoneError}
          className="w-full"
        >
          {isPending ? 'Saving...' : 'Save Preferences'}
        </Button>
      </CardContent>
    </Card>
  );
} 