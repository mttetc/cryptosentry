'use client';

import { useState } from 'react';
import { useUser } from '@/hooks/use-user';
import { useToast } from '@/hooks/use-toast';
import { makeCall, sendSMS } from '@/actions/messaging/providers/telnyx';
import { getUserPreferences } from '@/actions/user';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { MessageCircle, Phone } from 'lucide-react';

const MAX_MESSAGE_LENGTH = 1600; // Telnyx's max message length

export function MessagingInterface() {
  const [message, setMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const { user } = useUser();
  const { toast } = useToast();

  const handleSendMessage = async (type: 'call' | 'sms') => {
    if (!user?.id) {
      toast({
        title: 'Error',
        description: 'You must be logged in to send messages',
        variant: 'destructive',
      });
      return;
    }

    if (!message.trim()) {
      toast({
        title: 'Error',
        description: 'Please enter a message',
        variant: 'destructive',
      });
      return;
    }

    try {
      setIsSending(true);

      // Get user preferences first
      const prefs = await getUserPreferences();
      if (!prefs || !prefs.phone) {
        toast({
          title: 'Error',
          description: 'Please set up your notification preferences first',
          variant: 'destructive',
        });
        return;
      }

      if (type === 'call') {
        const result = await makeCall({
          userId: user.id,
          phone: prefs.phone,
          message,
          recipientType: 'human_residence',
        });

        if (result.error) {
          toast({
            title: 'Error Making Call',
            description: result.error,
            variant: 'destructive',
          });
          return;
        }

        toast({
          title: 'Call Initiated',
          description: 'Your call has been initiated successfully',
        });
      } else {
        const result = await sendSMS({
          userId: user.id,
          phone: prefs.phone,
          message,
        });

        if (result.error) {
          toast({
            title: 'Error Sending SMS',
            description: result.error,
            variant: 'destructive',
          });
          return;
        }

        toast({
          title: 'SMS Sent',
          description: 'Your SMS has been sent successfully',
        });
      }

      // Clear message after successful send
      setMessage('');
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to send message',
        variant: 'destructive',
      });
    } finally {
      setIsSending(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Send Message</CardTitle>
        <CardDescription>Send a message via call or SMS</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="space-y-2">
            <label htmlFor="message" className="text-sm font-medium">
              Message
            </label>
            <textarea
              id="message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              className="min-h-[100px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              placeholder="Enter your message..."
              maxLength={MAX_MESSAGE_LENGTH}
            />
            <p className="text-xs text-muted-foreground">
              {message.length}/{MAX_MESSAGE_LENGTH} characters
            </p>
          </div>
        </div>
      </CardContent>
      <CardFooter className="flex gap-4">
        <Button
          onClick={() => handleSendMessage('call')}
          disabled={isSending}
          className="flex items-center gap-2"
        >
          <Phone className="h-4 w-4" />
          Make Call
        </Button>
        <Button
          onClick={() => handleSendMessage('sms')}
          disabled={isSending}
          className="flex items-center gap-2"
        >
          <MessageCircle className="h-4 w-4" />
          Send SMS
        </Button>
      </CardFooter>
    </Card>
  );
}
