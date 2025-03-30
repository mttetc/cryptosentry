'use server';

import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { handleMonitorEvent } from '@/actions/monitor/lib/core';

export const runtime = 'edge';

export async function POST(request: Request) {
  try {
    // Validate API key or other authentication
    const apiKey = request.headers.get('x-api-key');
    if (!apiKey || apiKey !== process.env.MONITOR_API_KEY) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const event = await request.json();

    // Process the event
    const result = await handleMonitorEvent(event);

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    // Broadcast to connected SSE clients
    const response = await fetch('/api/sse', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(event),
    });

    if (!response.ok) {
      throw new Error('Failed to broadcast event');
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error processing monitor event:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
