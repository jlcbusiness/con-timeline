-- Create the current Con-Timeline schema for an online Supabase project.
-- This matches the app's current expectations for timelines, events, and locations.

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Timelines
CREATE TABLE IF NOT EXISTS timelines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  name text NOT NULL,
  start_date timestamptz NOT NULL,
  end_date timestamptz NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  archived boolean DEFAULT false,
  archived_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_timelines_user_id ON timelines(user_id);

-- Events
CREATE TABLE IF NOT EXISTS events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  timeline_id uuid REFERENCES timelines(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  start_time timestamptz NOT NULL,
  end_time timestamptz NOT NULL,
  position integer DEFAULT 0,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_events_timeline_id ON events(timeline_id);
CREATE INDEX IF NOT EXISTS idx_events_user_id ON events(user_id);
CREATE INDEX IF NOT EXISTS idx_events_timeline_start ON events(timeline_id, start_time);

-- Locations
CREATE TABLE IF NOT EXISTS locations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  timeline_id uuid REFERENCES timelines(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  name text NOT NULL,
  details jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_locations_timeline_id ON locations(timeline_id);
CREATE INDEX IF NOT EXISTS idx_locations_user_id ON locations(user_id);

GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE timelines, events, locations TO authenticated;

-- Timestamp trigger helper.
CREATE OR REPLACE FUNCTION trigger_set_timestamp()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_timelines_timestamp ON timelines;
DROP TRIGGER IF EXISTS trg_events_timestamp ON events;
DROP TRIGGER IF EXISTS trg_locations_timestamp ON locations;

CREATE TRIGGER trg_timelines_timestamp
BEFORE UPDATE ON timelines
FOR EACH ROW EXECUTE PROCEDURE trigger_set_timestamp();

CREATE TRIGGER trg_events_timestamp
BEFORE UPDATE ON events
FOR EACH ROW EXECUTE PROCEDURE trigger_set_timestamp();

CREATE TRIGGER trg_locations_timestamp
BEFORE UPDATE ON locations
FOR EACH ROW EXECUTE PROCEDURE trigger_set_timestamp();

-- Row level security.
ALTER TABLE timelines ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS timeline_select_policy ON timelines;
DROP POLICY IF EXISTS timeline_insert_policy ON timelines;
DROP POLICY IF EXISTS timeline_update_policy ON timelines;
DROP POLICY IF EXISTS timeline_delete_policy ON timelines;
CREATE POLICY timeline_select_policy ON timelines
  FOR SELECT USING (user_id = auth.uid());
CREATE POLICY timeline_insert_policy ON timelines
  FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY timeline_update_policy ON timelines
  FOR UPDATE USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY timeline_delete_policy ON timelines
  FOR DELETE USING (user_id = auth.uid());

ALTER TABLE events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS events_select_policy ON events;
DROP POLICY IF EXISTS events_insert_policy ON events;
DROP POLICY IF EXISTS events_update_policy ON events;
DROP POLICY IF EXISTS events_delete_policy ON events;
CREATE POLICY events_select_policy ON events
  FOR SELECT USING (user_id = auth.uid());
CREATE POLICY events_insert_policy ON events
  FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY events_update_policy ON events
  FOR UPDATE USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY events_delete_policy ON events
  FOR DELETE USING (user_id = auth.uid());

ALTER TABLE locations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS locations_select_policy ON locations;
DROP POLICY IF EXISTS locations_insert_policy ON locations;
DROP POLICY IF EXISTS locations_update_policy ON locations;
DROP POLICY IF EXISTS locations_delete_policy ON locations;
CREATE POLICY locations_select_policy ON locations
  FOR SELECT USING (user_id = auth.uid());
CREATE POLICY locations_insert_policy ON locations
  FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY locations_update_policy ON locations
  FOR UPDATE USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY locations_delete_policy ON locations
  FOR DELETE USING (user_id = auth.uid());

COMMIT;
