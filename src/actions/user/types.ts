import { z } from 'zod';
import { notificationPreferencesSchema } from './types/index';

export type UserPreferences = z.infer<typeof notificationPreferencesSchema>;

export interface UserState {
  success: boolean;
  error?: string;
}

// Re-export the schema for convenience
export { notificationPreferencesSchema };
