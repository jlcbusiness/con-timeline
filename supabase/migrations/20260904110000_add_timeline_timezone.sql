ALTER TABLE public.timelines
  ADD COLUMN IF NOT EXISTS time_zone text;

COMMENT ON COLUMN public.timelines.time_zone IS
  'IANA timezone used to display timeline and event instants. Null legacy rows use the client timezone until saved.';