import { Suspense } from 'react';
import { DashboardHeader } from '@/components/dashboard/DashboardHeader';
import { DashboardShell } from '@/components/dashboard/DashboardShell';
import { AlertsSkeleton } from '@/components/skeletons/AlertsSkeleton';
import { CreateAlertForm } from '@/components/alerts/CreateAlertForm';
import { MonitoringStream } from '@/components/monitoring/MonitoringStream';
import { AlertsClient } from '@/components/alerts/AlertsClient';
import { UserPreferences } from '@/components/settings/UserPreferences';

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
