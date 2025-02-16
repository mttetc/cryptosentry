'use server';

import Parser from 'rss-parser';
import { createServerSupabaseClient } from '@/lib/supabase';
import { monitorSocial } from '@/actions/monitoring/alerts';

const parser = new Parser({
  headers: {
    'User-Agent': 'Mozilla/5.0 (compatible; CryptoAlertBot/1.0)',
  },
});

const MAX_CACHE_SIZE = 1000;
const CACHE_CLEANUP_THRESHOLD = 800;

// Keep track of last seen post IDs with timestamps
const lastSeenPosts = new Map<string, Map<string, number>>();

// Get a working Nitter instance with retry
async function getWorkingInstance(): Promise<string> {
  const instances = (process.env.NITTER_INSTANCES || 'nitter.net').split(',');
  const errors: string[] = [];
  
  for (const instance of instances) {
    try {
      const response = await fetch(`https://${instance}/`, {
        method: 'HEAD',
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; CryptoAlertBot/1.0)' },
        // Add timeout
        signal: AbortSignal.timeout(5000),
      });
      if (response.ok) return instance.trim();
    } catch (error) {
      errors.push(`${instance}: ${error}`);
      console.warn(`Nitter instance ${instance} is down:`, error);
    }
  }
  
  throw new Error(`No working Nitter instance found. Errors: ${errors.join(', ')}`);
}

// Load last processed posts from database
async function loadLastProcessedPosts(): Promise<void> {
  const supabase = await createServerSupabaseClient();
  const { data: posts } = await supabase
    .from('processed_posts')
    .select('account, post_id, processed_at')
    .gte('processed_at', new Date(Date.now() - 86400000).toISOString()); // Last 24h

  if (posts) {
    posts.forEach(({ account, post_id, processed_at }) => {
      if (!lastSeenPosts.has(account)) {
        lastSeenPosts.set(account, new Map());
      }
      lastSeenPosts.get(account)?.set(post_id, new Date(processed_at).getTime());
    });
  }
}

// Save processed post to database
async function saveProcessedPost(account: string, postId: string): Promise<void> {
  const supabase = await createServerSupabaseClient();
  await supabase.from('processed_posts').insert({
    account,
    post_id: postId,
    processed_at: new Date().toISOString(),
  });
}

// Clean up old entries from cache and database
async function cleanupOldPosts(): Promise<void> {
  const now = Date.now();
  const oneDayAgo = now - 86400000;

  // Clean up memory cache
  for (const [account, posts] of lastSeenPosts.entries()) {
    // Remove old entries
    for (const [postId, timestamp] of posts.entries()) {
      if (timestamp < oneDayAgo) {
        posts.delete(postId);
      }
    }

    // If map is empty, remove the account
    if (posts.size === 0) {
      lastSeenPosts.delete(account);
    }
  }

  // Clean up database
  const supabase = await createServerSupabaseClient();
  await supabase
    .from('processed_posts')
    .delete()
    .lt('processed_at', new Date(oneDayAgo).toISOString());
}

export async function startSocialMonitoring() {
  try {
    // Load last processed posts on startup
    await loadLastProcessedPosts();

    const supabase = await createServerSupabaseClient();

    // Fetch all active social alerts
    const { data: socialAlerts } = await supabase
      .from('social_alerts')
      .select('account, keywords')
      .eq('active', true);

    if (!socialAlerts?.length) return { success: true };

    // Get unique accounts to monitor
    const accounts = [...new Set(socialAlerts.map(alert => alert.account))];
    
    // Get a working Nitter instance
    const instance = await getWorkingInstance();
    
    // Monitor each account's RSS feed
    for (const account of accounts) {
      try {
        const feed = await parser.parseURL(`https://${instance}/${account}/rss`);
        
        // Initialize last seen posts for this account if needed
        if (!lastSeenPosts.has(account)) {
          lastSeenPosts.set(account, new Map());
        }
        
        const accountPosts = lastSeenPosts.get(account)!;
        
        // Process new posts
        for (const item of feed.items) {
          const postId = item.guid || item.link;
          if (postId && !accountPosts.has(postId)) {
            // Process the post content
            await monitorSocial(account, item.content || item.title || '');
            
            // Save to memory and database
            accountPosts.set(postId, Date.now());
            await saveProcessedPost(account, postId);

            // Clean up if too many entries
            if (accountPosts.size > MAX_CACHE_SIZE) {
              const oldestPosts = Array.from(accountPosts.entries())
                .sort(([, a], [, b]) => a - b)
                .slice(0, CACHE_CLEANUP_THRESHOLD);
              accountPosts.clear();
              oldestPosts.forEach(([id, time]) => accountPosts.set(id, time));
            }
          }
        }
      } catch (error) {
        console.error(`Error monitoring account ${account}:`, error);
      }
    }

    // Clean up old posts periodically
    await cleanupOldPosts();

    // Schedule next check
    setTimeout(
      startSocialMonitoring,
      parseInt(process.env.FETCH_INTERVAL || '60') * 1000
    );

    return { success: true };
  } catch (error) {
    console.error('Error in social monitoring:', error);
    
    // Retry after a delay
    setTimeout(
      startSocialMonitoring,
      parseInt(process.env.FETCH_INTERVAL || '60') * 1000
    );
    
    return { error: 'Failed to monitor social feeds' };
  }
}

export async function stopSocialMonitoring() {
  // Save current state before stopping
  const supabase = await createServerSupabaseClient();
  
  for (const [account, posts] of lastSeenPosts.entries()) {
    for (const [postId, timestamp] of posts.entries()) {
      await supabase.from('processed_posts').upsert({
        account,
        post_id: postId,
        processed_at: new Date(timestamp).toISOString(),
      });
    }
  }
  
  lastSeenPosts.clear();
  return { success: true };
}
