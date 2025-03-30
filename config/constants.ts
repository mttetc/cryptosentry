export const MONITORING_CONFIG = {
  SSE: {
    MAX_RETRIES: 3,
    BACKOFF_MULTIPLIER: 1.5,
    RECONNECT_INTERVAL: 5000,
    CONNECTION_TIMEOUT: 3600000,
    HEARTBEAT_INTERVAL: 30000,
    MAX_CONNECTIONS_PER_USER: 5,
    RATE_LIMIT_REQUESTS: 100,
    RATE_LIMIT_WINDOW: 60,
  },
  BATCH_SIZE: 50,
} as const;

export const EXCHANGE_ENDPOINTS = {
  BINANCE: 'https://api.binance.com/api/v3',
  COINBASE: 'https://api.coinbase.com/v2',
  KRAKEN: 'https://api.kraken.com/0',
} as const;

export const CACHE_CONFIG = {
  TTL: 60000,
  MAX_SIZE: 1000,
} as const;

export const TELNYX_CONFIG = {
  API_BASE: 'https://api.telnyx.com/v2',
} as const;

export const NITTER_INSTANCES = ['nitter.net', 'nitter.cz', 'nitter.privacydev.net'] as const;
