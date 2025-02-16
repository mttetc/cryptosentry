import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { handleCallWebhook } from '@/actions/messaging/providers/bulkvs';
import { logError, logWarn } from '@/lib/logger';

const MAX_BODY_SIZE = 1024 * 1024; // 1MB
const TIMESTAMP_TOLERANCE = 300000; // 5 minutes
const REPLAY_CACHE = new Set<string>();
const REPLAY_CACHE_DURATION = 3600000; // 1 hour

// Clean up replay cache periodically
setInterval(() => {
  REPLAY_CACHE.clear();
}, REPLAY_CACHE_DURATION);

export async function POST(request: Request) {
  try {
    // Check content length
    const contentLength = parseInt(request.headers.get('content-length') || '0');
    if (contentLength > MAX_BODY_SIZE) {
      logWarn('Webhook payload too large', { size: contentLength });
      return new NextResponse('Payload too large', { status: 413 });
    }

    const signature = request.headers.get('x-bulkvs-signature');
    const timestamp = request.headers.get('x-bulkvs-timestamp');
    const nonce = request.headers.get('x-bulkvs-nonce');
    
    if (!signature || !timestamp || !nonce) {
      logWarn('Missing webhook headers', { signature, timestamp, nonce });
      return new NextResponse('Missing required headers', { status: 401 });
    }

    // Validate timestamp
    const timestampMs = parseInt(timestamp);
    const now = Date.now();
    if (isNaN(timestampMs) || 
        Math.abs(now - timestampMs) > TIMESTAMP_TOLERANCE) {
      logWarn('Invalid webhook timestamp', { timestamp, now });
      return new NextResponse('Invalid timestamp', { status: 401 });
    }

    // Check for replay attacks
    const replayKey = `${signature}:${timestamp}:${nonce}`;
    if (REPLAY_CACHE.has(replayKey)) {
      logWarn('Webhook replay attempt detected', { replayKey });
      return new NextResponse('Duplicate request', { status: 409 });
    }

    const body = await request.text();
    const webhookSecret = process.env.BULKVS_WEBHOOK_SECRET;
    
    if (!webhookSecret) {
      logError('BULKVS_WEBHOOK_SECRET not configured');
      return new NextResponse('Configuration error', { status: 500 });
    }

    // Verify signature with additional data
    const message = `${timestamp}:${nonce}:${body}`;
    const expectedSignature = crypto
      .createHmac('sha256', webhookSecret)
      .update(message)
      .digest('hex');

    if (signature !== expectedSignature) {
      logWarn('Invalid webhook signature', {
        expected: expectedSignature,
        received: signature,
      });
      return new NextResponse('Invalid signature', { status: 401 });
    }

    // Add to replay cache
    REPLAY_CACHE.add(replayKey);

    // Validate payload structure
    let data: any;
    try {
      data = JSON.parse(body);
      if (!data.call_id || !data.status) {
        throw new Error('Missing required fields');
      }
    } catch (error) {
      logWarn('Invalid webhook payload', { error, body });
      return new NextResponse('Invalid payload', { status: 400 });
    }

    // Process webhook
    await handleCallWebhook(data);

    return NextResponse.json({ success: true });
  } catch (error) {
    logError('Webhook processing error', { error });
    return new NextResponse('Internal error', { status: 500 });
  }
} 