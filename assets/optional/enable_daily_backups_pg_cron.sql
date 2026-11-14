-- OPTIONAL: Enable only if pg_cron is available in the Supabase project.
-- Run after the v30.7 main migration. This schedules one logical DB snapshot
-- per clinic each day at 02:00 UTC. It does not back up Storage image binaries.
create extension if not exists pg_cron;

do $$
begin
  if exists(select 1 from cron.job where jobname='woundai-daily-clinic-backups') then
    perform cron.unschedule('woundai-daily-clinic-backups');
  end if;
end $$;

select cron.schedule(
  'woundai-daily-clinic-backups',
  '0 2 * * *',
  'select public.run_scheduled_clinic_backups();'
);
