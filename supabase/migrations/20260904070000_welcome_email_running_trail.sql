-- E-mail de bienvenue à la validation d'un dossier : inviter l'adhérent
-- running/trail à créer son compte sur l'app du club.
--
-- ============================================================================
-- POURQUOI
-- ============================================================================
-- Demande de Matthieu du 2026-09-04 : beaucoup d'adhérents running/trail n'ont
-- jamais créé de compte dans l'app, faute d'avoir reçu le lien et le code
-- d'invitation au bon moment. Le bon moment, c'est la validation du dossier :
-- l'adhésion est réglée et actée, l'adhérent est dans une démarche active, et
-- c'est le club qui reprend la parole.
--
-- ============================================================================
-- CE QUI DÉCLENCHE, ET CE QUI NE DÉCLENCHE PAS
-- ============================================================================
-- Le signal est le passage de `status` à 'validated', c'est-à-dire la décision
-- du bureau dans l'espace bureau. Un paiement Stripe seul ne valide RIEN : le
-- webhook ne touche qu'au règlement (`payment_status`), la validation reste un
-- geste humain (règle du club du 2026-08-28 : régler d'abord, valider ensuite).
-- Un dossier payé en ligne déclenchera donc cet e-mail quand le bureau le
-- validera, pas à l'encaissement.
--
-- Quatre verrous, dans cet ordre :
--   1. transition SEULEMENT (OLD.status <> 'validated') : dévalider puis
--      revalider ne renvoie pas l'e-mail ;
--   2. section 'running_trail' UNIQUEMENT : la marche nordique n'est pas encore
--      dans l'app, inviter Fabienne et ses marcheurs serait une fausse piste.
--      Ouvrir à la marche nordique = retirer cette condition, ici et dans la
--      fonction Edge ;
--   3. `welcome_email_sent_at IS NULL` : jamais deux fois pour un dossier ;
--   4. la fonction Edge revérifie les trois précédents avant d'envoyer, et
--      c'est ELLE qui pose `welcome_email_sent_at`, après un envoi réussi
--      seulement. Poser l'horodatage ici l'aurait consommé même sur un échec
--      Resend, et l'adhérent n'aurait jamais rien reçu.
--
-- Le code d'invitation du club n'apparaît NULLE PART dans ce dépôt : la
-- fonction Edge le lit dans `club_settings.invite_code` au moment de l'envoi.
--
-- Migration additive et idempotente.


-- ============================================================================
-- 1. Trace d'envoi
-- ============================================================================
ALTER TABLE public.membership_seasons
  ADD COLUMN IF NOT EXISTS welcome_email_sent_at timestamptz;

COMMENT ON COLUMN public.membership_seasons.welcome_email_sent_at IS
  'Horodatage de l''e-mail de bienvenue (invitation a creer un compte sur l''app) envoye a la validation du dossier. NULL = jamais envoye. Pose par la fonction Edge membership-welcome apres un envoi reussi, jamais par le trigger : un echec Resend ne doit pas consommer l''unique tentative.';


-- ============================================================================
-- 2. Trigger de validation
-- ============================================================================
-- Même motif que `notify_membership_submitted` (entrée 40) : POST asynchrone
-- via pg_net, secrets lus dans Vault, lecture NON stricte pour qu'une base
-- neuve ou une panne de notification ne fasse jamais échouer la validation
-- d'un dossier. L'échec reste silencieux côté appelant, visible seulement dans
-- `net._http_response` : c'est assumé, une adhésion validée compte plus qu'un
-- e-mail parti.
CREATE OR REPLACE FUNCTION public.notify_membership_validated()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $fn$
DECLARE
  v_url text;
  v_key text;
BEGIN
  IF NEW.status <> 'validated'
     OR OLD.status = 'validated'
     OR NEW.section <> 'running_trail'
     OR NEW.welcome_email_sent_at IS NOT NULL THEN
    RETURN NEW;
  END IF;

  v_url := public.get_app_secret('supabase_url');
  v_key := public.get_app_secret('service_role_key');

  IF v_url IS NULL OR v_key IS NULL THEN
    RETURN NEW;
  END IF;

  PERFORM net.http_post(
    url := v_url || '/functions/v1/membership-welcome',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || v_key
    ),
    body := jsonb_build_object(
      'membership_season_id', NEW.id,
      'member_id', NEW.member_id
    )
  );

  RETURN NEW;
END;
$fn$;

REVOKE EXECUTE ON FUNCTION public.notify_membership_validated() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS on_membership_season_validated ON public.membership_seasons;
CREATE TRIGGER on_membership_season_validated
  AFTER UPDATE OF status ON public.membership_seasons
  FOR EACH ROW EXECUTE FUNCTION public.notify_membership_validated();

COMMENT ON FUNCTION public.notify_membership_validated() IS
  'Trigger AFTER UPDATE OF status sur membership_seasons : POST asynchrone (pg_net) vers la Edge Function membership-welcome quand un dossier running/trail passe a validated pour la premiere fois. Inerte si Vault ne contient pas supabase_url / service_role_key. EXECUTE revoque pour anon/authenticated/PUBLIC.';


-- ============================================================================
-- Hors périmètre, vérifié et volontairement non traité
-- ============================================================================
--   - Rien n'est envoyé pour les dossiers DÉJÀ validés avant cette migration
--     (le trigger ne voit que les transitions futures). Au 2026-09-04 aucun
--     dossier 2026-2027 n'est validé : la question ne se pose pas encore. Si
--     elle se posait, un rattrapage se ferait par un UPDATE ciblé qui rejoue
--     la transition, dossier par dossier et en conscience.
--   - Marche nordique exclue tant que la section n'existe pas dans l'app.
--   - Aucun renvoi possible depuis l'app : réinviter quelqu'un demande de
--     remettre `welcome_email_sent_at` à NULL puis de rejouer la transition.
--     À outiller dans l'espace bureau si le besoin devient réel.
