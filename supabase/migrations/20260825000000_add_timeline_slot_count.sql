-- Add configurable slot counts to timelines.

BEGIN;

DO $$
BEGIN
  IF to_regclass('public.timelines') IS NOT NULL THEN
    ALTER TABLE timelines
      ADD COLUMN IF NOT EXISTS slot_count integer;

    UPDATE timelines
    SET slot_count = COALESCE(slot_count, 11);

    ALTER TABLE timelines
      ALTER COLUMN slot_count SET DEFAULT 11,
      ALTER COLUMN slot_count SET NOT NULL;
  END IF;
END
$$;

COMMIT;