import { z } from 'zod';

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
      binance: process.env.BINANCE_ENDPOINT || 'https://api.binance.com/api/v3',
      coinbase: process.env.COINBASE_ENDPOINT || 'https://api.coinbase.com/v2',
      kraken: process.env.KRAKEN_ENDPOINT || 'https://api.kraken.com/0/public',
    },
  };

  return exchangeConfigSchema.parse(config);
}

export type ExchangeConfig = z.infer<typeof exchangeConfigSchema>;
export const exchangeConfig = loadConfig(); 