'use client';

import { useMonitoringStore } from '@/stores/monitoring';
import { AlertsList } from './AlertsList';

export function AlertsClient() {
  const { priceAlerts, socialAlerts } = useMonitoringStore();

  return <AlertsList priceAlerts={priceAlerts} socialAlerts={socialAlerts} />;
}
