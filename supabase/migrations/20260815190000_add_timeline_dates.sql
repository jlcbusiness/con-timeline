-- Add calendar bounds to timelines so the app can render each user's ranges from the backend.

BEGIN;

ALTER TABLE timelines
  ADD COLUMN IF NOT EXISTS start_date timestamptz,
  ADD COLUMN IF NOT EXISTS end_date timestamptz;

UPDATE timelines
SET
  start_date = COALESCE(start_date, '2025-08-27T01:00:00Z'::timestamptz),
  end_date = COALESCE(end_date, '2025-09-02T23:00:00Z'::timestamptz);

ALTER TABLE timelines
  ALTER COLUMN start_date SET DEFAULT '2025-08-27T01:00:00Z'::timestamptz,
  ALTER COLUMN end_date SET DEFAULT '2025-09-02T23:00:00Z'::timestamptz,
  ALTER COLUMN start_date SET NOT NULL,
  ALTER COLUMN end_date SET NOT NULL;

COMMIT;