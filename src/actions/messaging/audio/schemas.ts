import { z } from 'zod';

export const audioSchema = z.object({
  name: z.string().min(1),
  file: z
    .instanceof(Blob)
    .refine(
      (file) => ['audio/mpeg', 'audio/wav'].includes(file.type),
      'Only MP3 and WAV files are allowed'
    ),
  duration: z.number().min(1).max(30), // Max 30 seconds
  isLoopable: z.boolean().default(false),
  isEmergency: z.boolean().default(false),
});

export type AudioState = {
  error?: string;
  success?: boolean;
  audioUrl?: string;
};
