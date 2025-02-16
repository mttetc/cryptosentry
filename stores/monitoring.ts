import { create } from 'zustand';
import { PriceAlert, SocialAlert } from '@/types/alerts';

interface MonitoringState {
  priceAlerts: PriceAlert[];
  socialAlerts: SocialAlert[];
  error: string | null;
  setPriceAlerts: (alerts: PriceAlert[]) => void;
  setSocialAlerts: (alerts: SocialAlert[]) => void;
  setError: (error: string) => void;
  clearError: () => void;
}

export const useMonitoringStore = create<MonitoringState>()((set) => ({
  priceAlerts: [],
  socialAlerts: [],
  error: null,
  setPriceAlerts: (alerts: PriceAlert[]) => set({ priceAlerts: alerts }),
  setSocialAlerts: (alerts: SocialAlert[]) => set({ socialAlerts: alerts }),
  setError: (error: string) => set({ error }),
  clearError: () => set({ error: null }),
})); 