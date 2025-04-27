import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

/**
 * Sends a notification to a user via Telegram
 * @param userId The user ID to send the notification to
 * @param message The message to send
 * @returns A promise that resolves when the message is sent
 */
export async function sendTelegramNotification(userId: string, message: string): Promise<boolean> {
  try {
    // Get the user's Telegram chat ID
    const { data: userData, error: userError } = await supabase
      .from('user_notification_settings')
      .select('telegram_chat_id, telegram_enabled')
      .eq('user_id', userId)
      .single();

    if (userError) {
      console.error('Error fetching user Telegram settings:', userError);
      return false;
    }

    // Check if the user has Telegram enabled and a chat ID
    if (!userData.telegram_enabled || !userData.telegram_chat_id) {
      console.log(`User ${userId} does not have Telegram notifications enabled or no chat ID`);
      return false;
    }

    // Send the message
    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    if (!botToken) {
      console.error('Missing TELEGRAM_BOT_TOKEN environment variable');
      return false;
    }

    const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        chat_id: userData.telegram_chat_id,
        text: message,
        parse_mode: 'HTML',
      }),
    });

    const data = await response.json();

    if (data.ok) {
      console.log(`Telegram notification sent to user ${userId}`);
      return true;
    } else {
      console.error('Failed to send Telegram notification:', data.description);
      return false;
    }
  } catch (error) {
    console.error('Error sending Telegram notification:', error);
    return false;
  }
}

/**
 * Sends a notification to multiple users via Telegram
 * @param userIds Array of user IDs to send the notification to
 * @param message The message to send
 * @returns A promise that resolves to an object with the results
 */
export async function sendTelegramNotificationsToUsers(
  userIds: string[],
  message: string
): Promise<{ success: string[]; failed: string[] }> {
  const results = {
    success: [] as string[],
    failed: [] as string[],
  };

  // Process users in batches to avoid rate limiting
  const batchSize = 10;
  for (let i = 0; i < userIds.length; i += batchSize) {
    const batch = userIds.slice(i, i + batchSize);

    // Process each user in the batch
    const batchPromises = batch.map(async (userId) => {
      const success = await sendTelegramNotification(userId, message);
      if (success) {
        results.success.push(userId);
      } else {
        results.failed.push(userId);
      }
    });

    // Wait for all users in the batch to be processed
    await Promise.all(batchPromises);

    // Add a small delay between batches to avoid rate limiting
    if (i + batchSize < userIds.length) {
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }

  return results;
}

/**
 * Sends a notification to all users who have Telegram enabled
 * @param message The message to send
 * @returns A promise that resolves to an object with the results
 */
export async function sendTelegramNotificationToAllUsers(
  message: string
): Promise<{ success: string[]; failed: string[] }> {
  try {
    // Get all users who have Telegram enabled
    const { data: users, error } = await supabase
      .from('user_notification_settings')
      .select('user_id')
      .eq('telegram_enabled', true)
      .not('telegram_chat_id', 'is', null);

    if (error) {
      console.error('Error fetching users with Telegram enabled:', error);
      return { success: [], failed: [] };
    }

    // Extract user IDs
    const userIds = users.map((user) => user.user_id);

    // Send notifications to all users
    return await sendTelegramNotificationsToUsers(userIds, message);
  } catch (error) {
    console.error('Error sending Telegram notifications to all users:', error);
    return { success: [], failed: [] };
  }
}
