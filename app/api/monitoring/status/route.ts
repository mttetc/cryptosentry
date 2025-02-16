import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase";
import { experimental_taintObjectReference } from "react";

export const runtime = "edge";
export const dynamic = "force-dynamic";

// Get the monitoring state from the module
let monitoringState = {
  isActive: false,
  lastError: null as Error | null,
  startTime: null as number | null,
};

export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { session } } = await supabase.auth.getSession();

    if (!session?.user.id) {
      return new NextResponse(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401 }
      );
    }

    // Check if user is admin
    const { data: user } = await supabase
      .from('users')
      .select('role')
      .eq('id', session.user.id)
      .single();

    if (user?.role !== 'admin') {
      return new NextResponse(
        JSON.stringify({ error: "Forbidden" }),
        { status: 403 }
      );
    }

    const status = {
      success: true,
      status: monitoringState.isActive ? 'active' : 'inactive',
      startTime: monitoringState.startTime,
      lastError: monitoringState.lastError?.message,
      uptime: monitoringState.startTime ? Date.now() - monitoringState.startTime : 0,
    };

    // Prevent sensitive monitoring data from being passed to client
    experimental_taintObjectReference(
      'Do not pass internal monitoring state to client',
      status
    );

    return new NextResponse(JSON.stringify(status), {
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store, must-revalidate',
      },
    });
  } catch (error) {
    console.error('Error getting monitoring status:', error);
    return new NextResponse(
      JSON.stringify({
        error: error instanceof Error ? error.message : 'Internal Server Error',
      }),
      { status: 500 }
    );
  }
} 