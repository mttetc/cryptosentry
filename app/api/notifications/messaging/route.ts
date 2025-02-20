import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase";
import { experimental_taintObjectReference } from "react";
import { telnyxProvider } from "@/actions/messaging/providers/telnyx";

export const runtime = "edge";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { session } } = await supabase.auth.getSession();

    if (!session?.user.id) {
      return new NextResponse(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401 }
      );
    }

    const body = await request.json();
    const { type, phone, message, isEmergency } = body;

    if (!type || !phone || !message) {
      return new NextResponse(
        JSON.stringify({ error: "Missing required fields" }),
        { status: 400 }
      );
    }

    let result;
    if (type === 'call') {
      result = await telnyxProvider.makeCall({
        userId: session.user.id,
        phone,
        message,
        isEmergency,
      });
    } else if (type === 'sms') {
      result = await telnyxProvider.sendSMS({
        userId: session.user.id,
        phone,
        message,
        isEmergency,
      });
    } else {
      return new NextResponse(
        JSON.stringify({ error: "Invalid notification type" }),
        { status: 400 }
      );
    }

    if (result.error) {
      return new NextResponse(
        JSON.stringify({ error: result.error }),
        { status: 400 }
      );
    }

    // Store notification in history
    await supabase
      .from('notification_history')
      .insert({
        user_id: session.user.id,
        type,
        phone,
        message,
        status: 'sent',
      });

    return new NextResponse(
      JSON.stringify({
        success: true,
        ...result,
      }),
      {
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );
  } catch (error) {
    console.error('Error sending notification:', error);
    return new NextResponse(
      JSON.stringify({
        error: error instanceof Error ? error.message : 'Internal Server Error',
      }),
      { status: 500 }
    );
  }
} 