'use server';

import { WebSocket } from 'ws';
import { createServerSupabaseClient } from '@/lib/supabase';
import { monitorPrice, monitorSocial } from '@/actions/alerts';
import { startPriceMonitoring, stopPriceMonitoring } from '@/actions/exchanges';

// Keep track of active WebSocket connections
let priceSocket: WebSocket | null = null;
let socialSocket: WebSocket | null = null;
let heartbeatInterval: NodeJS.Timeout | null = null;
let socialHeartbeatInterval: NodeJS.Timeout | null = null;

export async function startMonitoring() {
  try {
    const supabase = await createServerSupabaseClient();

    // Fetch all active alerts
    const [{ data: priceAlerts }, { data: socialAlerts }] = await Promise.all([
      supabase.from('price_alerts').select('symbol').eq('active', true),
      supabase.from('social_alerts').select('account, keywords').eq('active', true)
    ]);

    // Start price monitoring if there are active price alerts
    if (priceAlerts?.length) {
      await startPriceMonitoring();

      // Setup WebSocket connection for price monitoring if not already connected
      if (!priceSocket) {
        priceSocket = new WebSocket('wss://stream.binance.com:9443/ws');

        priceSocket.on('open', () => {
          console.log('Price monitoring WebSocket connected');
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
          setTimeout(startMonitoring, 5000);
        });

        priceSocket.on('close', () => {
          console.log('Price WebSocket closed, attempting to reconnect...');
          setTimeout(startMonitoring, 5000);
        });

        heartbeatInterval = setInterval(() => {
          if (priceSocket?.readyState === WebSocket.OPEN) {
            priceSocket.ping();
          }
        }, 30000);
      }
    }

    // Start social monitoring if there are active social alerts
    if (socialAlerts?.length) {
      // Setup WebSocket connection for social monitoring if not already connected
      if (!socialSocket) {
        if (!process.env.SOCIAL_STREAM_ENDPOINT) {
          console.error('SOCIAL_STREAM_ENDPOINT environment variable not set');
          return { error: 'Social stream endpoint not configured' };
        }
        
        socialSocket = new WebSocket(process.env.SOCIAL_STREAM_ENDPOINT);

        socialSocket.on('open', () => {
          console.log('Social monitoring WebSocket connected');
          if (socialSocket && socialAlerts) {
            // Subscribe to social streams for each account
            const accounts = [...new Set(socialAlerts.map(alert => alert.account))];
            socialSocket.send(
              JSON.stringify({
                type: 'subscribe',
                accounts,
                keywords: socialAlerts.flatMap(alert => alert.keywords)
              })
            );
          }
        });

        socialSocket.on('message', async (data) => {
          try {
            const socialData = JSON.parse(data.toString());
            if (socialData.account && socialData.content) {
              await monitorSocial(socialData.account, socialData.content);
            }
          } catch (error) {
            console.error('Error processing social message:', error);
          }
        });

        socialSocket.on('error', (error) => {
          console.error('Social WebSocket error:', error);
          setTimeout(startMonitoring, 5000);
        });

        socialSocket.on('close', () => {
          console.log('Social WebSocket closed, attempting to reconnect...');
          setTimeout(startMonitoring, 5000);
        });

        socialHeartbeatInterval = setInterval(() => {
          if (socialSocket?.readyState === WebSocket.OPEN) {
            socialSocket.ping();
          }
        }, 30000);
      }
    }

    return { success: true };
  } catch (error) {
    console.error('Error starting monitoring:', error);
    return { error: 'Failed to start monitoring' };
  }
}

export async function stopMonitoring() {
  // Clean up WebSocket connections
  if (priceSocket) {
    priceSocket.close();
    priceSocket = null;
  }

  if (socialSocket) {
    socialSocket.close();
    socialSocket = null;
  }

  // Clear heartbeat intervals
  if (heartbeatInterval) {
    clearInterval(heartbeatInterval);
    heartbeatInterval = null;
  }

  if (socialHeartbeatInterval) {
    clearInterval(socialHeartbeatInterval);
    socialHeartbeatInterval = null;
  }

  // Stop price monitoring on exchanges
  await stopPriceMonitoring();
  return { success: true };
}
