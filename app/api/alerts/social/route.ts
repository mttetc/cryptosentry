import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase";
import { experimental_taintObjectReference } from "react";

export const runtime = "edge";
export const dynamic = "force-dynamic";

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

    // Get platform and keyword from query params
    const { searchParams } = new URL(request.url);
    const platform = searchParams.get('platform');
    const keyword = searchParams.get('keyword');

    // Build query
    let query = supabase
      .from('social_alerts')
      .select('*')
      .eq('user_id', session.user.id)
      .eq('active', true);

    if (platform) {
      query = query.eq('platform', platform);
    }
    if (keyword) {
      query = query.ilike('keyword', `%${keyword}%`);
    }

    const { data: alerts, error } = await query;

    if (error) throw error;

    // Get latest social monitoring data
    const { data: monitoring } = await supabase
      .from('social_monitoring')
      .select('*')
      .in('platform', alerts?.map(a => a.platform) || [])
      .order('last_checked', { ascending: false });

    const response = {
      success: true,
      alerts: alerts || [],
      monitoring: monitoring || [],
    };

    // Prevent sensitive data from being exposed
    experimental_taintObjectReference(
      'Do not pass raw social data to client',
      response
    );

    return new NextResponse(
      JSON.stringify(response),
      {
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-store, must-revalidate',
        },
      }
    );
  } catch (error) {
    console.error('Error fetching social alerts:', error);
    return new NextResponse(
      JSON.stringify({
        error: error instanceof Error ? error.message : 'Internal Server Error',
      }),
      { status: 500 }
    );
  }
} 