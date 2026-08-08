/**
 * Effets de notification declenches par une reaction sociale (nordik sur une
 * seance, emoji sur un compte-rendu). Fonctions autonomes (pas des hooks) :
 * aucun state React, juste une lecture puis une ecriture Supabase.
 */
import { supabase } from '../../lib/supabase';
import { captureError } from '../../lib/monitoring';

export async function notifySessionNordik(sessionId: string, userId: string): Promise<void> {
  const [{ data: session }, { data: actor }] = await Promise.all([
    supabase.from('sessions').select('created_by, title').eq('id', sessionId).single(),
    supabase.from('users').select('firstname').eq('id', userId).single(),
  ]);
  if (session && actor && session.created_by !== userId) {
    const { error: notifError } = await supabase.from('notifications').insert({
      user_id: session.created_by,
      type: 'system',
      title: 'Nordik !',
      body: `${actor.firstname} a aime ta seance "${session.title}"`,
    });
    if (notifError) captureError('Notification error', notifError);
  }
}

export async function notifyValidationReaction(validationId: string, emoji: string, authorId: string): Promise<void> {
  // Notifier le propriétaire du compte-rendu (sauf s'il réagit au sien).
  const { data: val } = await supabase.from('session_validations').select('user_id, session_id').eq('id', validationId).single();
  if (val && val.user_id !== authorId) {
    const [{ data: sess }, { data: actor }] = await Promise.all([
      supabase.from('sessions').select('title').eq('id', val.session_id).single(),
      supabase.from('users').select('firstname').eq('id', authorId).single(),
    ]);
    const { error: notifError } = await supabase.from('notifications').insert({
      user_id: val.user_id,
      type: 'reaction',
      title: 'Réaction !',
      body: `${actor?.firstname ?? "Quelqu'un"} a réagi ${emoji} à ton compte-rendu${sess?.title ? ` "${sess.title}"` : ''}`,
    });
    if (notifError) captureError('Notification error', notifError);
  }
}
