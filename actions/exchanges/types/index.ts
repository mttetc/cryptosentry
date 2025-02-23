export interface PriceAlert {
  symbol: string;
  target_price: number;
}

export interface ExchangeState {
  success: boolean;
  error?: string;
} 