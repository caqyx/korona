-- pg_cron: co 15 minut usuwa stare pokoje.
create extension if not exists pg_cron;
select cron.schedule('korona-cleanup-rooms', '*/15 * * * *', $$select public.cleanup_stale_rooms()$$);
