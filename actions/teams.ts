import { z } from 'zod';
import { createServerSupabaseClient } from '@/lib/supabase';

const teamSchema = z.object({
  name: z.string().min(1).max(100),
});

const memberSchema = z.object({
  email: z.string().email(),
  role: z.enum(['admin', 'member', 'viewer']),
});

export type TeamState = {
  error?: string;
  success?: boolean;
  teamId?: string;
};

export async function createTeam(prevState: TeamState, formData: FormData): Promise<TeamState> {
  try {
    const validatedFields = teamSchema.parse({
      name: formData.get('name'),
    });

    const supabase = await createServerSupabaseClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      throw new Error('Unauthorized');
    }

    const { data: team, error } = await supabase
      .from('teams')
      .insert({
        name: validatedFields.name,
        owner_id: session.user.id,
      })
      .select()
      .single();

    if (error) throw error;

    return {
      success: true,
      teamId: team.id,
    };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : 'Failed to create team',
    };
  }
}

export async function inviteMember(
  teamId: string,
  prevState: TeamState,
  formData: FormData
): Promise<TeamState> {
  try {
    const validatedFields = memberSchema.parse({
      email: formData.get('email'),
      role: formData.get('role'),
    });

    const supabase = await createServerSupabaseClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      throw new Error('Unauthorized');
    }

    // Check if user exists
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('id')
      .eq('email', validatedFields.email)
      .single();

    if (userError) {
      // User doesn't exist, send invitation email
      const { error: inviteError } = await supabase.auth.signInWithOtp({
        email: validatedFields.email,
        options: {
          data: {
            teamId,
            role: validatedFields.role,
            invitedBy: session.user.id,
          },
        },
      });

      if (inviteError) throw inviteError;
    } else {
      // User exists, add them to the team
      const { error: memberError } = await supabase.from('team_members').insert({
        team_id: teamId,
        user_id: user.id,
        role: validatedFields.role,
      });

      if (memberError) throw memberError;
    }

    return { success: true };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : 'Failed to invite member',
    };
  }
}

export async function updateMemberRole(
  teamId: string,
  userId: string,
  role: 'admin' | 'member' | 'viewer'
): Promise<TeamState> {
  try {
    const supabase = await createServerSupabaseClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      throw new Error('Unauthorized');
    }

    // Check if current user has permission
    const { data: hasPermission } = await supabase.rpc('check_team_role', {
      _team_id: teamId,
      _user_id: session.user.id,
      _required_role: 'admin',
    });

    if (!hasPermission) {
      throw new Error('Insufficient permissions');
    }

    const { error } = await supabase
      .from('team_members')
      .update({ role })
      .eq('team_id', teamId)
      .eq('user_id', userId);

    if (error) throw error;

    return { success: true };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : 'Failed to update member role',
    };
  }
}

export async function removeMember(teamId: string, userId: string): Promise<TeamState> {
  try {
    const supabase = await createServerSupabaseClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      throw new Error('Unauthorized');
    }

    // Check if current user has permission
    const { data: hasPermission } = await supabase.rpc('check_team_role', {
      _team_id: teamId,
      _user_id: session.user.id,
      _required_role: 'admin',
    });

    if (!hasPermission) {
      throw new Error('Insufficient permissions');
    }

    const { error } = await supabase
      .from('team_members')
      .delete()
      .eq('team_id', teamId)
      .eq('user_id', userId);

    if (error) throw error;

    return { success: true };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : 'Failed to remove member',
    };
  }
}

export async function getUserTeams() {
  try {
    const supabase = await createServerSupabaseClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      throw new Error('Unauthorized');
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

    return {
      success: true,
      ownedTeams,
      memberTeams: memberTeams.map((m) => ({ ...m.teams, userRole: m.role })),
    };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : 'Failed to fetch teams',
    };
  }
}
