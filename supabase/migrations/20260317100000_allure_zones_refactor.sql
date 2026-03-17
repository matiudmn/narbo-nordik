-- Migrate allure zones in existing session blocks:
-- 'endurance' -> 'ef', 'am' -> 'ef' (am was redundant with AS42)
-- This updates the JSONB blocks column in sessions table.

UPDATE sessions
SET blocks = (
  SELECT jsonb_agg(
    CASE
      WHEN elem->>'allure' IN ('endurance', 'am')
      THEN jsonb_set(elem, '{allure}', '"ef"')
      ELSE elem
    END
  )
  FROM jsonb_array_elements(blocks::jsonb) AS elem
)
WHERE blocks::text LIKE '%"endurance"%'
   OR blocks::text LIKE '%"am"%';
