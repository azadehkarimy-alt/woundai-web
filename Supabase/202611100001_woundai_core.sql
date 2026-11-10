-- WoundAI production backend starter
-- Apply in a dedicated Supabase project only after reviewing privacy/legal requirements.
create extension if not exists pgcrypto;

create type public.member_role as enum ('owner','admin','clinician','reviewer','viewer');
create table public.clinics (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now()
);
create table public.clinic_members (
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.member_role not null default 'viewer',
  created_at timestamptz not null default now(),
  primary key (clinic_id,user_id)
);
create index clinic_members_user_idx on public.clinic_members(user_id);

create or replace function public.is_clinic_member(target_clinic uuid)
returns boolean language sql stable security definer set search_path=public
as $$ select exists(select 1 from public.clinic_members m where m.clinic_id=target_clinic and m.user_id=auth.uid()) $$;
create or replace function public.has_clinic_role(target_clinic uuid, allowed public.member_role[])
returns boolean language sql stable security definer set search_path=public
as $$ select exists(select 1 from public.clinic_members m where m.clinic_id=target_clinic and m.user_id=auth.uid() and m.role=any(allowed)) $$;

create table public.patients (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  record_code text not null,
  full_name text not null,
  date_of_birth date,
  sex text,
  diabetes text,
  vascular_disease text,
  allergies text,
  medications text,
  medical_history text,
  consent_record jsonb not null default '{}'::jsonb,
  status text not null default 'active' check(status in ('active','archived')),
  created_by uuid not null default auth.uid() references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(clinic_id,record_code),
  unique(id,clinic_id)
);
create table public.wounds (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  patient_id uuid not null,
  etiology text,
  anatomical_site text not null,
  body_region text,
  laterality text,
  onset_date date,
  status text not null default 'active' check(status in ('active','healed','archived')),
  created_by uuid not null default auth.uid() references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key(patient_id,clinic_id) references public.patients(id,clinic_id) on delete cascade,
  unique(id,clinic_id),
  unique(id,patient_id,clinic_id)
);
create table public.wound_images (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  patient_id uuid not null,
  wound_id uuid not null,
  storage_path text not null,
  captured_at timestamptz not null default now(),
  width_px integer,
  height_px integer,
  calibration jsonb,
  traced_area_cm2 numeric(12,4),
  measurement_method text not null default 'manual-clinician-reviewed',
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid not null default auth.uid() references auth.users(id),
  foreign key(patient_id,clinic_id) references public.patients(id,clinic_id) on delete cascade,
  foreign key(wound_id,patient_id,clinic_id) references public.wounds(id,patient_id,clinic_id) on delete cascade,
  unique(id,patient_id,clinic_id)
);
create table public.assessments (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  patient_id uuid not null,
  wound_id uuid not null,
  image_id uuid,
  assessment_type text not null,
  assessed_at timestamptz not null default now(),
  data jsonb not null,
  created_by uuid not null default auth.uid() references auth.users(id),
  foreign key(patient_id,clinic_id) references public.patients(id,clinic_id) on delete cascade,
  foreign key(wound_id,patient_id,clinic_id) references public.wounds(id,patient_id,clinic_id) on delete cascade,
  foreign key(image_id,patient_id,clinic_id) references public.wound_images(id,patient_id,clinic_id) on delete restrict
);
create table public.care_plans (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  patient_id uuid not null,
  wound_id uuid not null,
  source_assessment_id uuid references public.assessments(id) on delete set null,
  status text not null default 'draft' check(status in ('draft','approved','superseded')),
  plan jsonb not null,
  clinician_name text,
  clinician_credential text,
  approved_at timestamptz,
  created_by uuid not null default auth.uid() references auth.users(id),
  created_at timestamptz not null default now(),
  foreign key(patient_id,clinic_id) references public.patients(id,clinic_id) on delete cascade,
  foreign key(wound_id,patient_id,clinic_id) references public.wounds(id,patient_id,clinic_id) on delete cascade
);
create table public.audit_events (
  id bigint generated always as identity primary key,
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  actor_id uuid not null default auth.uid() references auth.users(id),
  action text not null,
  resource_type text not null,
  resource_id uuid,
  occurred_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb
);
create index wounds_patient_idx on public.wounds(patient_id,created_at desc);
create index images_wound_idx on public.wound_images(wound_id,captured_at desc);
create index assessments_wound_idx on public.assessments(wound_id,assessed_at desc);
create index care_plans_wound_idx on public.care_plans(wound_id,created_at desc);

alter table public.clinics enable row level security;
alter table public.clinic_members enable row level security;
alter table public.patients enable row level security;
alter table public.wounds enable row level security;
alter table public.wound_images enable row level security;
alter table public.assessments enable row level security;
alter table public.care_plans enable row level security;
alter table public.audit_events enable row level security;

create policy "members read own clinics" on public.clinics for select using(public.is_clinic_member(id));
create policy "members read membership" on public.clinic_members for select using(user_id=auth.uid() or public.is_clinic_member(clinic_id));
create policy "members read patients" on public.patients for select using(public.is_clinic_member(clinic_id));
create policy "clinicians manage patients" on public.patients for all using(public.has_clinic_role(clinic_id,array['owner','admin','clinician']::public.member_role[])) with check(public.has_clinic_role(clinic_id,array['owner','admin','clinician']::public.member_role[]));
create policy "members read wounds" on public.wounds for select using(public.is_clinic_member(clinic_id));
create policy "clinicians manage wounds" on public.wounds for all using(public.has_clinic_role(clinic_id,array['owner','admin','clinician']::public.member_role[])) with check(public.has_clinic_role(clinic_id,array['owner','admin','clinician']::public.member_role[]));
create policy "members read wound images" on public.wound_images for select using(public.is_clinic_member(clinic_id));
create policy "clinicians manage wound images" on public.wound_images for all using(public.has_clinic_role(clinic_id,array['owner','admin','clinician']::public.member_role[])) with check(public.has_clinic_role(clinic_id,array['owner','admin','clinician']::public.member_role[]));
create policy "members read assessments" on public.assessments for select using(public.is_clinic_member(clinic_id));
create policy "clinicians create assessments" on public.assessments for insert with check(public.has_clinic_role(clinic_id,array['owner','admin','clinician']::public.member_role[]));
create policy "clinicians update assessments" on public.assessments for update using(public.has_clinic_role(clinic_id,array['owner','admin','clinician']::public.member_role[])) with check(public.has_clinic_role(clinic_id,array['owner','admin','clinician']::public.member_role[]));
create policy "members read care plans" on public.care_plans for select using(public.is_clinic_member(clinic_id));
create policy "clinicians create care plans" on public.care_plans for insert with check(public.has_clinic_role(clinic_id,array['owner','admin','clinician']::public.member_role[]));
create policy "clinicians update draft care plans" on public.care_plans for update using(status='draft' and public.has_clinic_role(clinic_id,array['owner','admin','clinician']::public.member_role[])) with check(public.has_clinic_role(clinic_id,array['owner','admin','clinician']::public.member_role[]));
create policy "admins read audit" on public.audit_events for select using(public.has_clinic_role(clinic_id,array['owner','admin']::public.member_role[]));
create policy "members append audit" on public.audit_events for insert with check(public.is_clinic_member(clinic_id) and actor_id=auth.uid());

-- Private object storage bucket. Store objects under: <clinic_uuid>/<patient_uuid>/<wound_uuid>/<filename>
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('wound-images','wound-images',false,12582912,array['image/jpeg','image/png','image/webp'])
on conflict(id) do nothing;
create policy "clinic members read wound images" on storage.objects for select
using(bucket_id='wound-images' and public.is_clinic_member(((storage.foldername(name))[1])::uuid));
create policy "clinicians upload wound images" on storage.objects for insert
with check(bucket_id='wound-images' and public.has_clinic_role(((storage.foldername(name))[1])::uuid,array['owner','admin','clinician']::public.member_role[]));
create policy "clinicians update wound images" on storage.objects for update
using(bucket_id='wound-images' and public.has_clinic_role(((storage.foldername(name))[1])::uuid,array['owner','admin','clinician']::public.member_role[]))
with check(bucket_id='wound-images' and public.has_clinic_role(((storage.foldername(name))[1])::uuid,array['owner','admin','clinician']::public.member_role[]));
create policy "admins delete wound images" on storage.objects for delete
using(bucket_id='wound-images' and public.has_clinic_role(((storage.foldername(name))[1])::uuid,array['owner','admin']::public.member_role[]));

-- Important: no anon access. Never place the service-role key in browser code.
