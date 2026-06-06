-- Security hardening — matérialisation d'une migration appliquée via le
-- dashboard Supabase (version 20260514085447) qui n'avait jamais été capturée
-- en fichier. Détectée lors de la réconciliation du registre de migrations
-- (audit, juin 2026).
--
-- Sans ce fichier, un rebuild from-scratch (supabase db reset) laisserait des
-- fonctions sensibles exécutables par PUBLIC/anon/authenticated — notamment
-- delete_auth_user(). On rejoue donc le durcissement réel de la prod.
--
-- Toutes les fonctions visées existent au moment de cette migration :
--   - notify_* / delete_auth_user : créées dans le baseline (20260307000000)
--   - match/unmatch_strava_activity : créées dans 20260317220000

REVOKE EXECUTE ON FUNCTION public.delete_auth_user()        FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_email_on_insert()  FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_new_palmares()     FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_new_session()      FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_vma_update()       FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.match_strava_activity(uuid, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.unmatch_strava_activity(uuid)     FROM PUBLIC, anon;

-- Policy d'insertion notifications (alignée sur le live ; idempotente).
DROP POLICY IF EXISTS "System can insert notifications" ON public.notifications;
DROP POLICY IF EXISTS "Authenticated can insert notifications" ON public.notifications;
CREATE POLICY "Authenticated can insert notifications" ON public.notifications
  FOR INSERT TO authenticated
  WITH CHECK (true);
