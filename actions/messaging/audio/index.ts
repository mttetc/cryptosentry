'use server';

import { createServerSupabaseClient } from '@/lib/supabase/server';
import { audioSchema, type AudioState } from './schemas';

export async function saveCustomAudio(_: AudioState, formData: FormData): Promise<AudioState> {
  try {
    const file = formData.get('file') as Blob;
    const validatedFields = audioSchema.parse({
      name: formData.get('name'),
      file,
      duration: parseFloat(formData.get('duration') as string),
      isLoopable: formData.get('isLoopable') === 'true',
      isEmergency: formData.get('isEmergency') === 'true',
    });

    const supabase = await createServerSupabaseClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      throw new Error('Unauthorized');
    }

    // Upload to Supabase Storage
    const fileName = `${session.user.id}/${Date.now()}-${validatedFields.name.replace(/\s+/g, '-')}`;
    const { error: uploadError, data } = await supabase.storage
      .from('alert-sounds')
      .upload(fileName, validatedFields.file, {
        contentType: validatedFields.file.type,
        cacheControl: '3600',
      });

    if (uploadError) throw uploadError;

    // Get public URL
    const {
      data: { publicUrl },
    } = supabase.storage.from('alert-sounds').getPublicUrl(fileName);

    // Save audio metadata
    const { error: dbError } = await supabase.from('custom_sounds').insert({
      user_id: session.user.id,
      name: validatedFields.name,
      file_path: fileName,
      public_url: publicUrl,
      duration: validatedFields.duration,
      is_loopable: validatedFields.isLoopable,
      is_emergency: validatedFields.isEmergency,
    });

    if (dbError) throw dbError;

    return {
      success: true,
      audioUrl: publicUrl,
    };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : 'Failed to save audio',
    };
  }
}

export async function deleteSound(soundId: string) {
  try {
    const supabase = await createServerSupabaseClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      throw new Error('Unauthorized');
    }

    // Get sound details first
    const { data: sound, error: fetchError } = await supabase
      .from('custom_sounds')
      .select('file_path')
      .eq('id', soundId)
      .eq('user_id', session.user.id)
      .single();

    if (fetchError) throw fetchError;

    // Delete from storage
    const { error: storageError } = await supabase.storage
      .from('alert-sounds')
      .remove([sound.file_path]);

    if (storageError) throw storageError;

    // Delete from database
    const { error: dbError } = await supabase
      .from('custom_sounds')
      .delete()
      .eq('id', soundId)
      .eq('user_id', session.user.id);

    if (dbError) throw dbError;

    return { success: true };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : 'Failed to delete sound',
    };
  }
}
