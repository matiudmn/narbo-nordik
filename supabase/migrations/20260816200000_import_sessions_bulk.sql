-- ============================================================================
-- Import d'une saison en lot : une seule notification par athlète (David, 16/08/2026)
-- ----------------------------------------------------------------------------
-- POURQUOI. Un import de saison crée ~340 lignes `sessions` d'un coup (38
-- semaines x 3 séances x 3 groupes). Le trigger `on_new_session` posant une
-- notification par ligne ET par athlète du groupe, chaque athlète recevrait une
-- centaine de notifications d'un seul geste du coach.
-- `import_sessions_bulk` insère les lignes en une transaction avec le drapeau
-- `app.bulk_import` posé (le trigger sort alors immédiatement) puis crée UNE
-- notification récapitulative par athlète concerné.
--
-- Additive et idempotente (CREATE OR REPLACE uniquement, aucun changement de
-- table). NE PAS APPLIQUER EN PROD SANS VALIDATION EXPLICITE DE MATTHIEU.
-- ============================================================================

-- ============================================================================
-- 1. notify_new_session() : sortie immédiate pendant un import en lot
-- ============================================================================
-- Corps repris VERBATIM du baseline (20260307000000, section 4), seul le
-- garde-fou en tête est ajouté : `current_setting(..., true)` renvoie NULL
-- (et non une erreur) quand le paramètre n'a jamais été posé, donc le
-- comportement hors import est strictement inchangé.
--
-- Le `search_path` reste volontairement non figé, comme dans le baseline : les
-- noms de tables ne sont pas qualifiés dans ce corps et le verrouiller
-- changerait le comportement de la fonction en prod. C'est un point d'advisor
-- connu, hors périmètre de ce fichier.
--
-- PIÈGE (cf. 20260810140000) : `CREATE OR REPLACE FUNCTION` réassigne toutes
-- les propriétés de la fonction sauf le propriétaire et les DROITS. Le REVOKE
-- de 20260514085447 survit donc ; il est rejoué ci-dessous par sécurité.
CREATE OR REPLACE FUNCTION public.notify_new_session()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  target_user RECORD;
BEGIN
  -- Import en lot : la notification récapitulative est posée par
  -- public.import_sessions_bulk(), une seule fois par athlète.
  IF current_setting('app.bulk_import', true) = 'on' THEN
    RETURN NEW;
  END IF;

  IF NEW.group_id IS NULL THEN
    RETURN NEW;
  END IF;

  FOR target_user IN
    SELECT id, notification_preferences
    FROM users
    WHERE id != NEW.created_by
      AND group_id = NEW.group_id
      AND role = 'athlete'
  LOOP
    IF (target_user.notification_preferences->'new_session'->>'in_app')::boolean IS NOT FALSE THEN
      INSERT INTO notifications (user_id, type, title, body, link)
      VALUES (target_user.id, 'new_session', 'Nouvelle seance', NEW.title, '/session/' || NEW.id);
    END IF;
  END LOOP;
  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.notify_new_session() FROM PUBLIC, anon, authenticated;

-- ============================================================================
-- 2. import_sessions_bulk(p_rows jsonb) : insertion en lot + notification unique
-- ============================================================================
-- Même garde que `get_users_for_coach()` (20260731120000) : réservée aux coachs
-- et au super-admin, `SECURITY DEFINER` + `SET search_path = ''` + noms
-- qualifiés (pas de nouvel advisor).
--
-- `created_by` est FORCÉ à auth.uid() : le client ne peut pas signer un import
-- au nom d'un autre coach, même en trafiquant le payload.
--
-- `set_config(..., is_local => true)` : le drapeau vit le temps de la
-- transaction et retombe au COMMIT comme au ROLLBACK. Il n'est donc jamais
-- visible d'une autre requête, et un échec en cours d'insertion ne laisse pas
-- le trigger désarmé.
CREATE OR REPLACE FUNCTION public.import_sessions_bulk(p_rows jsonb)
RETURNS SETOF public.sessions
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid uuid := (SELECT auth.uid());
  v_ids uuid[];
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.users
    WHERE id = v_uid AND (role = 'coach' OR is_super_admin = true)
  ) THEN
    RAISE EXCEPTION 'Réservé aux coachs et au super-admin.' USING ERRCODE = '42501';
  END IF;

  IF p_rows IS NULL OR jsonb_typeof(p_rows) <> 'array' OR jsonb_array_length(p_rows) = 0 THEN
    RAISE EXCEPTION 'Aucune séance à importer.' USING ERRCODE = '22023';
  END IF;

  PERFORM set_config('app.bulk_import', 'on', true);

  WITH src AS (
    SELECT * FROM jsonb_to_recordset(p_rows) AS r(
      date timestamptz,
      title text,
      session_type text,
      terrain_options jsonb,
      location text,
      location_url text,
      description text,
      group_id uuid,
      preparation_id uuid,
      target_distance integer,
      vma_percent_min integer,
      vma_percent_max integer,
      blocks jsonb,
      is_personal boolean,
      session_rpe integer
    )
  ), ins AS (
    INSERT INTO public.sessions (
      date, title, session_type, terrain_options, location, location_url,
      description, group_id, preparation_id, target_distance,
      vma_percent_min, vma_percent_max, blocks, is_personal, session_rpe,
      created_by
    )
    SELECT
      src.date,
      src.title,
      coalesce(src.session_type, 'entrainement'),
      coalesce(src.terrain_options, '[]'::jsonb),
      src.location,
      src.location_url,
      src.description,
      src.group_id,
      src.preparation_id,
      src.target_distance,
      src.vma_percent_min,
      src.vma_percent_max,
      coalesce(src.blocks, '[]'::jsonb),
      coalesce(src.is_personal, false),
      src.session_rpe,
      v_uid
    FROM src
    RETURNING id, date, group_id
  ),
  -- Récapitulatif PAR ATHLÈTE : chacun ne compte que les lignes qui le
  -- concernent, celles de son groupe plus les séances globales (group_id NULL,
  -- visibles par tout le club). La jointure élimine d'elle-même les athlètes
  -- sans aucune ligne visible. Le coach auteur est exclu, comme dans
  -- notify_new_session, et la préférence in_app est respectée.
  recap AS (
    SELECT u.id AS user_id, count(*) AS n, max(ins.date) AS last_date
    FROM public.users u
    JOIN ins ON ins.group_id IS NULL OR ins.group_id = u.group_id
    WHERE u.role = 'athlete'
      AND u.id IS DISTINCT FROM v_uid
      AND (u.notification_preferences->'new_session'->>'in_app')::boolean IS NOT FALSE
    GROUP BY u.id
  ),
  notified AS (
    INSERT INTO public.notifications (user_id, type, title, body, link)
    SELECT
      recap.user_id,
      'new_session',
      'Programme mis à jour',
      recap.n || ' séance' || CASE WHEN recap.n > 1 THEN 's' ELSE '' END
        || ' ajoutée' || CASE WHEN recap.n > 1 THEN 's' ELSE '' END
        || ' jusqu''au ' || to_char(recap.last_date, 'DD/MM/YYYY'),
      '/'
    FROM recap
  )
  SELECT array_agg(ins.id) INTO v_ids FROM ins;

  RETURN QUERY SELECT * FROM public.sessions WHERE id = ANY (v_ids) ORDER BY date;
END;
$$;

REVOKE ALL ON FUNCTION public.import_sessions_bulk(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.import_sessions_bulk(jsonb) TO authenticated;
