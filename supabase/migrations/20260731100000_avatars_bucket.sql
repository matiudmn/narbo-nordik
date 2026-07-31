-- Bucket storage "avatars" pour les photos de profil (constat perf audit
-- 2026-07-31) : jusqu'ici les photos etaient stockees en base64 dans
-- users.photo_url et donc transferees a TOUS les membres a chaque
-- `select('*') from users` (DataContext.fetchAll), quel que soit le profil
-- consulte. Ce bucket permet a l'app de stocker un fichier et de ne plus
-- transporter que son URL publique dans photo_url.
--
-- Additive et idempotente (ON CONFLICT / DROP POLICY IF EXISTS). NON
-- appliquee a la prod : aucun apply_migration execute pendant sa redaction,
-- attend une revue puis un `supabase db push`.
--
-- Chemin des objets : <user_id>/avatar.<ext> (un seul avatar par
-- utilisateur, ecrase via upsert cote app). Meme motif de policy que le
-- bucket session-attachments (20260730120000_security_perf_hardening.sql) :
-- dossier racine = auth.uid(), auth.uid() encapsule dans un (select ...)
-- pour eviter la reevaluation par ligne (auth_rls_initplan).

INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;

-- Pas de policy SELECT : bucket public, l'app lit uniquement via
-- getPublicUrl() (route publique de Storage, hors RLS). Aucun listing donne
-- aux clients authentifies, contrairement a session-attachments avant son
-- durcissement.

DROP POLICY IF EXISTS "Users can upload their own avatar" ON storage.objects;
CREATE POLICY "Users can upload their own avatar"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = (select auth.uid())::text
  );

DROP POLICY IF EXISTS "Users can update their own avatar" ON storage.objects;
CREATE POLICY "Users can update their own avatar"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = (select auth.uid())::text
  );

DROP POLICY IF EXISTS "Users can delete their own avatar" ON storage.objects;
CREATE POLICY "Users can delete their own avatar"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = (select auth.uid())::text
  );
