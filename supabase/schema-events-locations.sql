-- Enable UUID generator
create extension if not exists pgcrypto;

-- Timelines
create table if not exists timelines (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  name text not null,
  start_date timestamptz not null,
  end_date timestamptz not null,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  archived boolean default false,
  archived_at timestamptz
);

create index if not exists idx_timelines_user_id on timelines(user_id);

-- Events
create table if not exists events (
  id uuid primary key default gen_random_uuid(),
  timeline_id uuid references timelines(id) on delete cascade,
  user_id uuid not null,
  title text not null,
  description text,
  start_time timestamptz,
  end_time timestamptz,
  position integer default 0,
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_events_timeline_id on events(timeline_id);
create index if not exists idx_events_user_id on events(user_id);

-- Locations
create table if not exists locations (
  id uuid primary key default gen_random_uuid(),
  timeline_id uuid references timelines(id) on delete cascade,
  user_id uuid not null,
  name text not null,
  details jsonb default '{}'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_locations_timeline_id on locations(timeline_id);
create index if not exists idx_locations_user_id on locations(user_id);

-- Trigger to update updated_at
create or replace function trigger_set_timestamp()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_timelines_timestamp on timelines;
drop trigger if exists trg_events_timestamp on events;
drop trigger if exists trg_locations_timestamp on locations;

create trigger trg_timelines_timestamp before update on timelines for each row execute procedure trigger_set_timestamp();
create trigger trg_events_timestamp before update on events for each row execute procedure trigger_set_timestamp();
create trigger trg_locations_timestamp before update on locations for each row execute procedure trigger_set_timestamp();

-- Enable Row Level Security and policies
alter table timelines enable row level security;
drop policy if exists timeline_select_policy on timelines;
drop policy if exists timeline_insert_policy on timelines;
drop policy if exists timeline_update_policy on timelines;
drop policy if exists timeline_delete_policy on timelines;
create policy timeline_select_policy on timelines for select using (user_id = auth.uid());
create policy timeline_insert_policy on timelines for insert with check (user_id = auth.uid());
create policy timeline_update_policy on timelines for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy timeline_delete_policy on timelines for delete using (user_id = auth.uid());

alter table events enable row level security;
drop policy if exists events_select_policy on events;
drop policy if exists events_insert_policy on events;
drop policy if exists events_update_policy on events;
drop policy if exists events_delete_policy on events;
create policy events_select_policy on events for select using (user_id = auth.uid());
create policy events_insert_policy on events for insert with check (user_id = auth.uid());
create policy events_update_policy on events for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy events_delete_policy on events for delete using (user_id = auth.uid());

alter table locations enable row level security;
drop policy if exists locations_select_policy on locations;
drop policy if exists locations_insert_policy on locations;
drop policy if exists locations_update_policy on locations;
drop policy if exists locations_delete_policy on locations;
create policy locations_select_policy on locations for select using (user_id = auth.uid());
create policy locations_insert_policy on locations for insert with check (user_id = auth.uid());
create policy locations_update_policy on locations for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy locations_delete_policy on locations for delete using (user_id = auth.uid());
