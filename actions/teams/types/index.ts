import { z } from 'zod';

export const teamSchema = z.object({
  name: z.string().min(1).max(100),
});

export const memberSchema = z.object({
  email: z.string().email(),
  role: z.enum(['admin', 'member', 'viewer']),
});

export type TeamState = {
  error?: string;
  success?: boolean;
  teamId?: string;
};

export type TeamRole = 'admin' | 'member' | 'viewer'; 