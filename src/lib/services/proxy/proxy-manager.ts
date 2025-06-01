import { z } from 'zod';
import fetch from 'node-fetch';
import { HttpsProxyAgent } from 'https-proxy-agent';
import { HttpProxyAgent } from 'http-proxy-agent';

const proxySchema = z.object({
  ip: z.string(),
  port: z.number(),
  protocol: z.enum(['http', 'https']),
  anonymity: z.enum(['transparent', 'anonymous', 'elite']).optional(),
  responseTime: z.number().optional(),
  uptime: z.number().optional(),
  lastChecked: z.date().optional(),
});

export type Proxy = z.infer<typeof proxySchema>;

class ProxyManager {
  private proxies: Proxy[] = [];
  private currentIndex = 0;
  private lastCheck: Date = new Date(0);
  private checkInterval = 15 * 60 * 1000; // 15 minutes
  private maxValidationAttempts = 3;
  private validationTimeout = 15000; // 15 seconds
  private fetchTimeout = 30000; // 30 seconds

  private async fetchProxies(): Promise<Proxy[]> {
    try {
      // Fetch from multiple free proxy sources
      const sources = [
        'https://raw.githubusercontent.com/TheSpeedX/PROXY-List/master/http.txt',
        'https://raw.githubusercontent.com/ShiftyTR/Proxy-List/master/https.txt',
        'https://raw.githubusercontent.com/monosans/proxy-list/main/proxies/http.txt',
        'https://raw.githubusercontent.com/monosans/proxy-list/main/proxies/https.txt',
        'https://raw.githubusercontent.com/rdavydov/proxy-list/main/proxies/http.txt',
        'https://raw.githubusercontent.com/rdavydov/proxy-list/main/proxies/https.txt',
        'https://raw.githubusercontent.com/roosterkid/openproxylist/main/HTTPS_RAW.txt',
        'https://raw.githubusercontent.com/roosterkid/openproxylist/main/HTTP_RAW.txt',
      ];

      const newProxies: Proxy[] = [];
      const seenProxies = new Set<string>();

      for (const source of sources) {
        try {
          const response = await fetch(source, {
            headers: {
              'User-Agent':
                'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
            },
            timeout: this.fetchTimeout,
          });

          if (!response.ok) {
            console.warn(`Failed to fetch proxies from ${source}: ${response.status}`);
            continue;
          }

          const text = await response.text();
          const lines = text.split('\n');

          for (const line of lines) {
            const [ip, port] = line.trim().split(':');
            if (ip && port) {
              try {
                const key = `${ip}:${port}`;
                if (!seenProxies.has(key)) {
                  seenProxies.add(key);
                  const proxy = proxySchema.parse({
                    ip,
                    port: parseInt(port),
                    protocol: source.includes('https.txt') ? 'https' : 'http',
                  });
                  newProxies.push(proxy);
                }
              } catch (error) {
                // Skip invalid proxies
                console.error(`Error parsing proxy:`, error);
                continue;
              }
            }
          }
        } catch (error) {
          console.error(`Error fetching from ${source}:`, error);
        }
      }

      console.log(`Fetched ${newProxies.length} unique proxies`);
      return newProxies;
    } catch (error) {
      console.error('Error fetching proxies:', error);
      return [];
    }
  }

  private async validateProxy(proxy: Proxy): Promise<boolean> {
    const validationEndpoints = [
      'http://www.google.com',
      'http://www.cloudflare.com',
      'http://www.example.com',
    ];

    for (let attempt = 1; attempt <= this.maxValidationAttempts; attempt++) {
      for (const endpoint of validationEndpoints) {
        try {
          const proxyUrl = `${proxy.protocol}://${proxy.ip}:${proxy.port}`;
          const proxyAgent = endpoint.startsWith('https')
            ? new HttpsProxyAgent(proxyUrl)
            : new HttpProxyAgent(proxyUrl);

          try {
            const response = await fetch(endpoint, {
              method: 'HEAD',
              agent: proxyAgent,
              headers: {
                'User-Agent':
                  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
              },
              timeout: this.validationTimeout,
            });

            if (response.ok) {
              console.log(`Proxy ${proxyUrl} validated successfully against ${endpoint}`);
              return true;
            }

            console.warn(`Proxy ${proxyUrl} returned status ${response.status} for ${endpoint}`);
          } catch (error) {
            if (error instanceof Error) {
              console.warn(
                `Proxy validation attempt ${attempt}/${this.maxValidationAttempts} failed for ${proxyUrl} against ${endpoint}:`,
                error.message
              );
            }
          }
        } catch (error) {
          console.error('Error during proxy validation:', error);
        }
      }

      if (attempt < this.maxValidationAttempts) {
        await new Promise((resolve) => setTimeout(resolve, 1000 * attempt)); // Exponential backoff
      }
    }

    return false;
  }

  public async getProxy(): Promise<string> {
    const now = new Date();
    if (
      now.getTime() - this.lastCheck.getTime() > this.checkInterval ||
      this.proxies.length === 0
    ) {
      console.log('Refreshing proxy list...');
      const newProxies = await this.fetchProxies();

      if (newProxies.length === 0) {
        console.warn('No proxies fetched, using existing proxies if available');
        if (this.proxies.length === 0) {
          throw new Error('No proxies available');
        }
        return this.getNextProxy();
      }

      console.log(`Validating ${newProxies.length} proxies...`);
      const validProxies = await Promise.all(
        newProxies.map(async (proxy) => {
          const isValid = await this.validateProxy(proxy);
          return isValid ? proxy : null;
        })
      );

      this.proxies = validProxies.filter((proxy): proxy is Proxy => proxy !== null);
      console.log(`Found ${this.proxies.length} valid proxies`);

      this.lastCheck = now;
      this.currentIndex = 0;
    }

    if (this.proxies.length === 0) {
      throw new Error('No valid proxies available');
    }

    return this.getNextProxy();
  }

  private getNextProxy(): string {
    const proxy = this.proxies[this.currentIndex];
    this.currentIndex = (this.currentIndex + 1) % this.proxies.length;
    return `${proxy.protocol}://${proxy.ip}:${proxy.port}`;
  }

  public async getValidProxies(): Promise<string[]> {
    const now = new Date();
    if (
      now.getTime() - this.lastCheck.getTime() > this.checkInterval ||
      this.proxies.length === 0
    ) {
      await this.getProxy(); // This will refresh the proxy list
    }
    return this.proxies.map((proxy) => `${proxy.protocol}://${proxy.ip}:${proxy.port}`);
  }
}

// Export a singleton instance
export const proxyManager = new ProxyManager();
