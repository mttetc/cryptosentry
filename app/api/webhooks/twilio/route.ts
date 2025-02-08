import { createServerSupabaseClient } from '@/lib/supabase';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import twilio from 'twilio';
import { z } from 'zod';
import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

// Initialize rate limiter
const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

const ratelimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(10, '1 m'), // 10 requests per minute
  analytics: true,
});

// Webhook payload validation schema
const twilioWebhookSchema = z.object({
  CallSid: z.string().min(1),
  CallStatus: z.enum([
    'queued',
    'ringing',
    'in-progress',
    'completed',
    'busy',
    'failed',
    'no-answer',
    'canceled',
  ]),
  CallDuration: z.string().optional(),
});

// CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': process.env.TWILIO_WEBHOOK_ORIGIN || '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, x-twilio-signature',
  'Access-Control-Max-Age': '86400',
};

// Validate Twilio webhook signature
function validateTwilioRequest(request: NextRequest, params: Record<string, string>): boolean {
  const twilioSignature = request.headers.get('x-twilio-signature');
  const url = process.env.TWILIO_STATUS_CALLBACK_URL;

  if (!twilioSignature || !url || !process.env.TWILIO_AUTH_TOKEN) {
    return false;
  }

  const validator = twilio.validateRequest(
    process.env.TWILIO_AUTH_TOKEN,
    twilioSignature,
    url,
    params
  );

  return validator;
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
    service: 'twilio',
    payload: data,
    error: error?.message,
    timestamp: new Date().toISOString(),
  });
}

// OPTIONS handler for CORS
export async function OPTIONS() {
  return new NextResponse(null, { headers: corsHeaders });
}

export async function POST(request: NextRequest) {
  try {
    // Apply rate limiting
    const forwardedFor = request.headers.get('x-forwarded-for');
    const ip = forwardedFor?.split(',')[0] || request.headers.get('x-real-ip') || '127.0.0.1';
    const { success: rateLimit } = await ratelimit.limit(ip);

    if (!rateLimit) {
      return NextResponse.json(
        { error: 'Too many requests' },
        { status: 429, headers: corsHeaders }
      );
    }

    const formData = await request.formData();
    const params: Record<string, string> = {};
    formData.forEach((value, key) => {
      params[key] = value.toString();
    });

    // Log incoming webhook
    await logWebhookRequest('received', params);

    // Validate Twilio signature
    if (!validateTwilioRequest(request, params)) {
      console.error('Invalid Twilio signature');
      await logWebhookRequest('error', params, new Error('Invalid signature'));
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: corsHeaders });
    }

    // Validate webhook payload
    const validatedData = twilioWebhookSchema.safeParse(params);
    if (!validatedData.success) {
      console.error('Invalid webhook payload:', validatedData.error);
      await logWebhookRequest('error', params, new Error('Invalid payload'));
      return NextResponse.json({ error: 'Invalid payload' }, { status: 400, headers: corsHeaders });
    }

    const { CallSid: callSid, CallStatus: status, CallDuration: duration } = validatedData.data;

    const supabase = await createServerSupabaseClient();

    // Update alert history with call status
    const { error } = await supabase
      .from('alert_history')
      .update({
        call_status: status,
        call_duration: duration,
        updated_at: new Date().toISOString(),
      })
      .eq('call_sid', callSid);

    if (error) {
      await logWebhookRequest('error', params, error);
      throw error;
    }

    // Log successful processing
    await logWebhookRequest('processed', params);

    return NextResponse.json({ success: true }, { headers: corsHeaders });
  } catch (error) {
    console.error('Twilio webhook error:', error);
    await logWebhookRequest('error', {}, error as Error);
    return NextResponse.json(
      { error: 'Failed to process webhook' },
      { status: 500, headers: corsHeaders }
    );
  }
}
