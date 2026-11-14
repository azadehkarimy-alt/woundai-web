-- WoundAI v30.6: central record sync, private image storage metadata,
-- encounters and appointments. Apply after the v30.5 audit migration.
begin;

alter table public.patients
  add column if not exists phone text,
  add column if not exists emergency_contact text;

alter table public.wounds
  add column if not exists clinical_notes text,
  add column if not exists followup_notes text,
  add column if not exists body_region text;

create table if not exists public.encounters (
  id uuid primary key,
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  patient_id uuid not null,
  wound_id uuid not null,
  occurred_at timestamptz not null default now(),
  recorded_by text,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid not null default auth.uid() references auth.users(id),
  created_at timestamptz not null default now(),
  foreign key(patient_id,clinic_id) references public.patients(id,clinic_id) on delete cascade,
  foreign key(wound_id,patient_id,clinic_id) references public.wounds(id,patient_id,clinic_id) on delete cascade,
  unique(id,patient_id,clinic_id)
);
create index if not exists encounters_wound_time_idx
  on public.encounters(wound_id,occurred_at desc);

alter table public.assessments
  add column if not exists encounter_id uuid;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname='assessments_encounter_patient_clinic_fkey'
      and conrelid='public.assessments'::regclass
  ) then
    alter table public.assessments
      add constraint assessments_encounter_patient_clinic_fkey
      foreign key(encounter_id,patient_id,clinic_id)
      references public.encounters(id,patient_id,clinic_id)
      on delete set null (encounter_id);
  end if;
end $$;

create table if not exists public.appointments (
  id uuid primary key,
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  patient_id uuid not null,
  wound_id uuid not null,
  due_at timestamptz not null,
  reminder_lead_days integer not null default 0 check(reminder_lead_days between 0 and 365),
  notes text,
  status text not null default 'scheduled'
    check(status in ('scheduled','completed','cancelled','rescheduled','missed')),
  created_by uuid not null default auth.uid() references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key(patient_id,clinic_id) references public.patients(id,clinic_id) on delete cascade,
  foreign key(wound_id,patient_id,clinic_id) references public.wounds(id,patient_id,clinic_id) on delete cascade
);
create index if not exists appointments_clinic_due_idx
  on public.appointments(clinic_id,due_at);
create index if not exists appointments_patient_due_idx
  on public.appointments(patient_id,due_at desc);

create or replace function public.woundai_set_updated_at()
returns trigger language plpgsql set search_path=public,pg_temp
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;
drop trigger if exists woundai_patients_updated_at on public.patients;
create trigger woundai_patients_updated_at before update on public.patients
for each row execute function public.woundai_set_updated_at();
drop trigger if exists woundai_wounds_updated_at on public.wounds;
create trigger woundai_wounds_updated_at before update on public.wounds
for each row execute function public.woundai_set_updated_at();
drop trigger if exists woundai_appointments_updated_at on public.appointments;
create trigger woundai_appointments_updated_at before update on public.appointments
for each row execute function public.woundai_set_updated_at();

alter table public.encounters enable row level security;
alter table public.appointments enable row level security;

drop policy if exists "members read encounters" on public.encounters;
create policy "members read encounters" on public.encounters
for select using(public.is_clinic_member(clinic_id));
drop policy if exists "clinicians manage encounters" on public.encounters;
create policy "clinicians manage encounters" on public.encounters
for all using(public.has_clinic_role(clinic_id,array['owner','admin','clinician']::public.member_role[]))
with check(public.has_clinic_role(clinic_id,array['owner','admin','clinician']::public.member_role[]));

drop policy if exists "members read appointments" on public.appointments;
create policy "members read appointments" on public.appointments
for select using(public.is_clinic_member(clinic_id));
drop policy if exists "clinicians manage appointments" on public.appointments;
create policy "clinicians manage appointments" on public.appointments
for all using(public.has_clinic_role(clinic_id,array['owner','admin','clinician']::public.member_role[]))
with check(public.has_clinic_role(clinic_id,array['owner','admin','clinician']::public.member_role[]));

-- Add the new tables to the v30.5 database-generated audit trail.
drop trigger if exists woundai_audit_encounters on public.encounters;
create trigger woundai_audit_encounters
after insert or update or delete on public.encounters
for each row execute function public.woundai_write_audit_event();

drop trigger if exists woundai_audit_appointments on public.appointments;
create trigger woundai_audit_appointments
after insert or update or delete on public.appointments
for each row execute function public.woundai_write_audit_event();

-- Ensure the private bucket exists. Existing policies remain unchanged.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('wound-images','wound-images',false,12582912,array['image/jpeg','image/png','image/webp'])
on conflict(id) do update set
  public=false,
  file_size_limit=12582912,
  allowed_mime_types=array['image/jpeg','image/png','image/webp'];

commit;
