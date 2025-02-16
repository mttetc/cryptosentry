import { Suspense } from 'react';
import { DashboardHeader } from '@/components/dashboard/DashboardHeader';
import { DashboardShell } from '@/components/dashboard/DashboardShell';
import { AlertsSkeleton } from '@/components/skeletons/AlertsSkeleton';
import { CreateAlertForm } from '@/components/alerts/CreateAlertForm';
import { MonitoringStream } from '@/components/monitoring/MonitoringStream';
import { AlertsList } from '@/components/alerts/AlertsList';
import { UserPreferences } from '@/components/settings/UserPreferences';
import { useMonitoringStore } from '@/stores/monitoring';

function Alerts() {
  const { priceAlerts, socialAlerts } = useMonitoringStore();
  
  return (
    <AlertsList 
      priceAlerts={priceAlerts}
      socialAlerts={socialAlerts}
    />
  );
}

export default function DashboardPage() {
  return (
    <DashboardShell>
      <DashboardHeader 
        heading="Alerts Dashboard" 
        text="Monitor prices and social posts in real-time."
      />
      
      <div className="grid gap-8">
        <Suspense fallback={<div className="h-[200px] rounded-md bg-muted animate-pulse" />}>
          <CreateAlertForm />
        </Suspense>
        
        <MonitoringStream />
        
        <Suspense fallback={<AlertsSkeleton />}>
          <Alerts />
        </Suspense>

        <Suspense fallback={<div className="h-[400px] rounded-md bg-muted animate-pulse" />}>
          <UserPreferences />
        </Suspense>
      </div>
    </DashboardShell>
  );
}
