import { z } from 'zod';
import { EXCHANGE_ENDPOINTS } from '@/config/constants';

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
