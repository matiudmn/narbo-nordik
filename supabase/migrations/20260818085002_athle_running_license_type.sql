-- Nouvelle licence FFA « Athlé Running » (165 €) pour la section
-- running_trail, à côté de l'Athlé Compétition (180 €) — décision du club du
-- 2026-08-18. Valeur 'running' ajoutée au CHECK de license_type ; 'sante' et
-- 'competition' restent pour la marche nordique, 'competition' est partagé.
ALTER TABLE public.membership_seasons
  DROP CONSTRAINT membership_seasons_license_type_check;

ALTER TABLE public.membership_seasons
  ADD CONSTRAINT membership_seasons_license_type_check CHECK (
    license_type = ANY (ARRAY['sante', 'competition', 'running'])
  );
