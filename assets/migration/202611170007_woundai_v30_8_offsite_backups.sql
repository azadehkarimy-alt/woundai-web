-- WoundAI v30.8: verified metadata for encrypted off-site backups stored outside Supabase.
begin;
create table if not exists public.clinic_offsite_backups (
  id uuid primary key,
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  object_key text not null unique,
  bytes bigint not null check(bytes between 1 and 524288000),
  sha256 text not null check(sha256 ~ '^[0-9a-f]{64}$'),
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  verified_at timestamptz not null
);
create index if not exists clinic_offsite_backups_clinic_time_idx
  on public.clinic_offsite_backups(clinic_id,created_at desc);
alter table public.clinic_offsite_backups enable row level security;
drop policy if exists "clinic admins read offsite backups" on public.clinic_offsite_backups;
create policy "clinic admins read offsite backups" on public.clinic_offsite_backups
for select using(public.has_clinic_role(clinic_id,array['owner','admin']::public.member_role[]));
revoke all on table public.clinic_offsite_backups from anon,authenticated;
grant select on table public.clinic_offsite_backups to authenticated;
grant all on table public.clinic_offsite_backups to service_role;
commit;
