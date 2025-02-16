import { Suspense } from 'react';
import { DashboardShell } from '@/components/dashboard/DashboardShell';
import { DashboardHeader } from '@/components/dashboard/DashboardHeader';
import { AnalyticsSkeleton } from '@/components/skeletons/AnalyticsSkeleton';
import { AnalyticsContent } from '@/components/analytics/AnalyticsContent';

export default function AnalyticsPage() {
  return (
    <DashboardShell>
      <DashboardHeader 
        heading="System Analytics" 
        text="Real-time monitoring of critical metrics"
      />
      
      <Suspense fallback={<AnalyticsSkeleton />}>
        <AnalyticsContent />
      </Suspense>
    </DashboardShell>
  );
}
