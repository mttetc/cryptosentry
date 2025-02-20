import { NextRequest, NextResponse } from "next/server";
import { telnyxProvider } from "@/actions/messaging/providers/telnyx";

export const runtime = "edge";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const signature = request.headers.get('telnyx-signature-ed25519') || '';
    const timestamp = request.headers.get('telnyx-timestamp') || '';
    const body = await request.text();

    // Validate webhook
    const isValid = telnyxProvider.validateWebhook(signature, body, timestamp);
    if (!isValid) {
      return new NextResponse(
        JSON.stringify({ error: "Invalid webhook signature" }),
        { status: 401 }
      );
    }

    const data = JSON.parse(body);
    await telnyxProvider.handleCallWebhook(data);

    return new NextResponse(
      JSON.stringify({ success: true }),
      { status: 200 }
    );
  } catch (error) {
    console.error('Error handling webhook:', error);
    return new NextResponse(
      JSON.stringify({
        error: error instanceof Error ? error.message : 'Internal Server Error',
      }),
      { status: 500 }
    );
  }
} 