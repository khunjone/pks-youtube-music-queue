-- YouTube Music Queue Manager - Phase 1 core schema
-- Run once in Supabase SQL Editor on a new project.

begin;

-- 1) Rooms
create table if not exists public.rooms (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  enabled boolean not null default true,
  created_at timestamptz not null default now()
);

-- 2) Room settings (private to backend/admin)
create table if not exists public.room_settings (
  room_id uuid primary key references public.rooms(id) on delete cascade,
  settings jsonb not null default '{
    "max_queue": 100,
    "max_song_per_user": 5,
    "search_result_limit": 10,
    "auto_next": true,
    "allow_duplicate": false,
    "vote_enabled": true,
    "vote_mode": "UNLIMITED",
    "one_vote_per_song": true,
    "allow_unvote": true,
    "vote_order": "STRICT",
    "vote_tie_breaker": "OLDEST_FIRST",
    "playing_song_vote": false,
    "message_public": true,
    "recipient_public": true
  }'::jsonb,
  updated_at timestamptz not null default now()
);

-- 3) Anonymous browser sessions. Only backend/service role may access.
create table if not exists public.user_sessions (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms(id) on delete cascade,
  display_name text not null,
  token_hash text not null unique,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  expires_at timestamptz not null,
  revoked_at timestamptz,
  constraint user_sessions_display_name_length check (char_length(display_name) between 1 and 80)
);
create index if not exists idx_user_sessions_room_expiry
  on public.user_sessions(room_id, expires_at);

-- 4) Songs
create table if not exists public.songs (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms(id) on delete cascade,
  video_id text not null,
  title text not null,
  channel_title text,
  thumbnail text,
  duration_seconds integer,
  metadata_refreshed_at timestamptz,
  submitted_by text not null,
  recipient text,
  message text,
  submitted_at timestamptz not null default now(),
  vote_count integer not null default 0,
  status text not null default 'WAITING'
    check (status in ('WAITING','PLAYING','PLAYED','SKIPPED','REMOVED','ERROR')),
  started_at timestamptz,
  finished_at timestamptz,
  constraint songs_vote_count_nonnegative check (vote_count >= 0),
  constraint songs_duration_nonnegative check (duration_seconds is null or duration_seconds >= 0),
  constraint songs_submitter_length check (char_length(submitted_by) between 1 and 80),
  constraint songs_recipient_length check (recipient is null or char_length(recipient) <= 50),
  constraint songs_message_length check (message is null or char_length(message) <= 200),
  constraint songs_video_id_length check (char_length(video_id) between 1 and 32)
);

create index if not exists idx_songs_queue_ranking
  on public.songs(room_id, vote_count desc, submitted_at asc, id asc)
  where status = 'WAITING';
create index if not exists idx_songs_room_status
  on public.songs(room_id, status, submitted_at asc);
create unique index if not exists uq_active_video_per_room
  on public.songs(room_id, video_id)
  where status in ('WAITING','PLAYING');

-- 5) Votes. The backend must validate session and song status before writing.
create table if not exists public.votes (
  id uuid primary key default gen_random_uuid(),
  song_id uuid not null references public.songs(id) on delete cascade,
  voter_session_id uuid not null references public.user_sessions(id) on delete cascade,
  voted_at timestamptz not null default now(),
  is_active boolean not null default true
);
create unique index if not exists uq_active_vote_per_user_song
  on public.votes(song_id, voter_session_id)
  where is_active = true;
create index if not exists idx_votes_song_active
  on public.votes(song_id, is_active);

-- Keep the denormalized score in songs synchronized with active vote rows.
create or replace function public.sync_song_vote_count()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_song_id uuid;
  v_delta integer := 0;
begin
  if tg_op = 'INSERT' then
    v_song_id := new.song_id;
    if new.is_active then v_delta := 1; end if;
  elsif tg_op = 'UPDATE' then
    if new.song_id <> old.song_id or new.voter_session_id <> old.voter_session_id then
      raise exception 'Changing vote owner or song is not allowed';
    end if;
    v_song_id := new.song_id;
    if old.is_active = false and new.is_active = true then
      v_delta := 1;
    elsif old.is_active = true and new.is_active = false then
      v_delta := -1;
    end if;
  elsif tg_op = 'DELETE' then
    v_song_id := old.song_id;
    if old.is_active then v_delta := -1; end if;
  end if;

  if v_delta <> 0 then
    update public.songs
       set vote_count = greatest(0, vote_count + v_delta)
     where id = v_song_id;
  end if;

  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

 drop trigger if exists trg_sync_song_vote_count on public.votes;
create trigger trg_sync_song_vote_count
  after insert or update of is_active or delete on public.votes
  for each row execute function public.sync_song_vote_count();

-- 6) Public player state
create table if not exists public.player_public_state (
  room_id uuid primary key references public.rooms(id) on delete cascade,
  current_song_id uuid references public.songs(id) on delete set null,
  status text not null default 'IDLE' check (status in ('IDLE','PLAYING','PAUSED')),
  current_position integer not null default 0 check (current_position >= 0),
  volume integer not null default 50 check (volume between 0 and 100),
  updated_at timestamptz not null default now(),
  version bigint not null default 0
);

-- 7) Private player lease. Never expose this table to browser clients.
create table if not exists public.player_leases (
  room_id uuid primary key references public.rooms(id) on delete cascade,
  device_id text not null,
  lease_token_hash text not null,
  heartbeat_at timestamptz not null default now(),
  expires_at timestamptz not null,
  updated_at timestamptz not null default now()
);

-- 8) Play history
create table if not exists public.play_history (
  id uuid primary key default gen_random_uuid(),
  song_id uuid not null references public.songs(id),
  played_at timestamptz not null,
  ended_at timestamptz,
  final_vote_count integer not null default 0 check (final_vote_count >= 0),
  end_reason text check (end_reason in ('ENDED','SKIPPED','ERROR'))
);
create index if not exists idx_play_history_played_at
  on public.play_history(played_at desc);

-- 9) Admin profiles mapped to Supabase Auth users
create table if not exists public.admin_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null check (role in ('ADMIN','MODERATOR')),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

-- 10) System logs
create table if not exists public.system_logs (
  id uuid primary key default gen_random_uuid(),
  actor_type text not null,
  actor_id text,
  action text not null,
  reference_id text,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists idx_system_logs_created_at
  on public.system_logs(created_at desc);

-- 11) Idempotency / duplicate request protection
create table if not exists public.request_dedup (
  id uuid primary key default gen_random_uuid(),
  actor_key text not null,
  request_key text not null,
  action text not null,
  response jsonb,
  created_at timestamptz not null default now(),
  unique(actor_key, request_key)
);
create index if not exists idx_request_dedup_created_at
  on public.request_dedup(created_at);

-- Seed the one central room and its one-to-one state rows.
insert into public.rooms(name, slug)
values ('Music Room', 'one')
on conflict (slug) do nothing;

insert into public.room_settings(room_id)
select id from public.rooms where slug = 'one'
on conflict (room_id) do nothing;

insert into public.player_public_state(room_id)
select id from public.rooms where slug = 'one'
on conflict (room_id) do nothing;

-- Enable RLS on every public table.
alter table public.rooms enable row level security;
alter table public.room_settings enable row level security;
alter table public.user_sessions enable row level security;
alter table public.songs enable row level security;
alter table public.votes enable row level security;
alter table public.player_public_state enable row level security;
alter table public.player_leases enable row level security;
alter table public.play_history enable row level security;
alter table public.admin_profiles enable row level security;
alter table public.system_logs enable row level security;
alter table public.request_dedup enable row level security;

-- Start from deny-by-default for browser roles.
revoke all on table public.rooms from anon, authenticated;
revoke all on table public.room_settings from anon, authenticated;
revoke all on table public.user_sessions from anon, authenticated;
revoke all on table public.songs from anon, authenticated;
revoke all on table public.votes from anon, authenticated;
revoke all on table public.player_public_state from anon, authenticated;
revoke all on table public.player_leases from anon, authenticated;
revoke all on table public.play_history from anon, authenticated;
revoke all on table public.admin_profiles from anon, authenticated;
revoke all on table public.system_logs from anon, authenticated;
revoke all on table public.request_dedup from anon, authenticated;

-- Public read is intentional for the shared music room and public dedication text.
grant select on table public.rooms to anon, authenticated;
grant select on table public.songs to anon, authenticated;
grant select on table public.player_public_state to anon, authenticated;

 drop policy if exists rooms_public_read on public.rooms;
create policy rooms_public_read on public.rooms
  for select to anon, authenticated using (enabled = true);

drop policy if exists songs_public_read on public.songs;
create policy songs_public_read on public.songs
  for select to anon, authenticated using (true);

drop policy if exists player_state_public_read on public.player_public_state;
create policy player_state_public_read on public.player_public_state
  for select to anon, authenticated using (true);

-- Add only the two public tables to Realtime publication (if not already present).
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'songs'
  ) then
    alter publication supabase_realtime add table public.songs;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'player_public_state'
  ) then
    alter publication supabase_realtime add table public.player_public_state;
  end if;
end
$$;

commit;
