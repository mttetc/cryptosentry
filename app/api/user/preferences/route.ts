import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase";
import { z } from 'zod';

const preferencesSchema = z.object({
  active_24h: z.boolean(),
  quiet_hours_start: z.string().nullable(),
  quiet_hours_end: z.string().nullable(),
  weekends_enabled: z.boolean(),
  prefer_sms: z.boolean(),
});

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

    const { data, error } = await supabase
      .from('users')
      .select('active_24h, quiet_hours_start, quiet_hours_end, weekends_enabled, prefer_sms')
      .eq('id', session.user.id)
      .single();

    if (error) throw error;

    const preferences = preferencesSchema.parse(data);

    return new NextResponse(
      JSON.stringify(preferences),
      {
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-store',
        },
      }
    );
  } catch (error) {
    console.error('Error fetching preferences:', error);
    return new NextResponse(
      JSON.stringify({
        error: error instanceof Error ? error.message : 'Internal Server Error',
      }),
      { status: 500 }
    );
  }
} 