'use server';

import { TwitterApi, UserV2 } from 'twitter-api-v2';
import { createServerSupabaseClient } from '@/lib/supabase';
import { monitorSocial } from '@/actions/alerts';
import { WebSocket } from 'ws';

const twitterClient = new TwitterApi(process.env.TWITTER_BEARER_TOKEN!);

// Keep track of WebSocket connections
const connections = new Map<string, WebSocket>();
const reconnectDelays = new Map<string, number>();
const MAX_RECONNECT_DELAY = 60000; // 1 minute
const INITIAL_RECONNECT_DELAY = 1000; // 1 second

export async function startSocialMonitoring() {
  try {
    const supabase = await createServerSupabaseClient();

    // Fetch all active social alerts
    const { data: socialAlerts } = await supabase
      .from('social_alerts')
      .select('account, keywords')
      .eq('active', true);

    if (!socialAlerts?.length) return { success: true };

    // Get unique accounts and keywords
    const accounts = [...new Set(socialAlerts.map((alert) => alert.account))];
    const keywords = [...new Set(socialAlerts.flatMap((alert) => alert.keywords))];

    // Create rules for the filtered stream
    const rules = [
      ...accounts.map((account) => ({ value: `from:${account}`, tag: `account:${account}` })),
      ...keywords.map((keyword) => ({ value: keyword, tag: `keyword:${keyword}` })),
    ];

    // Set up stream rules with error handling and retries
    let retries = 3;
    while (retries > 0) {
      try {
        const currentRules = await twitterClient.v2.streamRules();
        if (currentRules.data?.length) {
          await twitterClient.v2.updateStreamRules({
            delete: { ids: currentRules.data.map((rule) => rule.id) },
          });
        }
        await twitterClient.v2.updateStreamRules({ add: rules });
        break;
      } catch (error) {
        console.error(`Error setting up stream rules (${retries} retries left):`, error);
        retries--;
        if (retries === 0) throw error;
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    }

    // Start filtered stream with enhanced error handling
    const stream = await twitterClient.v2.searchStream({
      'tweet.fields': ['author_id', 'created_at', 'text'],
      expansions: ['author_id'],
      'user.fields': ['username', 'verified'],
    });

    let messageCount = 0;
    let startTime = Date.now();

    stream.on('data', async (tweet) => {
      messageCount++;
      const now = Date.now();
      const elapsed = now - startTime;

      if (elapsed >= 60000) {
        // Log stats every minute
        console.log(`Processing ${messageCount} tweets per minute`);
        messageCount = 0;
        startTime = now;
      }

      const processingStart = performance.now();
      const author = tweet.includes?.users?.find((u: UserV2) => u.id === tweet.data.author_id);

      if (author) {
        await monitorSocial(author.username, tweet.data.text);

        // Log processing time if it exceeds 100ms
        const processingTime = performance.now() - processingStart;
        if (processingTime > 100) {
          console.warn(`Long processing time for tweet: ${processingTime}ms`);
        }
      }
    });

    // Enhanced error handling with exponential backoff
    stream.on('error', (error) => {
      console.error('Stream error:', error);

      const reconnect = async () => {
        const currentDelay = reconnectDelays.get('twitter') || INITIAL_RECONNECT_DELAY;
        await new Promise((resolve) => setTimeout(resolve, currentDelay));

        // Exponential backoff with max delay
        const nextDelay = Math.min(currentDelay * 2, MAX_RECONNECT_DELAY);
        reconnectDelays.set('twitter', nextDelay);

        startSocialMonitoring().catch(console.error);
      };

      reconnect();
    });

    // Monitor stream connection
    stream.on('end', () => {
      console.warn('Stream ended, reconnecting...');
      clearInterval(heartbeat);
      startSocialMonitoring().catch(console.error);
    });

    const heartbeat = setInterval(() => {
      // Just keep the interval running to prevent garbage collection
    }, 30000);

    return { success: true };
  } catch (error) {
    console.error('Error starting social monitoring:', error);
    return { error: 'Failed to start social monitoring' };
  }
}

// Function to stop social monitoring
export async function stopSocialMonitoring() {
  try {
    // Clean up all WebSocket connections
    for (const [key, ws] of connections.entries()) {
      ws.close();
      connections.delete(key);
      reconnectDelays.delete(key);
    }

    return { success: true };
  } catch (error) {
    console.error('Error stopping social monitoring:', error);
    return { error: 'Failed to stop social monitoring' };
  }
}
