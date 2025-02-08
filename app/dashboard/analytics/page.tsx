'use client';

import { useEffect, useState } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Activity, AlertTriangle, CheckCircle, Clock } from 'lucide-react';
import { getSystemHealth } from '@/actions/analytics';

interface HealthScore {
  price: number;
  social: number;
  calls: number;
  system: number;
}

export default function AnalyticsDashboard() {
  const [health, setHealth] = useState<HealthScore | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchHealth = async () => {
      const result = await getSystemHealth();
      if (result.success) {
        setHealth(result.health);
      }
      setLoading(false);
    };

    fetchHealth();
    const interval = setInterval(fetchHealth, 30000); // Update every 30 seconds

    return () => clearInterval(interval);
  }, []);

  const getHealthColor = (score: number) => {
    if (score >= 90) return 'text-green-500';
    if (score >= 70) return 'text-yellow-500';
    return 'text-red-500';
  };

  const getHealthIcon = (score: number) => {
    if (score >= 90) return <CheckCircle className="h-8 w-8 text-green-500" />;
    if (score >= 70) return <AlertTriangle className="h-8 w-8 text-yellow-500" />;
    return <AlertTriangle className="h-8 w-8 text-red-500" />;
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-background to-muted p-8">
        <Clock className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-gradient-to-b from-background to-muted p-4 md:p-8">
      <div className="mx-auto max-w-6xl space-y-8">
        <div className="flex items-center justify-between">
          <h1 className="text-4xl font-bold tracking-tight">System Analytics</h1>
          <Activity className="h-6 w-6 text-primary" />
        </div>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {health &&
            Object.entries(health).map(([service, score]) => (
              <Card key={service}>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">
                    {service.charAt(0).toUpperCase() + service.slice(1)} Service
                  </CardTitle>
                  {getHealthIcon(score)}
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    <span className={getHealthColor(score)}>{score.toFixed(1)}%</span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {score >= 90 ? 'Healthy' : score >= 70 ? 'Warning' : 'Critical'}
                  </p>
                </CardContent>
              </Card>
            ))}
        </div>

        <Card>
          <CardHeader>
            <CardTitle>System Performance</CardTitle>
            <CardDescription>Real-time monitoring of critical metrics</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-8">
              {health &&
                Object.entries(health).map(([service, score]) => (
                  <div key={service} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">
                        {service.charAt(0).toUpperCase() + service.slice(1)} Health
                      </span>
                      <span className={`text-sm ${getHealthColor(score)}`}>
                        {score.toFixed(1)}%
                      </span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-secondary">
                      <div
                        className={`h-full rounded-full ${
                          score >= 90
                            ? 'bg-green-500'
                            : score >= 70
                              ? 'bg-yellow-500'
                              : 'bg-red-500'
                        }`}
                        style={{ width: `${score}%` }}
                      />
                    </div>
                  </div>
                ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
