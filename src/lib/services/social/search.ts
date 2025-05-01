'use server';

const NITTER_INSTANCES = [
  'https://nitter.net',
  'https://nitter.cz',
  'https://nitter.privacydev.net',
] as const;

async function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function searchSocialAccounts(query: string): Promise<string[]> {
  if (!query) {
    console.log('Empty query, returning empty array');
    return [];
  }

  const normalizedQuery = query.replace('@', '').toLowerCase();
  console.log('Normalized query:', normalizedQuery);

  let lastError: Error | null = null;

  // Try each instance until one works
  for (const instance of NITTER_INSTANCES) {
    try {
      const response = await fetch(
        `${instance}/search?f=users&q=${encodeURIComponent(normalizedQuery)}`,
        {
          headers: {
            'User-Agent': 'Mozilla/5.0 (compatible; CryptoSentry/1.0; +https://cryptosentry.com)',
          },
        }
      );

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const html = await response.text();

      // Extract usernames using regex since the HTML structure might vary
      const usernameRegex = /@([a-zA-Z0-9_]+)/g;
      const matches = html.match(usernameRegex);

      if (matches) {
        // Remove duplicates and sort
        const uniqueUsernames = [...new Set(matches)]
          .map((username) => username.toLowerCase())
          .sort();

        return uniqueUsernames;
      }

      return [];
    } catch (error) {
      lastError = error as Error;
      console.error(`Error fetching from ${instance}:`, error);

      // Wait a bit before trying the next instance
      await delay(1000);
    }
  }

  console.error('All Nitter instances failed:', lastError);
  return [];
}
