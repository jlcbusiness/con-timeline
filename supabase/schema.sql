-- Supabase schema for Con-Timeline
-- Tables: timelines, events, locations

-- timelines: metadata for named timelines
create table if not exists timelines (
  id text primary key,
  user_id uuid references auth.users on delete cascade,
  name text not null,
  start_date timestamptz not null,
  end_date timestamptz not null,
  created_at timestamptz default now()
);

-- events: per-timeline events
create table if not exists events (
  id text primary key,
  timeline_id text references timelines(id) on delete cascade,
  user_id uuid references auth.users on delete cascade,
  title text not null,
  start_time timestamptz not null,
  end_time timestamptz not null,
  position int default 0,
  metadata jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- locations: per-user locations
create table if not exists locations (
  id text primary key,
  user_id uuid references auth.users on delete cascade,
  name text not null,
  created_at timestamptz default now()
);

-- Enable Row Level Security and policies
alter table timelines enable row level security;
create policy timelines_owner on timelines
  for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

alter table events enable row level security;
create policy events_owner on events
  for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

alter table locations enable row level security;
create policy locations_owner on locations
  for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- Indexes to help common queries
create index if not exists idx_events_timeline_start on events(timeline_id, start_time);
