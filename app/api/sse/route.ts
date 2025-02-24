'use server';

import { handleMonitorEvent } from '@/actions/monitor/lib/core';
import { headers } from 'next/headers';
import { sseConfig } from '@/config/sse';

export const runtime = 'edge';

export async function GET() {
  const headersList = headers();
  const encoder = new TextEncoder();

  // Create SSE stream
  const stream = new ReadableStream({
    start(controller) {
      // Keep connection alive using configured interval
      const interval = setInterval(() => {
        controller.enqueue(encoder.encode('event: ping\ndata: {}\n\n'));
      }, sseConfig.interval);

      // Cleanup on close
      return () => {
        clearInterval(interval);
      };
    }
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}

export async function POST(request: Request) {
  try {
    const event = await request.json();
    const result = await handleMonitorEvent(event);

    if (!result.success) {
      return new Response(JSON.stringify({ error: result.error }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return new Response(
      JSON.stringify({ error: 'Failed to process event' }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
} 