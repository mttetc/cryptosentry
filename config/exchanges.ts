import { z } from 'zod';

export const EXCHANGE_ENDPOINTS = {
  BINANCE: 'https://api.binance.com/api/v3',
  COINBASE: 'https://api.coinbase.com/v2',
  KRAKEN: 'https://api.kraken.com/0',
} as const;

const exchangeConfigSchema = z.object({
  endpoints: z.object({
    binance: z.string().url(),
    coinbase: z.string().url(),
    kraken: z.string().url(),
  }),
});

function loadConfig() {
  const config = {
    endpoints: {
      binance: EXCHANGE_ENDPOINTS.BINANCE,
      coinbase: EXCHANGE_ENDPOINTS.COINBASE,
      kraken: EXCHANGE_ENDPOINTS.KRAKEN,
    },
  };

  return exchangeConfigSchema.parse(config);
}

export type ExchangeConfig = z.infer<typeof exchangeConfigSchema>;
export const exchangeConfig = loadConfig();
