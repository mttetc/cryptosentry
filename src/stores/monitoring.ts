import { create } from 'zustand';
import { PriceAlert, SocialAlert } from '@/types/alerts';

interface PriceData {
  symbol: string;
  price: number;
  timestamp: number;
}

interface SocialData {
  platform: string;
  content: string;
  timestamp: number;
}

interface MonitoringState {
  priceAlerts: PriceAlert[];
  socialAlerts: SocialAlert[];
  latestPrices: Record<string, PriceData>;
  latestSocial: Record<string, SocialData>;
  error: string | null;
  setPriceAlerts: (alerts: PriceAlert[]) => void;
  setSocialAlerts: (alerts: SocialAlert[]) => void;
  updatePrice: (data: PriceData) => void;
  updateSocial: (data: SocialData) => void;
  setError: (error: string) => void;
  clearError: () => void;
}

export const useMonitoringStore = create<MonitoringState>()((set) => ({
  priceAlerts: [],
  socialAlerts: [],
  latestPrices: {},
  latestSocial: {},
  error: null,
  setPriceAlerts: (alerts: PriceAlert[]) => set({ priceAlerts: alerts }),
  setSocialAlerts: (alerts: SocialAlert[]) => set({ socialAlerts: alerts }),
  updatePrice: (data: PriceData) =>
    set((state) => ({
      latestPrices: {
        ...state.latestPrices,
        [data.symbol]: data,
      },
    })),
  updateSocial: (data: SocialData) =>
    set((state) => ({
      latestSocial: {
        ...state.latestSocial,
        [data.platform]: data,
      },
    })),
  setError: (error: string) => set({ error }),
  clearError: () => set({ error: null }),
}));
