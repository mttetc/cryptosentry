'use server';

import { sendTelegramNotification, sendTelegramNotificationToAllUsers } from '../../lib/telegram';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';

/**
 * Sends a test notification to the current user via Telegram
 */
export async function sendTestNotification(): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createServerSupabaseClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session?.user.id) {
      return { success: false, error: 'Not authenticated' };
    }

    const message = `
<b>Test Notification</b>

This is a test notification from CryptoSentry.
If you're receiving this, your Telegram integration is working correctly!

<i>Sent at ${new Date().toLocaleString()}</i>
    `.trim();

    const success = await sendTelegramNotification(session.user.id, message);

    if (success) {
      revalidatePath('/settings/notifications');
      return { success: true };
    } else {
      return { success: false, error: 'Failed to send notification' };
    }
  } catch (error) {
    console.error('Error sending test notification:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'An unknown error occurred',
    };
  }
}

/**
 * Sends a notification to all users who have Telegram enabled
 * This should only be used for important system-wide announcements
 */
export async function sendAnnouncementToAllUsers(message: string): Promise<{
  success: boolean;
  error?: string;
  results?: { success: string[]; failed: string[] };
}> {
  try {
    const supabase = await createServerSupabaseClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session?.user.id) {
      return { success: false, error: 'Not authenticated' };
    }

    // Check if the user is an admin
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('is_admin')
      .eq('id', session.user.id)
      .single();

    if (userError || !userData?.is_admin) {
      return { success: false, error: 'Unauthorized: Only admins can send announcements' };
    }

    // Format the message with HTML
    const formattedMessage = `
<b>CryptoSentry Announcement</b>

${message}

<i>Sent by CryptoSentry Admin</i>
    `.trim();

    const results = await sendTelegramNotificationToAllUsers(formattedMessage);

    revalidatePath('/admin/announcements');
    return { success: true, results };
  } catch (error) {
    console.error('Error sending announcement:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'An unknown error occurred',
    };
  }
}
