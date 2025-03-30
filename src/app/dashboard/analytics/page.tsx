import { Suspense } from 'react';
import { DashboardShell } from '@/components/dashboard/dashboard-shell';
import { DashboardHeader } from '@/components/dashboard/dashboard-header';
import { AnalyticsSkeleton } from '@/components/skeletons/analytics-skeleton';
import { AnalyticsContent } from '@/components/analytics/analytics-content';

export default function AnalyticsPage() {
  return (
    <DashboardShell>
      <DashboardHeader heading="Alerts Overview" text="Monitor your active alerts and updates" />

      <Suspense fallback={<AnalyticsSkeleton />}>
        <AnalyticsContent />
      </Suspense>
    </DashboardShell>
  );
}
