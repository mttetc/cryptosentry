export interface BaseAlert {
  id: string;
  user_id: string;
  created_at: string;
  updated_at: string;
  active: boolean;
}

export interface PriceAlert extends BaseAlert {
  symbol: string;
  target_price: number;
  direction: 'above' | 'below';
  triggered_at?: string;
}

export interface SocialAlert extends BaseAlert {
  platform: 'twitter' | 'reddit' | 'discord';
  keywords: string[];
  sentiment?: 'positive' | 'negative' | 'neutral';
  triggered_at?: string;
}
