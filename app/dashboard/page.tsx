import { Suspense } from 'react';
import { getActiveAlerts, preloadActiveAlerts } from '@/actions/monitor';
import { AlertsList } from '@/components/alerts/AlertsList';
import { DashboardHeader } from '@/components/dashboard/DashboardHeader';
import { DashboardShell } from '@/components/dashboard/DashboardShell';
import { AlertsSkeleton } from '@/components/skeletons/AlertsSkeleton';
import { CreateAlertForm } from '@/components/alerts/CreateAlertForm';

// Preload alerts data
preloadActiveAlerts();

async function Alerts() {
  const { priceAlerts, socialAlerts } = await getActiveAlerts();
  
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
        
        <Suspense fallback={<AlertsSkeleton />}>
          <Alerts />
        </Suspense>
      </div>
    </DashboardShell>
  );
}
