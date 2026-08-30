BEGIN;

CREATE TABLE IF NOT EXISTS fandoms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  timeline_id uuid REFERENCES timelines(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  name text NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_fandoms_timeline_id ON fandoms(timeline_id);
CREATE INDEX IF NOT EXISTS idx_fandoms_user_id ON fandoms(user_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_fandoms_timeline_user_name_key
  ON fandoms(timeline_id, user_id, lower(trim(name)));

DROP TRIGGER IF EXISTS trg_fandoms_timestamp ON fandoms;
CREATE TRIGGER trg_fandoms_timestamp BEFORE UPDATE ON fandoms
FOR EACH ROW EXECUTE PROCEDURE trigger_set_timestamp();

ALTER TABLE fandoms ENABLE ROW LEVEL SECURITY;
CREATE POLICY fandoms_select_policy ON fandoms FOR SELECT USING (user_id = auth.uid());
CREATE POLICY fandoms_insert_policy ON fandoms FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY fandoms_update_policy ON fandoms FOR UPDATE USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY fandoms_delete_policy ON fandoms FOR DELETE USING (user_id = auth.uid());

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE fandoms TO authenticated;

COMMIT;