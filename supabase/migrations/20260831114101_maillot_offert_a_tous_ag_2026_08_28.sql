-- AG du 28 août 2026 : le maillot du club est offert à tous les adhérents.
-- Backfill des dossiers 2026-2027 créés avant la décision (9 lignes au moment
-- de l'application, toutes en marche nordique), et réécriture de la
-- documentation qui décrivait l'ancienne règle (tee-shirt avant le 1er
-- octobre, ou tous les 5 ans).

UPDATE public.membership_seasons
SET tshirt_included = true
WHERE season = '2026-2027' AND tshirt_included = false;

COMMENT ON TABLE public.membership_seasons IS
  'Une adhesion pour une saison donnee (UNIQUE member_id + season). Separee de members parce que l''adhesion se renouvelle chaque saison ; l''historique des saisons et des maillots fournis se lit ici.';

COMMENT ON COLUMN public.membership_seasons.tshirt_included IS
  'true quand le maillot du club est offert sur cette adhesion. Depuis l''AG du 28 aout 2026, il est offert a tous les adherents (saison 2026-2027 backfillee).';
