import { Suspense } from 'react';
import { DashboardShell } from '@/components/dashboard/dashboard-shell';
import { AlertsSkeleton } from '@/components/skeletons/alerts-skeleton';
import { CreateAlertForm } from '@/components/alerts/create-alert-form';
import { AlertsClient } from '@/components/alerts/alerts-client';
import { UserPreferences } from '@/components/settings/user-preferences';
import { DashboardHeader } from '@/components/dashboard/dashboard-header';
import { MonitoringStream } from '@/components/monitoring/MonitoringStream';

export const dynamic = 'force-dynamic';

export default function DashboardPage() {
  return (
    <DashboardShell>
      <DashboardHeader
        heading="Alerts Dashboard"
        text="Monitor prices and social posts in real-time."
      />

      <div className="grid gap-8">
        <Suspense fallback={<div className="h-[200px] animate-pulse rounded-md bg-muted" />}>
          <CreateAlertForm />
        </Suspense>

        <MonitoringStream />

        <Suspense fallback={<AlertsSkeleton />}>
          <AlertsClient />
        </Suspense>

        <Suspense fallback={<div className="h-[400px] animate-pulse rounded-md bg-muted" />}>
          <UserPreferences />
        </Suspense>
      </div>
    </DashboardShell>
  );
}
