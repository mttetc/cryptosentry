'use client';

import { useState } from 'react';
import { useUser } from '@/hooks/use-user';
import { useToast } from '@/hooks/use-toast';
import { telnyxProvider } from '@/actions/messaging/providers/telnyx';
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
        const result = await telnyxProvider.makeCall({
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
        const result = await telnyxProvider.sendSMS({
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
      console.error('Error sending message:', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'An unexpected error occurred',
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
        <CardDescription>Send a direct message via SMS or voice call</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <textarea
          placeholder="Enter your message here..."
          value={message}
          onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setMessage(e.target.value)}
          maxLength={MAX_MESSAGE_LENGTH}
          rows={4}
          className="min-h-[100px] w-full resize-none rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
        />
        <div className="text-right text-sm text-muted-foreground">
          {message.length}/{MAX_MESSAGE_LENGTH}
        </div>
      </CardContent>
      <CardFooter className="flex gap-2">
        <Button
          onClick={() => handleSendMessage('sms')}
          disabled={isSending || !message.trim()}
          className="flex-1"
        >
          <MessageCircle className="mr-2 h-4 w-4" />
          {isSending ? 'Sending SMS...' : 'Send SMS'}
        </Button>
        <Button
          onClick={() => handleSendMessage('call')}
          disabled={isSending || !message.trim()}
          variant="secondary"
          className="flex-1"
        >
          <Phone className="mr-2 h-4 w-4" />
          {isSending ? 'Initiating Call...' : 'Make Call'}
        </Button>
      </CardFooter>
    </Card>
  );
}
