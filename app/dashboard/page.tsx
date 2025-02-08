'use client';

import { useEffect, useState } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Bell, X, DollarSign, History } from 'lucide-react';
import { createBrowserSupabaseClient } from '../lib/supabase';

type Alert = {
  id: string;
  symbol?: string;
  target_price?: number;
  account?: string;
  keywords?: string[];
  created_at: string;
  triggered_at?: string;
};

type HistoryEntry = {
  id: string;
  alert_id: string;
  alert_type: 'price' | 'social';
  symbol?: string;
  target_price?: number;
  triggered_price?: number;
  account?: string;
  content?: string;
  matched_keywords?: string[];
  created_at: string;
};

export default function Dashboard() {
  const [activeAlerts, setActiveAlerts] = useState<Alert[]>([]);
  const [alertHistory, setAlertHistory] = useState<HistoryEntry[]>([]);
  const supabase = createBrowserSupabaseClient();

  useEffect(() => {
    const fetchData = async () => {
      // Fetch active alerts
      const { data: priceAlertsData, error: priceAlertsError } = await supabase
        .from('price_alerts')
        .select('*')
        .eq('active', true);

      const { data: socialAlertsData, error: socialAlertsError } = await supabase
        .from('social_alerts')
        .select('*')
        .eq('active', true);

      const { data: historyData, error: historyError } = await supabase
        .from('alert_history')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(10);

      if (priceAlertsError || socialAlertsError || historyError) {
        console.error(
          'Error fetching alerts:',
          priceAlertsError || socialAlertsError || historyError
        );
        return;
      }

      setActiveAlerts([...(priceAlertsData || []), ...(socialAlertsData || [])]);
      setAlertHistory(historyData || []);
    };

    fetchData();

    // Subscribe to real-time updates
    const priceSubscription = supabase
      .channel('price_alerts_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'price_alerts',
        },
        () => fetchData()
      )
      .subscribe();

    const socialSubscription = supabase
      .channel('social_alerts_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'social_alerts',
        },
        () => fetchData()
      )
      .subscribe();

    const historySubscription = supabase
      .channel('alert_history_changes')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'alert_history',
        },
        () => fetchData()
      )
      .subscribe();

    return () => {
      priceSubscription.unsubscribe();
      socialSubscription.unsubscribe();
      historySubscription.unsubscribe();
    };
  }, [supabase]);

  return (
    <main className="min-h-screen bg-gradient-to-b from-background to-muted p-4 md:p-8">
      <div className="mx-auto max-w-6xl space-y-8">
        <div className="flex items-center justify-between">
          <h1 className="text-4xl font-bold tracking-tight">Alert Dashboard</h1>
          <div className="flex gap-2">
            <Bell className="h-6 w-6 text-primary" />
            <span className="font-semibold">{activeAlerts.length} Active Alerts</span>
          </div>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <DollarSign className="h-5 w-5" />
                Active Price Alerts
              </CardTitle>
              <CardDescription>Currently monitoring price targets</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {activeAlerts
                .filter((alert) => alert.symbol)
                .map((alert) => (
                  <div
                    key={alert.id}
                    className="flex items-center justify-between rounded-lg bg-muted p-3"
                  >
                    <div>
                      <p className="font-semibold">{alert.symbol}</p>
                      <p className="text-sm text-muted-foreground">Target: ${alert.target_price}</p>
                    </div>
                    <span className="rounded-full bg-primary/10 px-2 py-1 text-xs text-primary">
                      Active
                    </span>
                  </div>
                ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <X className="h-5 w-5" />
                Active Social Alerts
              </CardTitle>
              <CardDescription>Monitoring social media activity</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {activeAlerts
                .filter((alert) => alert.account)
                .map((alert) => (
                  <div
                    key={alert.id}
                    className="flex items-center justify-between rounded-lg bg-muted p-3"
                  >
                    <div>
                      <p className="font-semibold">{alert.account}</p>
                      <p className="text-sm text-muted-foreground">
                        Keywords: {alert.keywords?.join(', ')}
                      </p>
                    </div>
                    <span className="rounded-full bg-primary/10 px-2 py-1 text-xs text-primary">
                      Active
                    </span>
                  </div>
                ))}
            </CardContent>
          </Card>

          <Card className="md:col-span-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <History className="h-5 w-5" />
                Alert History
              </CardTitle>
              <CardDescription>Recent alert triggers and notifications</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {alertHistory.map((entry) => (
                  <div
                    key={entry.id}
                    className="flex items-center justify-between rounded-lg bg-muted p-3"
                  >
                    <div>
                      <p className="font-semibold">
                        {entry.alert_type === 'price'
                          ? `${entry.symbol} reached $${entry.triggered_price}`
                          : `${entry.account} posted about ${entry.matched_keywords?.join(', ')}`}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        Triggered at: {new Date(entry.created_at).toLocaleString()}
                      </p>
                    </div>
                    <span className="rounded-full bg-destructive/10 px-2 py-1 text-xs text-destructive">
                      Triggered
                    </span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </main>
  );
}
