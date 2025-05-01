'use server';

import { z } from 'zod';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import type { MonitorState } from '@/actions/monitor/schemas/monitor-schemas';
import * as cheerio from 'cheerio';

const NITTER_INSTANCES = ['nitter.net', 'nitter.cz', 'nitter.privacydev.net'] as const;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes
const MAX_RETRIES = 3;
const RETRY_DELAY = 1000; // 1 second

// Cache for storing tweets to avoid too frequent requests
const tweetCache = new Map<string, { tweets: Tweet[]; timestamp: number }>();

const tweetSchema = z.object({
  id: z.string(),
  content: z.string(),
  author: z.string(),
  timestamp: z.string(),
  url: z.string(),
});

type Tweet = z.infer<typeof tweetSchema>;

async function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function fetchFromNitter(account: string): Promise<Tweet[]> {
  // Check cache first
  const cached = tweetCache.get(account);
  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    return cached.tweets;
  }

  let lastError: Error | null = null;

  // Try each instance until one works
  for (const instance of NITTER_INSTANCES) {
    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      try {
        const url = `https://${instance}/${account}`;
        const response = await fetch(url, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (compatible; CryptoSentry/1.0; +https://cryptosentry.com)',
          },
        });

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const html = await response.text();
        const tweets = parseTweets(html, account);

        // Update cache
        tweetCache.set(account, {
          tweets,
          timestamp: Date.now(),
        });

        return tweets;
      } catch (error) {
        lastError = error as Error;
        console.error(
          `Error fetching from ${instance} (attempt ${attempt + 1}/${MAX_RETRIES}):`,
          error
        );

        if (attempt < MAX_RETRIES - 1) {
          await delay(RETRY_DELAY * (attempt + 1)); // Exponential backoff
        }
      }
    }
  }

  console.error('All Nitter instances failed:', lastError);
  return [];
}

function parseTweets(html: string, account: string): Tweet[] {
  const tweets: Tweet[] = [];
  const $ = cheerio.load(html);

  // Find all tweet containers
  $('.timeline-item').each((_index: number, element: cheerio.Element) => {
    try {
      const $element = $(element);
      const content = $element.find('.tweet-content').text().trim();
      const timestamp = $element.find('.tweet-date').attr('datetime') || new Date().toISOString();
      const url = $element.find('.tweet-link').attr('href') || '';
      const id = url.split('/').pop() || '';

      const tweet = tweetSchema.parse({
        id,
        content,
        author: account,
        timestamp,
        url: url.startsWith('http') ? url : `https://twitter.com${url}`,
      });

      tweets.push(tweet);
    } catch (error) {
      console.error('Error parsing tweet:', error);
    }
  });

  return tweets;
}

export async function monitorTwitterAccount(account: string): Promise<void> {
  try {
    const supabase = await createServerSupabaseClient();

    // Get active social alerts for this account
    const { data: alerts, error } = await supabase
      .from('social_alerts')
      .select('*')
      .eq('account', account)
      .eq('active', true);

    if (error) throw error;
    if (!alerts?.length) return;

    // Fetch latest tweets
    const tweets = await fetchFromNitter(account);

    // Check each tweet against alert keywords
    for (const tweet of tweets) {
      for (const alert of alerts) {
        const hasMatchingKeywords = alert.keywords.some((keyword: string) =>
          tweet.content.toLowerCase().includes(keyword.toLowerCase())
        );

        if (hasMatchingKeywords) {
          // Record the trigger
          await supabase.from('alert_triggers').insert({
            alert_id: alert.id,
            triggered_at: new Date().toISOString(),
            content: tweet.content,
          });

          // Deactivate one-time alerts
          if (!alert.is_recurring) {
            await supabase.from('social_alerts').update({ active: false }).eq('id', alert.id);
          }
        }
      }
    }
  } catch (error) {
    console.error('Failed to monitor Twitter account:', error);
  }
}

export async function monitorSocial(account: string, _content: string): Promise<MonitorState> {
  try {
    // Use the new Twitter monitoring function
    await monitorTwitterAccount(account);
    return { success: true };
  } catch (error) {
    console.error('Failed to monitor social:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to monitor social',
    };
  }
}
