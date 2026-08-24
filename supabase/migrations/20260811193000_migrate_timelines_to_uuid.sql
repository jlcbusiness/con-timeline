-- Migration: convert timelines.id from text -> uuid and remap referencing tables
-- Run as a single transaction. Back up DB before running.

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'timelines'
      AND column_name = 'id'
      AND data_type <> 'uuid'
  )
  AND EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'events'
      AND column_name = 'timeline_id'
      AND data_type <> 'uuid'
  )
  AND EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'locations'
      AND column_name = 'timeline_id'
      AND data_type <> 'uuid'
  ) THEN
    -- 1) Create new uuid column on timelines
    ALTER TABLE timelines ADD COLUMN IF NOT EXISTS new_id uuid DEFAULT gen_random_uuid();
    UPDATE timelines SET new_id = gen_random_uuid() WHERE new_id IS NULL;

    -- 2) Add new uuid columns on referencing tables and populate from mapping
    ALTER TABLE events ADD COLUMN IF NOT EXISTS new_timeline_id uuid;
    UPDATE events SET new_timeline_id = t.new_id
      FROM timelines t WHERE events.timeline_id = t.id;

    ALTER TABLE locations ADD COLUMN IF NOT EXISTS new_timeline_id uuid;
    UPDATE locations SET new_timeline_id = t.new_id
      FROM timelines t WHERE locations.timeline_id = t.id;

    -- 3) Drop FK constraints referencing old text id (if present)
    ALTER TABLE events DROP CONSTRAINT IF EXISTS events_timeline_id_fkey;
    ALTER TABLE locations DROP CONSTRAINT IF EXISTS locations_timeline_id_fkey;

    -- 4) Swap columns on referencing tables
    ALTER TABLE events DROP COLUMN IF EXISTS timeline_id;
    ALTER TABLE events RENAME COLUMN new_timeline_id TO timeline_id;

    ALTER TABLE locations DROP COLUMN IF EXISTS timeline_id;
    ALTER TABLE locations RENAME COLUMN new_timeline_id TO timeline_id;

    -- 5) Replace primary key on timelines
    ALTER TABLE timelines DROP CONSTRAINT IF EXISTS timelines_pkey;
    ALTER TABLE timelines DROP COLUMN IF EXISTS id;
    ALTER TABLE timelines RENAME COLUMN new_id TO id;
    ALTER TABLE timelines ADD PRIMARY KEY (id);

    -- 6) Recreate FK constraints and indexes
    CREATE INDEX IF NOT EXISTS idx_events_timeline_id ON events(timeline_id);
    CREATE INDEX IF NOT EXISTS idx_locations_timeline_id ON locations(timeline_id);
    ALTER TABLE events ADD CONSTRAINT events_timeline_id_fkey FOREIGN KEY (timeline_id) REFERENCES timelines(id) ON DELETE CASCADE;
    ALTER TABLE locations ADD CONSTRAINT locations_timeline_id_fkey FOREIGN KEY (timeline_id) REFERENCES timelines(id) ON DELETE CASCADE;
  END IF;
END
$$;

COMMIT;

-- End migration
