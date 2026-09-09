create schema if not exists private;
revoke all on schema private from public;
create table if not exists public.players (
  id uuid primary key,
  display_name text not null check (char_length(display_name) between 1 and 20),
  created_at timestamptz not null default now()
);
create table if not exists public.rooms (
  id uuid primary key,
  code text unique not null check (code ~ '^[A-HJ-NP-Z2-9]{6}$'),
  mode text not null check (mode in ('duel','coop')),
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);
create table if not exists public.room_participants (
  room_id uuid not null references public.rooms(id) on delete cascade,
  player_id uuid not null references public.players(id),
  seat smallint not null check (seat in (0,1)),
  ready boolean not null default false,
  last_seen timestamptz not null,
  primary key (room_id, player_id), unique (room_id, seat)
);
create index if not exists participants_player_idx on public.room_participants(player_id, room_id);
create table if not exists public.matches (
  id uuid primary key,
  room_id uuid not null references public.rooms(id) on delete cascade,
  round integer not null check (round > 0),
  phase text not null check (phase in ('lobby','countdown','active','complete')),
  starts_at timestamptz,
  ended_at timestamptz,
  winner_id uuid references public.players(id),
  outcome text,
  unique (room_id, round)
);
create table if not exists public.guess_attempts (
  match_id uuid not null references public.matches(id) on delete cascade,
  player_id uuid not null references public.players(id),
  attempt smallint not null check (attempt between 1 and 6),
  word text not null check (word ~ '^[A-Z]{5}$'),
  marks jsonb not null check (jsonb_array_length(marks) = 5),
  elapsed_ms bigint not null check (elapsed_ms >= 0),
  request_id uuid not null,
  primary key(match_id,player_id,attempt),
  unique(match_id,player_id,request_id), unique(match_id,player_id,word)
);
create table if not exists public.rematch_readiness (
  match_id uuid not null references public.matches(id) on delete cascade,
  player_id uuid not null references public.players(id),
  ready boolean not null,
  primary key(match_id,player_id)
);
-- The only published table. Contains an invalidation counter, never guesses or answers.
create table if not exists public.room_events (
  room_id uuid primary key references public.rooms(id) on delete cascade,
  revision bigint not null default 0
);
-- Complete authoritative state and answers live outside the exposed API schemas.
create table if not exists private.room_states (
  room_id uuid primary key references public.rooms(id) on delete cascade,
  state jsonb not null
);
create table if not exists private.local_sessions (
  token_hash text primary key,
  player_id uuid not null,
  expires_at timestamptz not null
);
create table if not exists private.rate_limits (
  key text primary key,
  window_start timestamptz not null,
  hits integer not null
);
alter table public.players enable row level security;
alter table public.rooms enable row level security;
alter table public.room_participants enable row level security;
alter table public.matches enable row level security;
alter table public.guess_attempts enable row level security;
alter table public.rematch_readiness enable row level security;
alter table public.room_events enable row level security;
alter table private.room_states enable row level security;
alter table private.local_sessions enable row level security;
alter table private.rate_limits enable row level security;
