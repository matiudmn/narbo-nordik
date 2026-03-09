import { supabase } from './supabase';

const BUCKET = 'session-attachments';

export function getAttachmentUrl(path: string): string {
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return data.publicUrl;
}
