'use client';

import { useState } from 'react';
import { AlertBuilder } from '@/components/alert-builder';

const AVAILABLE_SYMBOLS = [
  'BTC',
  'ETH',
  'XRP',
  'ADA',
  'SOL',
  'DOT',
  'DOGE',
  'SHIB',
  'MATIC',
  'LINK',
];

type AlertCondition = {
  assets: Array<{
    id: string;
    symbol: string;
    condition: 'above' | 'below' | 'between' | 'change';
    value: number;
    value2?: number;
    percentageChange?: number;
    isReference?: boolean;
  }>;
  logicOperator: 'AND' | 'OR';
};

export default function Home() {
  const [alertCondition, setAlertCondition] = useState<AlertCondition>({
    assets: [],
    logicOperator: 'AND' as const,
  });

  const handleAlertConditionChange = (newCondition: AlertCondition) => {
    setAlertCondition(newCondition);
    console.log('Alert condition updated:', newCondition);
  };

  return (
    <main className="min-h-screen p-8">
      <div className="mx-auto max-w-4xl space-y-8">
        <div className="space-y-4">
          <h1 className="text-4xl font-bold">Crypto Alert Builder</h1>
          <p className="text-lg text-muted-foreground">
            Create complex alert conditions by combining multiple price and percentage change
            triggers.
          </p>
        </div>

        <div className="rounded-lg border bg-card p-6">
          <AlertBuilder
            initialCondition={alertCondition}
            onChange={handleAlertConditionChange}
            availableSymbols={AVAILABLE_SYMBOLS}
          />
        </div>
      </div>
    </main>
  );
}
