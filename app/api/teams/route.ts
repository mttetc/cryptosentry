import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase";

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

    // Get teams user owns
    const { data: ownedTeams, error: ownedError } = await supabase
      .from('teams')
      .select('*, team_members(user_id, role)')
      .eq('owner_id', session.user.id);

    if (ownedError) throw ownedError;

    // Get teams user is a member of
    const { data: memberTeams, error: memberError } = await supabase
      .from('team_members')
      .select('teams(*, team_members(user_id, role)), role')
      .eq('user_id', session.user.id);

    if (memberError) throw memberError;

    const teams = {
      success: true,
      ownedTeams: ownedTeams || [],
      memberTeams: memberTeams.map((m) => ({ ...m.teams, userRole: m.role })),
    };

    return new NextResponse(
      JSON.stringify(teams),
      {
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-store, must-revalidate',
        },
      }
    );
  } catch (error) {
    console.error('Error fetching teams:', error);
    return new NextResponse(
      JSON.stringify({
        error: error instanceof Error ? error.message : 'Internal Server Error',
      }),
      { status: 500 }
    );
  }
} 