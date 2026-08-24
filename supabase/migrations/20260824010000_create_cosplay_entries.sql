-- Create a dedicated cosplay entry table, separate from timeline events.

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS cosplay_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  timeline_id uuid REFERENCES timelines(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  day_key text NOT NULL,
  title text NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_cosplay_entries_timeline_day
  ON cosplay_entries(timeline_id, user_id, day_key);
CREATE INDEX IF NOT EXISTS idx_cosplay_entries_timeline_id ON cosplay_entries(timeline_id);
CREATE INDEX IF NOT EXISTS idx_cosplay_entries_user_id ON cosplay_entries(user_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE cosplay_entries TO authenticated;

DROP TRIGGER IF EXISTS trg_cosplay_entries_timestamp ON cosplay_entries;

CREATE TRIGGER trg_cosplay_entries_timestamp
BEFORE UPDATE ON cosplay_entries
FOR EACH ROW EXECUTE PROCEDURE trigger_set_timestamp();

ALTER TABLE cosplay_entries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS cosplay_entries_select_policy ON cosplay_entries;
DROP POLICY IF EXISTS cosplay_entries_insert_policy ON cosplay_entries;
DROP POLICY IF EXISTS cosplay_entries_update_policy ON cosplay_entries;
DROP POLICY IF EXISTS cosplay_entries_delete_policy ON cosplay_entries;

CREATE POLICY cosplay_entries_select_policy ON cosplay_entries
  FOR SELECT USING (user_id = auth.uid());
CREATE POLICY cosplay_entries_insert_policy ON cosplay_entries
  FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY cosplay_entries_update_policy ON cosplay_entries
  FOR UPDATE USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY cosplay_entries_delete_policy ON cosplay_entries
  FOR DELETE USING (user_id = auth.uid());

COMMIT;