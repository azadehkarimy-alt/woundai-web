-- WoundAI v30.2 backend hardening
-- Apply only after the v30.1 core migration on a dedicated Supabase project.
-- This migration does not migrate browser LocalStorage data.
begin;

-- AAL2 (MFA-authenticated session) is required for clinical write/admin actions.
create or replace function public.has_clinic_role(
  target_clinic uuid,
  allowed public.member_role[]
) returns boolean
language sql stable security definer
set search_path = public, pg_temp
as $$
  select coalesce((auth.jwt() ->> 'aal') = 'aal2', false)
     and exists (
       select 1 from public.clinic_members m
       where m.clinic_id = target_clinic
         and m.user_id = auth.uid()
         and m.role = any(allowed)
     );
$$;

-- Clinic bootstrap: authenticated user becomes the first owner.
create or replace function public.create_clinic_and_owner(clinic_name text)
returns uuid
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare new_clinic_id uuid;
begin
  if auth.uid() is null then raise exception 'authentication_required' using errcode = '42501'; end if;
  if length(trim(coalesce(clinic_name, ''))) < 2 or length(trim(clinic_name)) > 120 then
    raise exception 'clinic_name_invalid' using errcode = '22023';
  end if;
  insert into public.clinics(name) values (trim(clinic_name)) returning id into new_clinic_id;
  insert into public.clinic_members(clinic_id, user_id, role)
    values (new_clinic_id, auth.uid(), 'owner');
  return new_clinic_id;
end;
$$;
revoke all on function public.create_clinic_and_owner(text) from public, anon;
grant execute on function public.create_clinic_and_owner(text) to authenticated;

-- Owner/admin can add a member. Only an owner can grant the owner role.
create or replace function public.add_clinic_member(
  target_clinic uuid,
  target_user uuid,
  target_role public.member_role
) returns void
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare actor_role public.member_role;
begin
  perform 1 from public.clinics where id=target_clinic for update;
  select role into actor_role from public.clinic_members
   where clinic_id = target_clinic and user_id = auth.uid();
  if actor_role is null or coalesce((auth.jwt() ->> 'aal') = 'aal2', false) is not true then
    raise exception 'permission_denied_or_mfa_required' using errcode = '42501';
  end if;
  if actor_role not in ('owner','admin') then
    raise exception 'admin_role_required' using errcode = '42501';
  end if;
  if target_role = 'owner' and actor_role <> 'owner' then
    raise exception 'only_owner_can_grant_owner' using errcode = '42501';
  end if;
  insert into public.clinic_members(clinic_id, user_id, role)
    values (target_clinic, target_user, target_role);
end;
$$;
revoke all on function public.add_clinic_member(uuid, uuid, public.member_role) from public, anon;
grant execute on function public.add_clinic_member(uuid, uuid, public.member_role) to authenticated;

create or replace function public.set_clinic_member_role(
  target_clinic uuid,
  target_user uuid,
  target_role public.member_role
) returns void
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare actor_role public.member_role; old_role public.member_role; owner_count integer;
begin
  perform 1 from public.clinics where id=target_clinic for update;
  select role into actor_role from public.clinic_members where clinic_id=target_clinic and user_id=auth.uid();
  select role into old_role from public.clinic_members where clinic_id=target_clinic and user_id=target_user;
  if actor_role is null or actor_role not in ('owner','admin') or coalesce((auth.jwt() ->> 'aal')='aal2',false) is not true then
    raise exception 'permission_denied_or_mfa_required' using errcode='42501';
  end if;
  if old_role is null then raise exception 'member_not_found' using errcode='P0002'; end if;
  if (old_role='owner' or target_role='owner') and actor_role<>'owner' then
    raise exception 'only_owner_can_change_owner_role' using errcode='42501';
  end if;
  if old_role='owner' and target_role<>'owner' then
    select count(*) into owner_count from public.clinic_members where clinic_id=target_clinic and role='owner';
    if owner_count<=1 then raise exception 'cannot_demote_last_owner' using errcode='23514'; end if;
  end if;
  update public.clinic_members set role=target_role where clinic_id=target_clinic and user_id=target_user;
end;
$$;
revoke all on function public.set_clinic_member_role(uuid, uuid, public.member_role) from public, anon;
grant execute on function public.set_clinic_member_role(uuid, uuid, public.member_role) to authenticated;

create or replace function public.remove_clinic_member(target_clinic uuid, target_user uuid)
returns void
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare actor_role public.member_role; target_role public.member_role; owner_count integer;
begin
  perform 1 from public.clinics where id=target_clinic for update;
  select role into actor_role from public.clinic_members where clinic_id=target_clinic and user_id=auth.uid();
  select role into target_role from public.clinic_members where clinic_id=target_clinic and user_id=target_user;
  if actor_role is null or actor_role not in ('owner','admin') or coalesce((auth.jwt() ->> 'aal')='aal2',false) is not true then
    raise exception 'permission_denied_or_mfa_required' using errcode='42501';
  end if;
  if target_role is null then raise exception 'member_not_found' using errcode='P0002'; end if;
  if target_role='owner' and actor_role<>'owner' then raise exception 'only_owner_can_remove_owner' using errcode='42501'; end if;
  if target_role='owner' then
    select count(*) into owner_count from public.clinic_members where clinic_id=target_clinic and role='owner';
    if owner_count<=1 then raise exception 'cannot_remove_last_owner' using errcode='23514'; end if;
  end if;
  delete from public.clinic_members where clinic_id=target_clinic and user_id=target_user;
end;
$$;
revoke all on function public.remove_clinic_member(uuid, uuid) from public, anon;
grant execute on function public.remove_clinic_member(uuid, uuid) to authenticated;

-- Encounter is the longitudinal visit container; clinical assessment remains a separate versioned record.
create table if not exists public.encounters (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  patient_id uuid not null,
  wound_id uuid,
  occurred_at timestamptz not null default now(),
  encounter_type text not null default 'follow_up',
  status text not null default 'open' check (status in ('open','completed','cancelled')),
  notes text,
  created_by uuid references auth.users(id) default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (patient_id, clinic_id)
    references public.patients(id, clinic_id) on delete cascade,
  foreign key (wound_id, patient_id, clinic_id)
    references public.wounds(id, patient_id, clinic_id) on delete cascade,
  unique (id, patient_id, clinic_id)
);

create table if not exists public.appointments (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  patient_id uuid not null,
  wound_id uuid,
  due_at timestamptz not null,
  reminder_days integer not null default 1 check (reminder_days between 0 and 90),
  status text not null default 'scheduled' check (status in ('scheduled','completed','cancelled','no_show')),
  notes text,
  created_by uuid references auth.users(id) default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (patient_id, clinic_id)
    references public.patients(id, clinic_id) on delete cascade,
  foreign key (wound_id, patient_id, clinic_id)
    references public.wounds(id, patient_id, clinic_id) on delete cascade
);

create index if not exists encounters_patient_time_idx on public.encounters(patient_id, occurred_at desc);
create index if not exists encounters_wound_time_idx on public.encounters(wound_id, occurred_at desc) where wound_id is not null;
create index if not exists appointments_clinic_due_idx on public.appointments(clinic_id, due_at, status);
create index if not exists appointments_patient_due_idx on public.appointments(patient_id, due_at desc);

alter table public.encounters enable row level security;
alter table public.appointments enable row level security;

-- Members can read within their clinic; only MFA-authenticated clinical roles can write.
drop policy if exists "members read encounters" on public.encounters;
drop policy if exists "clinicians manage encounters" on public.encounters;
create policy "members read encounters" on public.encounters for select
  using (public.is_clinic_member(clinic_id));
create policy "clinicians insert encounters" on public.encounters for insert
  with check (public.has_clinic_role(clinic_id, array['owner','admin','clinician']::public.member_role[])
    and created_by = auth.uid());
create policy "clinicians update encounters" on public.encounters for update
  using (public.has_clinic_role(clinic_id, array['owner','admin','clinician']::public.member_role[]))
  with check (public.has_clinic_role(clinic_id, array['owner','admin','clinician']::public.member_role[]));

drop policy if exists "members read appointments" on public.appointments;
drop policy if exists "clinicians manage appointments" on public.appointments;
create policy "members read appointments" on public.appointments for select
  using (public.is_clinic_member(clinic_id));
create policy "clinicians insert appointments" on public.appointments for insert
  with check (public.has_clinic_role(clinic_id, array['owner','admin','clinician']::public.member_role[])
    and created_by = auth.uid());
create policy "clinicians update appointments" on public.appointments for update
  using (public.has_clinic_role(clinic_id, array['owner','admin','clinician']::public.member_role[]))
  with check (public.has_clinic_role(clinic_id, array['owner','admin','clinician']::public.member_role[]));

-- Make source assessment linkage tenant/patient-safe for care plans.
alter table public.assessments
  drop constraint if exists assessments_id_patient_clinic_unique;
alter table public.assessments
  add constraint assessments_id_patient_clinic_unique unique (id, patient_id, clinic_id);
alter table public.care_plans
  drop constraint if exists care_plans_source_assessment_id_fkey;
alter table public.care_plans
  add constraint care_plans_source_assessment_patient_clinic_fkey
  foreign key (source_assessment_id, patient_id, clinic_id)
  references public.assessments(id, patient_id, clinic_id)
  on delete set null (source_assessment_id);

-- Updated-at trigger shared by mutable clinical tables.
create or replace function public.set_updated_at()
returns trigger language plpgsql
set search_path = public, pg_temp
as $$ begin new.updated_at = now(); return new; end; $$;

drop trigger if exists patients_set_updated_at on public.patients;
create trigger patients_set_updated_at before update on public.patients
for each row execute function public.set_updated_at();
drop trigger if exists wounds_set_updated_at on public.wounds;
create trigger wounds_set_updated_at before update on public.wounds
for each row execute function public.set_updated_at();
drop trigger if exists encounters_set_updated_at on public.encounters;
create trigger encounters_set_updated_at before update on public.encounters
for each row execute function public.set_updated_at();
drop trigger if exists appointments_set_updated_at on public.appointments;
create trigger appointments_set_updated_at before update on public.appointments
for each row execute function public.set_updated_at();

-- Audit is server-generated and stores field names only, never clinical values or PHI.
alter table public.audit_events alter column actor_id drop not null;
alter table public.audit_events add column if not exists actor_kind text not null default 'user'
  check (actor_kind in ('user','service'));
alter table public.audit_events add column if not exists request_id text;
drop policy if exists "members append audit" on public.audit_events;

create or replace function public.woundai_audit_row()
returns trigger
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  row_data jsonb;
  changed text[] := array[]::text[];
  clinic uuid;
  resource uuid;
  request_headers jsonb := '{}'::jsonb;
  operation text := lower(tg_op);
begin
  begin
    request_headers := coalesce(nullif(current_setting('request.headers', true), '')::jsonb, '{}'::jsonb);
  exception when others then request_headers := '{}'::jsonb;
  end;
  if tg_op = 'DELETE' then row_data := to_jsonb(old); else row_data := to_jsonb(new); end if;
  clinic := nullif(row_data ->> 'clinic_id','')::uuid;
  resource := nullif(row_data ->> 'id','')::uuid;
  if tg_op = 'UPDATE' then
    select coalesce(array_agg(n.key order by n.key), array[]::text[])
      into changed
      from jsonb_each(to_jsonb(new)) n
      join jsonb_each(to_jsonb(old)) o on o.key = n.key
      where n.value is distinct from o.value;
  elsif tg_op = 'INSERT' then
    select coalesce(array_agg(key order by key), array[]::text[])
      into changed from jsonb_object_keys(to_jsonb(new)) as keys(key);
  else
    select coalesce(array_agg(key order by key), array[]::text[])
      into changed from jsonb_object_keys(to_jsonb(old)) as keys(key);
  end if;
  if clinic is not null then
    insert into public.audit_events
      (clinic_id, actor_id, actor_kind, action, resource_type, resource_id, request_id, metadata)
    values
      (clinic, auth.uid(), case when auth.uid() is null then 'service' else 'user' end,
       operation, tg_table_name, resource,
       nullif(request_headers ->> 'x-request-id',''),
       jsonb_build_object('changed_fields', changed));
  end if;
  if tg_op = 'DELETE' then return old; else return new; end if;
end;
$$;

-- Membership changes are security events; record them without storing clinical data.
create or replace function public.woundai_audit_membership()
returns trigger language plpgsql security definer
set search_path = public, pg_temp
as $$
declare r record; op text := lower(tg_op);
begin
  if tg_op = 'DELETE' then r := old; else r := new; end if;
  insert into public.audit_events
    (clinic_id, actor_id, actor_kind, action, resource_type, resource_id, metadata)
  values
    (r.clinic_id, auth.uid(), case when auth.uid() is null then 'service' else 'user' end,
     op, 'clinic_members', r.user_id,
     jsonb_build_object('member_role', r.role));
  if tg_op = 'DELETE' then return old; else return new; end if;
end;
$$;
drop trigger if exists woundai_audit_clinic_members on public.clinic_members;
create trigger woundai_audit_clinic_members after insert or update or delete on public.clinic_members
for each row execute function public.woundai_audit_membership();

-- Audit triggers cover records that carry a clinic_id and UUID id.
do $$
declare t text;
begin
  foreach t in array array['patients','wounds','wound_images','assessments','care_plans','encounters','appointments'] loop
    execute format('drop trigger if exists %I on public.%I', 'woundai_audit_' || t, t);
    execute format('create trigger %I after insert or update or delete on public.%I for each row execute function public.woundai_audit_row()', 'woundai_audit_' || t, t);
  end loop;
end $$;

-- Audit log is append-only for application users; only owner/admin can read it (with MFA).
drop policy if exists "admins read audit" on public.audit_events;
create policy "admins read audit" on public.audit_events for select
  using (public.has_clinic_role(clinic_id, array['owner','admin']::public.member_role[]));
revoke insert, update, delete on public.audit_events from anon, authenticated;

-- Defensive path parsing for private Storage policies: malformed folder names never raise UUID cast errors.
create or replace function public.try_uuid(value text)
returns uuid language plpgsql immutable
set search_path = public, pg_temp
as $$ begin return value::uuid; exception when others then return null; end; $$;

drop policy if exists "clinic members read wound images" on storage.objects;
drop policy if exists "clinicians upload wound images" on storage.objects;
drop policy if exists "clinicians update wound images" on storage.objects;
drop policy if exists "admins delete wound images" on storage.objects;
create policy "clinic members read wound images" on storage.objects for select
using (bucket_id = 'wound-images'
  and public.try_uuid((storage.foldername(name))[1]) is not null
  and public.is_clinic_member(public.try_uuid((storage.foldername(name))[1])));
create policy "clinicians upload wound images" on storage.objects for insert
with check (bucket_id = 'wound-images'
  and public.try_uuid((storage.foldername(name))[1]) is not null
  and public.has_clinic_role(public.try_uuid((storage.foldername(name))[1]), array['owner','admin','clinician']::public.member_role[]));
create policy "clinicians update wound images" on storage.objects for update
using (bucket_id = 'wound-images'
  and public.try_uuid((storage.foldername(name))[1]) is not null
  and public.has_clinic_role(public.try_uuid((storage.foldername(name))[1]), array['owner','admin','clinician']::public.member_role[]))
with check (bucket_id = 'wound-images'
  and public.try_uuid((storage.foldername(name))[1]) is not null
  and public.has_clinic_role(public.try_uuid((storage.foldername(name))[1]), array['owner','admin','clinician']::public.member_role[]));
create policy "admins delete wound images" on storage.objects for delete
using (bucket_id = 'wound-images'
  and public.try_uuid((storage.foldername(name))[1]) is not null
  and public.has_clinic_role(public.try_uuid((storage.foldername(name))[1]), array['owner','admin']::public.member_role[]));

update storage.buckets set public = false, file_size_limit = 12582912,
  allowed_mime_types = array['image/jpeg','image/png','image/webp']
where id = 'wound-images';

commit;
