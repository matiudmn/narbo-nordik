-- Tailles tee-shirt femme en lettres (S-XL), décision du club du 2026-08-18 :
-- le formulaire web n'envoie plus que S/M/L/XL pour le modèle femme. Les
-- anciennes tailles numériques ERIMA (34-48) restent acceptées : 3 dossiers
-- existants en portent encore, et un CHECK est réévalué à chaque UPDATE de la
-- ligne (la validation d'un dossier par le bureau ne doit pas casser).
ALTER TABLE public.membership_seasons
  DROP CONSTRAINT membership_seasons_tshirt_size_check;

ALTER TABLE public.membership_seasons
  ADD CONSTRAINT membership_seasons_tshirt_size_check CHECK (
    tshirt_size IS NULL
    OR (tshirt_model = 'femme' AND tshirt_size = ANY (ARRAY[
      'S', 'M', 'L', 'XL',
      '34', '36', '38', '40', '42', '44', '46', '48'
    ]))
    OR (tshirt_model = 'homme' AND tshirt_size = ANY (ARRAY['S', 'M', 'L', 'XL', 'XXL']))
  );
