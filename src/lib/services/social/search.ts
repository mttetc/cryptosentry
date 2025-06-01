'use server';

import { proxyManager } from '@/lib/services/proxy/proxy-manager';

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36';
const RATE_LIMIT_DELAY = 5000;

// Twitter's GraphQL endpoint for user search
const SEARCH_ENDPOINT = 'https://twitter.com/i/api/graphql/L1VfBERtzc3VkzOIDQn9_Q/SearchTimeline';

let lastRequestTime = 0;

async function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function ensureRateLimit(): Promise<void> {
  const now = Date.now();
  if (now - lastRequestTime < RATE_LIMIT_DELAY) {
    await delay(RATE_LIMIT_DELAY - (now - lastRequestTime));
  }
  lastRequestTime = Date.now();
}

async function getGuestToken(): Promise<string> {
  const proxy = await proxyManager.getProxy();
  console.log('Getting guest token using proxy:', proxy);

  process.env.HTTP_PROXY = proxy;
  process.env.HTTPS_PROXY = proxy;

  try {
    const response = await fetch('https://api.twitter.com/1.1/guest/activate.json', {
      method: 'POST',
      headers: {
        Authorization:
          'Bearer AAAAAAAAAAAAAAAAAAAAANRILgAAAAAAnNwIzUejRCOuH5E6I8xnZz4puTs%3D1Zv7ttfk8LF81IUq16cHjhLTvJu4FA33AGWWjCpTnA',
        'User-Agent': USER_AGENT,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to get guest token: ${response.status}`);
    }

    const data = await response.json();
    return data.guest_token;
  } catch (error) {
    console.error('Error getting guest token:', error);
    throw error;
  } finally {
    delete process.env.HTTP_PROXY;
    delete process.env.HTTPS_PROXY;
  }
}

async function searchWithProxy(query: string): Promise<string[]> {
  const proxy = await proxyManager.getProxy();
  console.log('Searching with proxy:', proxy);

  process.env.HTTP_PROXY = proxy;
  process.env.HTTPS_PROXY = proxy;

  try {
    const guestToken = await getGuestToken();
    console.log('Got guest token:', guestToken);

    const variables = {
      rawQuery: query,
      count: 20,
      querySource: 'typed_query',
      product: 'People',
    };

    const features = {
      responsive_web_graphql_exclude_directive_enabled: true,
      verified_phone_label_enabled: false,
      responsive_web_graphql_timeline_navigation_enabled: true,
      responsive_web_graphql_skip_user_profile_image_extensions_enabled: false,
      responsive_web_uc_gql_enabled: true,
      vibe_api_enabled: true,
      responsive_web_edit_tweet_api_enabled: true,
      graphql_is_translatable_rweb_tweet_is_translatable_enabled: false,
      standardized_nudges_misinfo: true,
      tweet_with_visibility_results_prefer_gql_limited_actions_policy_enabled: true,
      interactive_text_enabled: true,
      responsive_web_text_conversations_enabled: false,
      responsive_web_enhance_cards_enabled: false,
    };

    const response = await fetch(
      `${SEARCH_ENDPOINT}?variables=${encodeURIComponent(
        JSON.stringify(variables)
      )}&features=${encodeURIComponent(JSON.stringify(features))}`,
      {
        method: 'GET',
        headers: {
          Authorization:
            'Bearer AAAAAAAAAAAAAAAAAAAAANRILgAAAAAAnNwIzUejRCOuH5E6I8xnZz4puTs%3D1Zv7ttfk8LF81IUq16cHjhLTvJu4FA33AGWWjCpTnA',
          'x-guest-token': guestToken,
          'User-Agent': USER_AGENT,
          'x-twitter-client-language': 'en',
          'x-twitter-active-user': 'yes',
          Accept: '*/*',
        },
      }
    );

    if (!response.ok) {
      throw new Error(`Search request failed: ${response.status}`);
    }

    const data = await response.json();
    console.log('Search response:', JSON.stringify(data, null, 2));

    const users = extractUsersFromResponse(data);
    console.log('Found users:', users);

    return users;
  } catch (error) {
    console.error('Error searching with proxy:', error);
    throw error;
  } finally {
    delete process.env.HTTP_PROXY;
    delete process.env.HTTPS_PROXY;
  }
}

function extractUsersFromResponse(data: any): string[] {
  try {
    const instructions =
      data.data?.search_by_raw_query?.search_timeline?.timeline?.instructions || [];
    const entries = instructions.find((i: any) => i.type === 'TimelineAddEntries')?.entries || [];

    return entries
      .filter((entry: any) => entry.content?.itemContent?.user_results?.result?.legacy?.screen_name)
      .map((entry: any) => `@${entry.content.itemContent.user_results.result.legacy.screen_name}`)
      .filter(Boolean);
  } catch (error) {
    console.error('Error extracting users:', error);
    return [];
  }
}

export async function searchSocialAccounts(query: string): Promise<string[]> {
  if (!query) return [];

  const normalizedQuery = query.replace('@', '').toLowerCase();
  console.log('Searching for:', normalizedQuery);

  try {
    await ensureRateLimit();

    // Try with multiple proxies until successful
    const maxAttempts = 3;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        return await searchWithProxy(normalizedQuery);
      } catch (error) {
        console.error(`Attempt ${attempt}/${maxAttempts} failed:`, error);
        if (attempt === maxAttempts) {
          throw error;
        }
        await delay(1000 * attempt); // Exponential backoff
      }
    }

    throw new Error('All search attempts failed');
  } catch (error) {
    console.error('Search failed:', error);
    return [];
  }
}
