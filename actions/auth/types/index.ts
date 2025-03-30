import { z } from 'zod';

export const signUpSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  phone: z.string().regex(/^\+[1-9]\d{1,14}$/, {
    message: 'Phone number must be in E.164 format (e.g., +33612345678)',
  }),
});

export const signInSchema = z.object({
  email: z.string().email(),
  password: z.string(),
});

export type AuthState = {
  error?: string;
  success?: boolean;
};
