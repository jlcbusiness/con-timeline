-- Keep the earliest location for each case-insensitive, trimmed name within a timeline.
-- Event locations are stored as text, so deleting duplicate records does not change events.
WITH ranked_locations AS (
  SELECT
    id,
    row_number() OVER (
      PARTITION BY timeline_id, user_id, lower(trim(name))
      ORDER BY created_at ASC, id ASC
    ) AS duplicate_rank
  FROM locations
)
DELETE FROM locations
WHERE id IN (
  SELECT id
  FROM ranked_locations
  WHERE duplicate_rank > 1
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_locations_timeline_user_name_key
  ON locations(timeline_id, user_id, lower(trim(name)));