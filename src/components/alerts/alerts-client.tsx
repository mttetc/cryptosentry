'use client';

import { useMonitoringStore } from '@/stores/monitoring';
import { AlertsList } from '@/components/alerts/alerts-list';

export function AlertsClient() {
  const { priceAlerts, socialAlerts } = useMonitoringStore();

  return <AlertsList priceAlerts={priceAlerts} socialAlerts={socialAlerts} />;
}
