-- Run after core in Supabase, whose auth and realtime schemas are preinstalled.
revoke all on schema private from anon, authenticated;
revoke all on all tables in schema private from anon, authenticated;
revoke all on all tables in schema public from anon, authenticated;
grant select on public.players, public.rooms, public.room_participants, public.matches,
 public.guess_attempts, public.rematch_readiness, public.room_events to authenticated;
create or replace function public.is_room_member(target uuid) returns boolean
language sql stable security definer set search_path = '' as $$
 select exists(select 1 from public.room_participants p join public.rooms r on r.id=p.room_id
 where p.room_id=target and p.player_id=auth.uid() and r.expires_at > now());
$$;
revoke all on function public.is_room_member(uuid) from public;
grant execute on function public.is_room_member(uuid) to authenticated;
create policy players_read on public.players for select to authenticated using (
 id=auth.uid() or exists(select 1 from public.room_participants p where p.player_id=players.id and public.is_room_member(p.room_id))
);
create policy rooms_read on public.rooms for select to authenticated using(public.is_room_member(id));
create policy participants_read on public.room_participants for select to authenticated using(public.is_room_member(room_id));
create policy matches_read on public.matches for select to authenticated using(public.is_room_member(room_id));
-- Even after completion, direct SQL API reads only expose a player's own guesses.
-- The authenticated Next API reveals both histories once the match is complete.
create policy guesses_read on public.guess_attempts for select to authenticated using(
 player_id=auth.uid() and exists(select 1 from public.matches m where m.id=match_id and public.is_room_member(m.room_id))
);
create policy rematch_read on public.rematch_readiness for select to authenticated using(
 exists(select 1 from public.matches m where m.id=match_id and public.is_room_member(m.room_id))
);
create policy events_read on public.room_events for select to authenticated using(public.is_room_member(room_id));
-- No client INSERT/UPDATE/DELETE policies: all mutations go through the verified server.
create policy room_presence_read on realtime.messages for select to authenticated using (
 extension='presence' and exists(select 1 from public.rooms r where 'room:' || r.id::text = realtime.topic() and public.is_room_member(r.id))
);
create policy room_presence_write on realtime.messages for insert to authenticated with check (
 extension='presence' and exists(select 1 from public.rooms r where 'room:' || r.id::text = realtime.topic() and public.is_room_member(r.id))
);
alter publication supabase_realtime add table public.room_events;
