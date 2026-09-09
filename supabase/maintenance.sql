-- Optional maintenance; run deliberately in the Supabase SQL editor or pg_cron.
-- Retain seven days beyond expiry for debugging, then remove whole room histories.
delete from public.rooms where expires_at < now() - interval '7 days';
delete from private.rate_limits where window_start < now() - interval '2 days';
delete from private.local_sessions where expires_at < now();
delete from public.players p where p.created_at < now() - interval '30 days'
 and not exists(select 1 from public.room_participants rp where rp.player_id=p.id)
 and not exists(select 1 from public.matches m where m.winner_id=p.id)
 and not exists(select 1 from public.guess_attempts a where a.player_id=p.id);
