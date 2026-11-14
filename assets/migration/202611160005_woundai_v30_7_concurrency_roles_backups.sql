-- WoundAI v30.7: optimistic concurrency, member administration and logical backups.
-- Apply after v30.6. Backups contain database rows and Storage paths, not image binaries.
begin;

-- Revision columns support compare-and-swap updates across devices.
alter table public.patients add column if not exists revision bigint not null default 1,
  add column if not exists updated_by uuid references auth.users(id);
alter table public.wounds add column if not exists revision bigint not null default 1,
  add column if not exists updated_by uuid references auth.users(id);
alter table public.wound_images add column if not exists revision bigint not null default 1,
  add column if not exists updated_at timestamptz not null default now(),
  add column if not exists updated_by uuid references auth.users(id);
alter table public.assessments add column if not exists revision bigint not null default 1,
  add column if not exists updated_at timestamptz not null default now(),
  add column if not exists updated_by uuid references auth.users(id);
alter table public.care_plans add column if not exists revision bigint not null default 1,
  add column if not exists updated_at timestamptz not null default now(),
  add column if not exists updated_by uuid references auth.users(id);
alter table public.encounters add column if not exists revision bigint not null default 1,
  add column if not exists updated_at timestamptz not null default now(),
  add column if not exists updated_by uuid references auth.users(id);
alter table public.appointments add column if not exists revision bigint not null default 1,
  add column if not exists updated_by uuid references auth.users(id);
alter table public.clinic_members add column if not exists updated_at timestamptz not null default now(),
  add column if not exists updated_by uuid references auth.users(id);

create or replace function public.woundai_revision_stamp()
returns trigger language plpgsql set search_path=public,pg_temp
as $$
begin
  new.revision := old.revision + 1;
  new.updated_at := now();
  new.updated_by := auth.uid();
  return new;
end;
$$;

do $$
declare t text;
begin
  foreach t in array array['patients','wounds','wound_images','assessments','care_plans','encounters','appointments'] loop
    execute format('drop trigger if exists %I on public.%I','woundai_revision_'||t,t);
    execute format('create trigger %I before update on public.%I for each row execute function public.woundai_revision_stamp()','woundai_revision_'||t,t);
  end loop;
end $$;

create or replace function public.woundai_member_updated_at()
returns trigger language plpgsql set search_path=public,pg_temp
as $$
begin
  new.updated_at := now();
  new.updated_by := auth.uid();
  return new;
end;
$$;
drop trigger if exists woundai_member_updated_at on public.clinic_members;
create trigger woundai_member_updated_at before update on public.clinic_members
for each row execute function public.woundai_member_updated_at();

-- Existing members can be assigned roles; user invitation/email delivery remains an Auth/admin workflow.
create or replace function public.manage_clinic_member(
  target_clinic uuid,
  target_user uuid,
  target_role public.member_role default null,
  remove_member boolean default false
) returns jsonb
language plpgsql security definer set search_path=public,auth,pg_temp
as $$
declare actor_role public.member_role; existing_role public.member_role; owner_count integer;
begin
  select role into actor_role from public.clinic_members
   where clinic_id=target_clinic and user_id=auth.uid();
  if actor_role is null or actor_role not in ('owner','admin') then
    raise exception 'اجازه مدیریت اعضای این مرکز را ندارید.' using errcode='42501';
  end if;
  if target_user is null or target_user= '00000000-0000-0000-0000-000000000000'::uuid then
    raise exception 'شناسه کاربر معتبر نیست.';
  end if;
  select role into existing_role from public.clinic_members
   where clinic_id=target_clinic and user_id=target_user;

  if actor_role='admin' and existing_role in ('owner','admin') then
    raise exception 'مدیر مرکز نمی‌تواند مالک یا مدیر دیگر را تغییر دهد.' using errcode='42501';
  end if;
  if actor_role='admin' and target_role in ('owner','admin') then
    raise exception 'مدیر مرکز فقط می‌تواند نقش درمانگر، بازبین یا مشاهده‌گر اختصاص دهد.' using errcode='42501';
  end if;

  if remove_member then
    if existing_role is null then raise exception 'عضویت موردنظر پیدا نشد.'; end if;
    if existing_role='owner' then
      select count(*) into owner_count from public.clinic_members
       where clinic_id=target_clinic and role='owner';
      if owner_count <= 1 then raise exception 'حذف آخرین مالک مرکز مجاز نیست.'; end if;
    end if;
    delete from public.clinic_members where clinic_id=target_clinic and user_id=target_user;
    insert into public.audit_events(clinic_id,actor_id,action,resource_type,metadata)
      values(target_clinic,auth.uid(),'member_removed','clinic_member',jsonb_build_object('target_user',target_user));
    return jsonb_build_object('ok',true,'removed',true,'user_id',target_user);
  end if;

  if target_role is null then raise exception 'نقش جدید مشخص نشده است.'; end if;
  if existing_role='owner' and target_role<>'owner' then
    select count(*) into owner_count from public.clinic_members
     where clinic_id=target_clinic and role='owner';
    if owner_count <= 1 then raise exception 'تغییر نقش آخرین مالک مرکز مجاز نیست.'; end if;
  end if;
  if not exists(select 1 from auth.users where id=target_user) then
    raise exception 'کاربر با این شناسه در سامانه احراز هویت وجود ندارد.';
  end if;

  insert into public.clinic_members(clinic_id,user_id,role)
  values(target_clinic,target_user,target_role)
  on conflict(clinic_id,user_id) do update set role=excluded.role, updated_at=now(), updated_by=auth.uid();

  insert into public.audit_events(clinic_id,actor_id,action,resource_type,metadata)
    values(target_clinic,auth.uid(),case when existing_role is null then 'member_added' else 'member_role_changed' end,
      'clinic_member',jsonb_build_object('target_user',target_user,'old_role',existing_role,'new_role',target_role));
  return jsonb_build_object('ok',true,'user_id',target_user,'role',target_role);
end;
$$;

-- Private, logical database snapshots. Storage object binaries are not included.
create table if not exists public.clinic_backups (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  backup_version integer not null default 1,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  status text not null default 'completed' check(status in ('completed','failed')),
  record_counts jsonb not null default '{}'::jsonb,
  storage_paths text[] not null default '{}',
  payload jsonb not null,
  unique(id,clinic_id)
);
create index if not exists clinic_backups_clinic_time_idx
  on public.clinic_backups(clinic_id,created_at desc);

alter table public.clinic_backups enable row level security;
drop policy if exists "admins read clinic backups" on public.clinic_backups;
create policy "admins read clinic backups" on public.clinic_backups
for select using(public.has_clinic_role(clinic_id,array['owner','admin']::public.member_role[]));

create or replace function public.woundai_write_clinic_backup(target_clinic uuid, backup_actor uuid)
returns uuid
language plpgsql security definer set search_path=public,pg_temp
as $$
declare snapshot jsonb; paths text[]; counts jsonb; backup_id uuid;
begin
  if backup_actor is null then raise exception 'Backup actor is required.'; end if;
  snapshot := jsonb_build_object(
    'patients',coalesce((select jsonb_agg(to_jsonb(x)) from public.patients x where x.clinic_id=target_clinic),'[]'::jsonb),
    'wounds',coalesce((select jsonb_agg(to_jsonb(x)) from public.wounds x where x.clinic_id=target_clinic),'[]'::jsonb),
    'wound_images',coalesce((select jsonb_agg(to_jsonb(x)) from public.wound_images x where x.clinic_id=target_clinic),'[]'::jsonb),
    'encounters',coalesce((select jsonb_agg(to_jsonb(x)) from public.encounters x where x.clinic_id=target_clinic),'[]'::jsonb),
    'assessments',coalesce((select jsonb_agg(to_jsonb(x)) from public.assessments x where x.clinic_id=target_clinic),'[]'::jsonb),
    'care_plans',coalesce((select jsonb_agg(to_jsonb(x)) from public.care_plans x where x.clinic_id=target_clinic),'[]'::jsonb),
    'appointments',coalesce((select jsonb_agg(to_jsonb(x)) from public.appointments x where x.clinic_id=target_clinic),'[]'::jsonb)
  );
  select coalesce(array_agg(storage_path),'{}') into paths
    from public.wound_images where clinic_id=target_clinic;
  counts := jsonb_build_object(
    'patients',jsonb_array_length(snapshot->'patients'),
    'wounds',jsonb_array_length(snapshot->'wounds'),
    'wound_images',jsonb_array_length(snapshot->'wound_images'),
    'encounters',jsonb_array_length(snapshot->'encounters'),
    'assessments',jsonb_array_length(snapshot->'assessments'),
    'care_plans',jsonb_array_length(snapshot->'care_plans'),
    'appointments',jsonb_array_length(snapshot->'appointments')
  );
  insert into public.clinic_backups(clinic_id,created_by,record_counts,storage_paths,payload)
    values(target_clinic,backup_actor,counts,paths,snapshot) returning id into backup_id;
  delete from public.clinic_backups where clinic_id=target_clinic and id not in (
    select id from public.clinic_backups where clinic_id=target_clinic
    order by created_at desc limit 30
  );
  insert into public.audit_events(clinic_id,actor_id,action,resource_type,resource_id,metadata)
    values(target_clinic,backup_actor,'backup_created','clinic_backup',backup_id,counts);
  return backup_id;
end;
$$;

create or replace function public.create_clinic_backup(target_clinic uuid)
returns jsonb
language plpgsql security definer set search_path=public,pg_temp
as $$
declare backup_id uuid; result jsonb;
begin
  if not public.has_clinic_role(target_clinic,array['owner','admin']::public.member_role[]) then
    raise exception 'فقط مالک یا مدیر مرکز می‌تواند پشتیبان ایجاد کند.' using errcode='42501';
  end if;
  backup_id := public.woundai_write_clinic_backup(target_clinic,auth.uid());
  select jsonb_build_object('id',id,'clinic_id',clinic_id,'created_at',created_at,
    'record_counts',record_counts,'storage_paths_count',coalesce(array_length(storage_paths,1),0))
    into result from public.clinic_backups where id=backup_id;
  return result;
end;
$$;

-- Called only by a database scheduler. It attributes each snapshot to the clinic owner.
create or replace function public.run_scheduled_clinic_backups()
returns integer
language plpgsql security definer set search_path=public,pg_temp
as $$
declare c record; owner_id uuid; done integer:=0;
begin
  for c in select id from public.clinics loop
    select user_id into owner_id from public.clinic_members
      where clinic_id=c.id and role='owner' order by created_at asc limit 1;
    if owner_id is not null then
      perform public.woundai_write_clinic_backup(c.id,owner_id);
      done:=done+1;
    end if;
  end loop;
  return done;
end;
$$;

create or replace function public.restore_clinic_backup(
  target_clinic uuid,
  target_backup uuid,
  confirmation_code text
) returns jsonb
language plpgsql security definer set search_path=public,pg_temp
as $$
declare snap jsonb; counts jsonb;
begin
  if not public.has_clinic_role(target_clinic,array['owner']::public.member_role[]) then
    raise exception 'بازیابی پشتیبان فقط برای مالک مرکز مجاز است.' using errcode='42501';
  end if;
  if confirmation_code is distinct from ('RESTORE-'||target_backup::text) then
    raise exception 'کد تأیید بازیابی صحیح نیست.';
  end if;
  select payload,record_counts into snap,counts from public.clinic_backups
    where id=target_backup and clinic_id=target_clinic and status='completed';
  if snap is null then raise exception 'پشتیبان معتبر برای این مرکز پیدا نشد.'; end if;

  insert into public.patients select * from jsonb_populate_recordset(null::public.patients,snap->'patients')
    on conflict do nothing;
  insert into public.wounds select * from jsonb_populate_recordset(null::public.wounds,snap->'wounds')
    on conflict do nothing;
  insert into public.wound_images select * from jsonb_populate_recordset(null::public.wound_images,snap->'wound_images')
    on conflict do nothing;
  insert into public.encounters select * from jsonb_populate_recordset(null::public.encounters,snap->'encounters')
    on conflict do nothing;
  insert into public.assessments select * from jsonb_populate_recordset(null::public.assessments,snap->'assessments')
    on conflict do nothing;
  insert into public.care_plans select * from jsonb_populate_recordset(null::public.care_plans,snap->'care_plans')
    on conflict do nothing;
  insert into public.appointments select * from jsonb_populate_recordset(null::public.appointments,snap->'appointments')
    on conflict do nothing;

  insert into public.audit_events(clinic_id,actor_id,action,resource_type,resource_id,metadata)
    values(target_clinic,auth.uid(),'backup_restored','clinic_backup',target_backup,counts);
  return jsonb_build_object('ok',true,'backup_id',target_backup,'record_counts',counts,'mode','insert-missing-only');
end;
$$;

revoke all on function public.manage_clinic_member(uuid,uuid,public.member_role,boolean) from public;
revoke all on function public.create_clinic_backup(uuid) from public;
revoke all on function public.restore_clinic_backup(uuid,uuid,text) from public;
revoke all on function public.woundai_write_clinic_backup(uuid,uuid) from public;
revoke all on function public.run_scheduled_clinic_backups() from public;
grant execute on function public.manage_clinic_member(uuid,uuid,public.member_role,boolean) to authenticated;
grant execute on function public.create_clinic_backup(uuid) to authenticated;
grant execute on function public.restore_clinic_backup(uuid,uuid,text) to authenticated;

commit;
