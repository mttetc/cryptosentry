import { createServerSupabaseClient } from '@/lib/supabase';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';
import { z } from 'zod';
import { generateWebhookSignature } from '@/actions/bulkvs';

// Initialize rate limiter
const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

const ratelimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(10, '1 m'),
  analytics: true,
});

// Webhook payload validation schema
const bulkvsWebhookSchema = z.object({
  event: z.enum([
    'call.initiated',
    'call.answered',
    'call.completed',
    'call.failed',
    'machine.detected',
  ]),
  call_id: z.string(),
  call_control_id: z.string().optional(),
  status: z.string(),
  duration: z.number().optional(),
  machine_detection: z.object({
    result: z.enum(['machine', 'human', 'unknown']).optional(),
    duration: z.number().optional(),
  }).optional(),
  custom_params: z.object({
    emergency: z.string().optional(),
    message: z.string().optional(),
  }).optional(),
  timestamp: z.string(),
});

// Validate BulkVS webhook signature
function validateWebhook(request: NextRequest, body: string): boolean {
  const signature = request.headers.get('x-bulkvs-signature');
  const timestamp = request.headers.get('x-bulkvs-timestamp');

  if (!signature || !timestamp || !process.env.BULKVS_WEBHOOK_SECRET) {
    return false;
  }

  const expectedSignature = generateWebhookSignature(body, timestamp);
  return signature === expectedSignature;
}

// Log webhook request
async function logWebhookRequest(
  type: 'received' | 'processed' | 'error',
  data: Record<string, any>,
  error?: Error
) {
  const supabase = await createServerSupabaseClient();
  
  await supabase.from('webhook_logs').insert({
    type,
    service: 'bulkvs',
    payload: data,
    error: error?.message,
    timestamp: new Date().toISOString(),
  });
}

// Generate optimized call response
function generateCallResponse(message: string) {
  return {
    actions: [
      {
        say: {
          text: message,
          voice: 'neural',
          speed: 1.2,
        },
      },
      {
        hangup: {},
      },
    ],
  };
}

export async function POST(request: NextRequest) {
  try {
    // Apply rate limiting
    const forwardedFor = request.headers.get('x-forwarded-for');
    const ip = forwardedFor?.split(',')[0] || request.headers.get('x-real-ip') || '127.0.0.1';
    const { success: rateLimit } = await ratelimit.limit(ip);

    if (!rateLimit) {
      return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
    }

    const body = await request.text();
    const payload = JSON.parse(body);

    // Log incoming webhook
    await logWebhookRequest('received', payload);

    // Validate webhook signature
    if (!validateWebhook(request, body)) {
      console.error('Invalid BulkVS signature');
      await logWebhookRequest('error', payload, new Error('Invalid signature'));
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Validate webhook payload
    const validatedData = bulkvsWebhookSchema.safeParse(payload);
    if (!validatedData.success) {
      console.error('Invalid webhook payload:', validatedData.error);
      await logWebhookRequest('error', payload, new Error('Invalid payload'));
      return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
    }

    const { event, call_id, status, duration, machine_detection, custom_params } = validatedData.data;

    // Handle different event types
    switch (event) {
      case 'call.answered': {
        // If voicemail detected, hang up immediately
        if (machine_detection?.result === 'machine') {
          return NextResponse.json({ actions: [{ hangup: {} }] });
        }

        // Get message from custom params
        const messageBase64 = custom_params?.message;
        if (!messageBase64) {
          throw new Error('No message provided');
        }

        const message = Buffer.from(messageBase64, 'base64').toString();
        return NextResponse.json(generateCallResponse(message));
      }

      case 'call.completed':
      case 'call.failed': {
        const supabase = await createServerSupabaseClient();
        
        // Update alert history
        const { error } = await supabase
          .from('alert_history')
          .update({
            call_status: status,
            call_duration: duration,
            machine_detected: machine_detection?.result === 'machine',
            updated_at: new Date().toISOString(),
          })
          .eq('call_id', call_id);

        if (error) {
          await logWebhookRequest('error', payload, error);
          throw error;
        }
      }
    }

    // Log successful processing
    await logWebhookRequest('processed', payload);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('BulkVS webhook error:', error);
    await logWebhookRequest('error', {}, error as Error);
    return NextResponse.json(
      { error: 'Failed to process webhook' },
      { status: 500 }
    );
  }
} 