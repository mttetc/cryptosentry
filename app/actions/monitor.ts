'use server';

import { WebSocket } from 'ws';
import { createServerSupabaseClient } from '@/lib/supabase';
import { monitorPrice, monitorSocial } from '@/actions/alerts';
import { startPriceMonitoring, stopPriceMonitoring } from '@/actions/exchanges';

// Keep track of active WebSocket connections
let priceSocket: WebSocket | null = null;
let heartbeatInterval: NodeJS.Timeout | null = null;

export async function startMonitoring() {
  try {
    const supabase = await createServerSupabaseClient();

    // Fetch all active price alerts to get symbols to monitor
    const { data: priceAlerts } = await supabase
      .from('price_alerts')
      .select('symbol')
      .eq('active', true);

    if (!priceAlerts?.length) return { success: true };

    // Start multi-exchange monitoring
    await startPriceMonitoring();

    // Setup WebSocket connection if not already connected
    if (!priceSocket) {
      priceSocket = new WebSocket('wss://stream.binance.com:9443/ws');

      priceSocket.on('open', () => {
        console.log('Price monitoring WebSocket connected');
        // Subscribe to ticker stream for all symbols
        if (priceSocket) {
          priceSocket.send(
            JSON.stringify({
              method: 'SUBSCRIBE',
              params: ['!ticker@arr'],
              id: 1,
            })
          );
        }
      });

      priceSocket.on('message', async (data) => {
        try {
          const ticker = JSON.parse(data.toString());
          if (ticker.c) {
            const symbol = ticker.s.replace('USDT', '');
            const price = parseFloat(ticker.c);
            await monitorPrice(symbol, price);
          }
        } catch (error) {
          console.error('Error processing price message:', error);
        }
      });

      priceSocket.on('error', (error) => {
        console.error('Price WebSocket error:', error);
        // Attempt to reconnect
        setTimeout(startMonitoring, 5000);
      });

      priceSocket.on('close', () => {
        console.log('Price WebSocket closed, attempting to reconnect...');
        setTimeout(startMonitoring, 5000);
      });

      // Setup heartbeat interval to keep connection alive
      heartbeatInterval = setInterval(() => {
        if (priceSocket?.readyState === WebSocket.OPEN) {
          priceSocket.ping();
        }
      }, 30000); // Send ping every 30 seconds
    }

    return { success: true };
  } catch (error) {
    console.error('Error starting monitoring:', error);
    return { error: 'Failed to start monitoring' };
  }
}

export async function stopMonitoring() {
  // Clean up WebSocket connection
  if (priceSocket) {
    priceSocket.close();
    priceSocket = null;
  }

  // Clear heartbeat interval
  if (heartbeatInterval) {
    clearInterval(heartbeatInterval);
    heartbeatInterval = null;
  }

  // Stop price monitoring on exchanges
  await stopPriceMonitoring();
  return { success: true };
}
