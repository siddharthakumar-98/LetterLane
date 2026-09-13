-- Additive v1.1 migration; existing human identities remain human.
-- Bot IDs are server-created UUIDs with no Supabase Auth account or session.
alter table public.players add column if not exists is_bot boolean not null default false;
-- Existing read-only membership policies still apply; no new write grants.
