import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Bell, X } from 'lucide-react';

interface Alert {
  id: string;
  symbol?: string;
  target_price?: number;
  account?: string;
  keywords?: string[];
  created_at: string;
}

interface AlertsListProps {
  priceAlerts: Alert[];
  socialAlerts: Alert[];
}

export function AlertsList({ priceAlerts, socialAlerts }: AlertsListProps) {
  return (
    <div className="grid gap-6 md:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            Active Price Alerts
          </CardTitle>
          <CardDescription>Currently monitoring price targets</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {priceAlerts.map((alert) => (
            <div
              key={alert.id}
              className="flex items-center justify-between rounded-lg bg-muted p-3"
            >
              <div>
                <p className="font-semibold">{alert.symbol}</p>
                <p className="text-sm text-muted-foreground">
                  Target: ${alert.target_price}
                </p>
              </div>
              <span className="rounded-full bg-primary/10 px-2 py-1 text-xs text-primary">
                Active
              </span>
            </div>
          ))}
          {priceAlerts.length === 0 && (
            <p className="text-sm text-muted-foreground">No active price alerts</p>
          )}
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
          {socialAlerts.map((alert) => (
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
          {socialAlerts.length === 0 && (
            <p className="text-sm text-muted-foreground">No active social alerts</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
} 