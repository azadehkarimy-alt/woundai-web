-- WoundAI v30.8: complete local-first clinical record synchronization.
-- Generic record envelopes preserve the app's full local JSON shape while keeping image binaries in private Storage.
begin;

create table if not exists public.clinic_sync_records (
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  entity_type text not null check(entity_type in ('patient','wound','image','assessment','appointment')),
  local_id text not null check(length(local_id) between 1 and 200),
  dedupe_key text not null check(length(dedupe_key) between 1 and 250),
  payload jsonb,
  revision bigint not null default 1 check(revision > 0),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id),
  deleted_at timestamptz,
  primary key(clinic_id,entity_type,local_id),
  unique(clinic_id,entity_type,dedupe_key),
  check((deleted_at is not null) or (payload is not null))
);
create index if not exists clinic_sync_records_updated_idx
  on public.clinic_sync_records(clinic_id,updated_at);

-- Backfill existing normalized cloud rows so v30.8 does not strand v30.2-v30.7 data.
with patient_rows as (
  select p.*,lower(trim(p.record_code)) as normalized_code,
    count(*) over(partition by p.clinic_id,lower(trim(p.record_code))) as duplicate_count
  from public.patients p
  where coalesce(p.consent_record->>'consent'='true',false)
)
insert into public.clinic_sync_records(clinic_id,entity_type,local_id,dedupe_key,payload,revision,updated_at,updated_by)
select clinic_id,'patient',id::text,
  case when duplicate_count>1 then normalized_code||':'||id::text else coalesce(nullif(normalized_code,''),id::text) end,
  jsonb_build_object(
    'id',id::text,'name',full_name,'code',record_code,'dob',coalesce(date_of_birth::text,''),'sex',coalesce(sex,''),
    'diabetes',coalesce(diabetes,''),'vascular',coalesce(vascular_disease,''),'allergies',coalesce(allergies,''),'medications',coalesce(medications,''),
    'history',coalesce(medical_history,''),'phone',coalesce(phone,''),'emergencyContact',coalesce(emergency_contact,''),'photo','',
    'consent',coalesce(consent_record->>'consent'='true',false),
    'status',status,'created',created_at,'updated',updated_at
  ),1,updated_at,updated_by
from patient_rows
on conflict do nothing;

insert into public.clinic_sync_records(clinic_id,entity_type,local_id,dedupe_key,payload,revision,updated_at,updated_by)
select w.clinic_id,'wound',w.id::text,w.id::text,
  jsonb_build_object(
    'id',w.id::text,'patientId',w.patient_id::text,'etiology',coalesce(w.etiology,''),'site',w.anatomical_site,
    'bodyRegion',coalesce(w.body_region,''),'side',coalesce(w.laterality,''),'onset',coalesce(w.onset_date::text,''),'status',w.status,
    'notes',coalesce(w.clinical_notes,''),'followup',coalesce(w.followup_notes,''),'created',w.created_at
  ),1,w.updated_at,w.updated_by
from public.wounds w
join public.patients p on p.id=w.patient_id and p.clinic_id=w.clinic_id
where coalesce(p.consent_record->>'consent'='true',false)
on conflict do nothing;

insert into public.clinic_sync_records(clinic_id,entity_type,local_id,dedupe_key,payload,revision,updated_at,updated_by)
select wi.clinic_id,'image',wi.id::text,wi.id::text,
  jsonb_build_object(
    'id',wi.id::text,'patientId',wi.patient_id::text,'woundId',wi.wound_id::text,
    'created',wi.captured_at,'storage_path',wi.storage_path,'width',wi.width_px,'height',wi.height_px,
    'calibration',wi.calibration,'areaCm2',wi.traced_area_cm2,'measurementMethod',wi.measurement_method,
    'viewType',wi.metadata->>'view_type','viewLabel',wi.metadata->>'view_label','note',wi.metadata->>'note',
    'storedWidth',wi.metadata->'stored_width','storedHeight',wi.metadata->'stored_height',
    'points',coalesce(wi.metadata->'points','[]'::jsonb),'lengthCm',wi.metadata->'length_cm',
    'widthCm',wi.metadata->'width_cm','aiStatus',wi.metadata->>'ai_status',
    'reviewStatus',wi.metadata->>'review_status','boundaryClosed',coalesce((wi.metadata->>'boundary_closed')::boolean,false),
    'segmentation',wi.metadata->'segmentation'
  ),1,wi.captured_at,wi.created_by
from public.wound_images wi
join public.patients p on p.id=wi.patient_id and p.clinic_id=wi.clinic_id
where coalesce(p.consent_record->>'consent'='true',false)
on conflict do nothing;

insert into public.clinic_sync_records(clinic_id,entity_type,local_id,dedupe_key,payload,revision,updated_at,updated_by)
select a.clinic_id,'assessment',a.id::text,a.id::text,
  jsonb_build_object(
    'id',a.id::text,'patientId',a.patient_id::text,'woundId',a.wound_id::text,
    'imageId',a.image_id::text,'created',a.assessed_at,'kind',a.assessment_type,
    'data',case when a.encounter_id is null then a.data else jsonb_set(a.data,'{encounterId}',to_jsonb(a.encounter_id::text),true) end
  ),1,a.assessed_at,a.created_by
from public.assessments a
join public.patients p on p.id=a.patient_id and p.clinic_id=a.clinic_id
where coalesce(p.consent_record->>'consent'='true',false)
on conflict do nothing;

insert into public.clinic_sync_records(clinic_id,entity_type,local_id,dedupe_key,payload,revision,updated_at,updated_by)
select cp.clinic_id,'assessment','careplan:'||cp.id::text,'careplan:'||cp.id::text,
  jsonb_build_object(
    'id','careplan:'||cp.id::text,'patientId',cp.patient_id::text,'woundId',cp.wound_id::text,
    'created',cp.created_at,'kind','care-plan-stage7',
    'data',coalesce(cp.plan,'{}'::jsonb)||jsonb_build_object(
      'status',cp.status,'clinician',cp.clinician_name,'credential',cp.clinician_credential,
      'reviewedAt',cp.approved_at,'sourceAssessmentId',cp.source_assessment_id::text
    )
  ),1,cp.created_at,cp.created_by
from public.care_plans cp
join public.patients p on p.id=cp.patient_id and p.clinic_id=cp.clinic_id
where coalesce(p.consent_record->>'consent'='true',false)
on conflict do nothing;

insert into public.clinic_sync_records(clinic_id,entity_type,local_id,dedupe_key,payload,revision,updated_at,updated_by)
select ap.clinic_id,'appointment',ap.id::text,ap.id::text,
  jsonb_build_object(
    'id',ap.id::text,'patientId',ap.patient_id::text,'woundId',ap.wound_id::text,
    'due',ap.due_at,'lead',ap.reminder_lead_days,'notes',coalesce(ap.notes,''),'status',ap.status,'created',ap.created_at
  ),1,ap.updated_at,ap.created_by
from public.appointments ap
join public.patients p on p.id=ap.patient_id and p.clinic_id=ap.clinic_id
where coalesce(p.consent_record->>'consent'='true',false)
on conflict do nothing;
alter table public.clinic_sync_records enable row level security;
drop policy if exists "clinical roles delete wound images v30.8" on storage.objects;
create policy "clinical roles delete wound images v30.8" on storage.objects for delete
using (
  bucket_id='wound-images'
  and public.has_clinic_role(public.try_uuid((storage.foldername(name))[1]),
    array['owner','admin','clinician']::public.member_role[])
);

revoke all on table public.clinic_sync_records from anon,authenticated;
grant select on table public.clinic_sync_records to authenticated;

drop policy if exists "members read sync records" on public.clinic_sync_records;
create policy "members read sync records" on public.clinic_sync_records
for select using(public.is_clinic_member(clinic_id));

create or replace function public.woundai_mirror_sync_record(
  target_clinic uuid,
  entity text,
  local_key text,
  record_payload jsonb,
  is_deleted boolean
) returns void
language plpgsql security definer set search_path=public,pg_temp
as $$
declare
  record_id uuid;
  v_patient_id uuid;
  v_wound_id uuid;
  v_image_id uuid;
  v_encounter_id uuid;
  v_source_assessment_id uuid;
  care_plan boolean;
  record_status text;
  due_value timestamptz;
begin
  care_plan := entity='assessment' and
    (local_key like 'careplan:%' or record_payload->>'kind'='care-plan-stage7');
  record_id := public.try_uuid(
    case when entity='assessment' and local_key like 'careplan:%'
      then substring(local_key from 10)
      else coalesce(record_payload->>'id',local_key) end
  );
  if record_id is null then raise exception 'شناسه ابری رکورد برای جدول بالینی معتبر نیست.'; end if;
  if entity='assessment' and is_deleted and exists(
    select 1 from public.care_plans where id=record_id and clinic_id=target_clinic
  ) then care_plan:=true; end if;

  if is_deleted then
    if entity='patient' then
      update public.assessments set image_id=null where clinic_id=target_clinic and patient_id=record_id;
      delete from public.assessments where clinic_id=target_clinic and patient_id=record_id;
      delete from public.care_plans where clinic_id=target_clinic and patient_id=record_id;
      delete from public.appointments where clinic_id=target_clinic and patient_id=record_id;
      delete from public.wound_images where clinic_id=target_clinic and patient_id=record_id;
      delete from public.wounds where clinic_id=target_clinic and patient_id=record_id;
      delete from public.patients where id=record_id and clinic_id=target_clinic;
    elsif entity='wound' then
      update public.assessments set image_id=null where clinic_id=target_clinic and wound_id=record_id;
      delete from public.assessments where clinic_id=target_clinic and wound_id=record_id;
      delete from public.care_plans where clinic_id=target_clinic and wound_id=record_id;
      delete from public.appointments where clinic_id=target_clinic and wound_id=record_id;
      delete from public.wound_images where clinic_id=target_clinic and wound_id=record_id;
      delete from public.wounds where id=record_id and clinic_id=target_clinic;
    elsif entity='image' then
      update public.assessments set image_id=null
        where clinic_id=target_clinic and image_id=record_id;
      delete from public.wound_images where id=record_id and clinic_id=target_clinic;
    elsif entity='assessment' and care_plan then
      delete from public.care_plans where id=record_id and clinic_id=target_clinic;
    elsif entity='assessment' then
      delete from public.assessments where id=record_id and clinic_id=target_clinic;
    elsif entity='appointment' then
      delete from public.appointments where id=record_id and clinic_id=target_clinic;
    end if;
    return;
  end if;

  if entity='patient' then
    if exists(select 1 from public.patients where id=record_id and clinic_id<>target_clinic) then
      raise exception 'شناسه بیمار در مرکز دیگری ثبت شده است.';
    end if;
    insert into public.patients(
      id,clinic_id,record_code,full_name,date_of_birth,sex,diabetes,vascular_disease,
      allergies,medications,medical_history,phone,emergency_contact,consent_record,status,created_at,updated_at
    ) values(
      record_id,target_clinic,coalesce(record_payload->>'code',''),coalesce(record_payload->>'name',''),
      nullif(record_payload->>'dob','')::date,nullif(record_payload->>'sex',''),
      nullif(record_payload->>'diabetes',''),nullif(record_payload->>'vascular',''),
      nullif(record_payload->>'allergies',''),nullif(record_payload->>'medications',''),
      nullif(record_payload->>'history',''),nullif(record_payload->>'phone',''),
      nullif(record_payload->>'emergencyContact',''),
      jsonb_build_object('consent',coalesce((record_payload->>'consent')::boolean,false),'source','v30.8-sync'),
      case when record_payload->>'status'='archived' then 'archived' else 'active' end,
      coalesce(nullif(record_payload->>'created','')::timestamptz,now()),
      coalesce(nullif(record_payload->>'updated','')::timestamptz,now())
    )
    on conflict(id) do update set
      record_code=excluded.record_code,full_name=excluded.full_name,date_of_birth=excluded.date_of_birth,
      sex=excluded.sex,diabetes=excluded.diabetes,vascular_disease=excluded.vascular_disease,
      allergies=excluded.allergies,medications=excluded.medications,medical_history=excluded.medical_history,
      phone=excluded.phone,emergency_contact=excluded.emergency_contact,consent_record=excluded.consent_record,
      status=excluded.status,updated_at=now()
    where public.patients.clinic_id=excluded.clinic_id;

  elsif entity='wound' then
    v_patient_id:=public.try_uuid(record_payload->>'patientId');
    if v_patient_id is null then raise exception 'شناسه بیمار زخم معتبر نیست.'; end if;
    if exists(select 1 from public.wounds where id=record_id and clinic_id<>target_clinic) then
      raise exception 'شناسه زخم در مرکز دیگری ثبت شده است.';
    end if;
    record_status:=case when record_payload->>'status'='closed' then 'healed'
      when record_payload->>'status' in ('healed','archived') then record_payload->>'status' else 'active' end;
    insert into public.wounds(
      id,clinic_id,patient_id,etiology,anatomical_site,body_region,laterality,onset_date,
      clinical_notes,followup_notes,status,created_at,updated_at
    ) values(
      record_id,target_clinic,v_patient_id,nullif(record_payload->>'etiology',''),
      coalesce(nullif(record_payload->>'site',''),'نامشخص'),
      nullif(record_payload->>'bodyRegion',''),nullif(record_payload->>'side',''),
      nullif(record_payload->>'onset','')::date,nullif(record_payload->>'notes',''),
      nullif(record_payload->>'followup',''),record_status,
      coalesce(nullif(record_payload->>'created','')::timestamptz,now()),now()
    )
    on conflict(id) do update set
      patient_id=excluded.patient_id,etiology=excluded.etiology,anatomical_site=excluded.anatomical_site,
      body_region=excluded.body_region,laterality=excluded.laterality,onset_date=excluded.onset_date,
      clinical_notes=excluded.clinical_notes,followup_notes=excluded.followup_notes,
      status=excluded.status,updated_at=now()
    where public.wounds.clinic_id=excluded.clinic_id;

  elsif entity='image' then
    v_patient_id:=public.try_uuid(record_payload->>'patientId');
    v_wound_id:=public.try_uuid(record_payload->>'woundId');
    if v_patient_id is null or v_wound_id is null or nullif(record_payload->>'storage_path','') is null then
      raise exception 'تصویر برای همگام‌سازی به شناسه بیمار، زخم و مسیر Storage نیاز دارد.';
    end if;
    if exists(select 1 from public.wound_images where id=record_id and clinic_id<>target_clinic) then
      raise exception 'شناسه تصویر در مرکز دیگری ثبت شده است.';
    end if;
    insert into public.wound_images(
      id,clinic_id,patient_id,wound_id,storage_path,captured_at,width_px,height_px,
      calibration,traced_area_cm2,measurement_method,metadata
    ) values(
      record_id,target_clinic,v_patient_id,v_wound_id,record_payload->>'storage_path',
      coalesce(nullif(record_payload->>'created','')::timestamptz,now()),
      nullif(record_payload->>'width','')::integer,nullif(record_payload->>'height','')::integer,
      record_payload->'calibration',nullif(record_payload->>'areaCm2','')::numeric,
      coalesce(nullif(record_payload->>'measurementMethod',''),'manual-clinician-reviewed'),
      jsonb_build_object(
        'view_type',record_payload->'viewType','view_label',record_payload->'viewLabel',
        'note',record_payload->'note','stored_width',record_payload->'storedWidth',
        'stored_height',record_payload->'storedHeight','points',coalesce(record_payload->'points','[]'::jsonb),
        'length_cm',record_payload->'lengthCm','width_cm',record_payload->'widthCm',
        'ai_status',record_payload->'aiStatus','review_status',record_payload->'reviewStatus',
        'boundary_closed',coalesce((record_payload->>'boundaryClosed')::boolean,false),
        'segmentation',record_payload->'segmentation'
      )
    )
    on conflict(id) do update set
      patient_id=excluded.patient_id,wound_id=excluded.wound_id,storage_path=excluded.storage_path,
      captured_at=excluded.captured_at,width_px=excluded.width_px,height_px=excluded.height_px,
      calibration=excluded.calibration,traced_area_cm2=excluded.traced_area_cm2,
      measurement_method=excluded.measurement_method,metadata=excluded.metadata
    where public.wound_images.clinic_id=excluded.clinic_id;

  elsif entity='assessment' and care_plan then
    if exists(select 1 from public.care_plans where id=record_id and clinic_id<>target_clinic) then
      raise exception 'شناسه برنامه مراقبتی در مرکز دیگری ثبت شده است.';
    end if;
    v_patient_id:=public.try_uuid(record_payload->>'patientId');
    v_wound_id:=public.try_uuid(record_payload->>'woundId');
    v_source_assessment_id:=public.try_uuid(record_payload->'data'->>'sourceAssessmentId');
    if v_patient_id is null or v_wound_id is null then raise exception 'برنامه مراقبتی فاقد شناسه بیمار یا زخم است.'; end if;
    if v_source_assessment_id is not null and not exists(
      select 1 from public.assessments a where a.id=v_source_assessment_id and a.patient_id=v_patient_id and a.clinic_id=target_clinic
    ) then v_source_assessment_id:=null; end if;
    record_status:=case when record_payload->'data'->>'status'='approved' then 'approved'
      when record_payload->'data'->>'status'='superseded' then 'superseded' else 'draft' end;
    insert into public.care_plans(
      id,clinic_id,patient_id,wound_id,source_assessment_id,status,plan,
      clinician_name,clinician_credential,approved_at,created_at
    ) values(
      record_id,target_clinic,v_patient_id,v_wound_id,v_source_assessment_id,record_status,
      coalesce(record_payload->'data','{}'::jsonb),nullif(record_payload->'data'->>'clinician',''),
      nullif(record_payload->'data'->>'credential',''),
      nullif(record_payload->'data'->>'reviewedAt','')::timestamptz,
      coalesce(nullif(record_payload->>'created','')::timestamptz,now())
    )
    on conflict(id) do update set
      patient_id=excluded.patient_id,wound_id=excluded.wound_id,source_assessment_id=excluded.source_assessment_id,
      status=excluded.status,plan=excluded.plan,clinician_name=excluded.clinician_name,
      clinician_credential=excluded.clinician_credential,approved_at=excluded.approved_at
    where public.care_plans.clinic_id=excluded.clinic_id;

  elsif entity='assessment' then
    if exists(select 1 from public.assessments where id=record_id and clinic_id<>target_clinic) then
      raise exception 'شناسه ارزیابی در مرکز دیگری ثبت شده است.';
    end if;
    v_patient_id:=public.try_uuid(record_payload->>'patientId');
    v_wound_id:=public.try_uuid(record_payload->>'woundId');
    v_image_id:=public.try_uuid(record_payload->>'imageId');
    v_encounter_id:=public.try_uuid(record_payload->'data'->>'encounterId');
    if v_patient_id is null or v_wound_id is null then raise exception 'ارزیابی فاقد شناسه بیمار یا زخم است.'; end if;
    if v_image_id is not null and not exists(select 1 from public.wound_images wi where wi.id=v_image_id and wi.patient_id=v_patient_id and wi.clinic_id=target_clinic) then v_image_id:=null; end if;
    if v_encounter_id is not null then
      if exists(select 1 from public.encounters where id=v_encounter_id and clinic_id<>target_clinic) then
        raise exception 'شناسه مراجعه در مرکز دیگری ثبت شده است.';
      end if;
      insert into public.encounters(id,clinic_id,patient_id,wound_id,occurred_at,recorded_by,metadata)
      values(v_encounter_id,target_clinic,v_patient_id,v_wound_id,
        coalesce(nullif(record_payload->>'created','')::timestamptz,now()),
        'v30.8-sync',jsonb_build_object('source','clinical-sync'))
      on conflict(id) do nothing;
    end if;
    insert into public.assessments(
      id,clinic_id,patient_id,wound_id,image_id,encounter_id,assessment_type,assessed_at,data
    ) values(
      record_id,target_clinic,v_patient_id,v_wound_id,v_image_id,v_encounter_id,
      coalesce(nullif(record_payload->>'kind',''),'assessment'),
      coalesce(nullif(record_payload->>'created','')::timestamptz,now()),
      coalesce(record_payload->'data','{}'::jsonb)
    )
    on conflict(id) do update set
      patient_id=excluded.patient_id,wound_id=excluded.wound_id,image_id=excluded.image_id,
      encounter_id=excluded.encounter_id,assessment_type=excluded.assessment_type,
      assessed_at=excluded.assessed_at,data=excluded.data
    where public.assessments.clinic_id=excluded.clinic_id;

  elsif entity='appointment' then
    if exists(select 1 from public.appointments where id=record_id and clinic_id<>target_clinic) then
      raise exception 'شناسه نوبت در مرکز دیگری ثبت شده است.';
    end if;
    v_patient_id:=public.try_uuid(record_payload->>'patientId');
    v_wound_id:=public.try_uuid(record_payload->>'woundId');
    due_value:=nullif(record_payload->>'due','')::timestamptz;
    if v_patient_id is null or v_wound_id is null or due_value is null then
      raise exception 'نوبت فاقد بیمار، زخم یا تاریخ معتبر است.';
    end if;
    record_status:=case when record_payload->>'status' in ('completed','cancelled','rescheduled','missed')
      then record_payload->>'status' else 'scheduled' end;
    insert into public.appointments(
      id,clinic_id,patient_id,wound_id,due_at,reminder_lead_days,notes,status,created_at,updated_at
    ) values(
      record_id,target_clinic,v_patient_id,v_wound_id,due_value,
      greatest(0,least(365,coalesce(nullif(record_payload->>'lead','')::integer,0))),
      nullif(record_payload->>'notes',''),record_status,
      coalesce(nullif(record_payload->>'created','')::timestamptz,now()),now()
    )
    on conflict(id) do update set
      patient_id=excluded.patient_id,wound_id=excluded.wound_id,due_at=excluded.due_at,
      reminder_lead_days=excluded.reminder_lead_days,notes=excluded.notes,status=excluded.status,updated_at=now()
    where public.appointments.clinic_id=excluded.clinic_id;
  end if;
end;
$$;

create or replace function public.sync_clinic_records(
  target_clinic uuid,
  changes jsonb
) returns jsonb
language plpgsql security definer set search_path=public,pg_temp
as $$
declare
  item jsonb;
  existing public.clinic_sync_records%rowtype;
  entity text;
  local_key text;
  dedupe text;
  expected bigint;
  is_deleted boolean;
  applied jsonb := '[]'::jsonb;
  conflicts jsonb := '[]'::jsonb;
  duplicate_row public.clinic_sync_records%rowtype;
  applied_row public.clinic_sync_records%rowtype;
  actor_role public.member_role;
  n integer := 0;
begin
  select role into actor_role from public.clinic_members
    where clinic_id=target_clinic and user_id=auth.uid();
  if actor_role is null or actor_role not in ('owner','admin','clinician') then
    raise exception 'برای همگام‌سازی اطلاعات بالینی دسترسی نوشتن ندارید.' using errcode='42501';
  end if;
  if changes is null or jsonb_typeof(changes) <> 'array' or jsonb_array_length(changes)>100 then
    raise exception 'بسته همگام‌سازی باید آرایه‌ای با حداکثر ۱۰۰ رکورد باشد.';
  end if;

  for item in select value from jsonb_array_elements(changes) loop
    n:=n+1;
    entity:=item->>'entity_type';
    local_key:=item->>'local_id';
    dedupe:=item->>'dedupe_key';
    expected:=coalesce((item->>'expected_revision')::bigint,0);
    is_deleted:=coalesce((item->>'deleted')::boolean,false);

    if entity is null or entity not in ('patient','wound','image','assessment','appointment')
       or local_key is null or length(local_key)<1 or length(local_key)>200
       or dedupe is null or length(dedupe)<1 or length(dedupe)>250
       or expected<0 then
      raise exception 'ساختار رکورد همگام‌سازی معتبر نیست.';
    end if;
    if not is_deleted and (item->'payload' is null or jsonb_typeof(item->'payload')<>'object') then
      raise exception 'محتوای رکورد همگام‌سازی باید شیء JSON باشد.';
    end if;
    if octet_length(coalesce((item->'payload')::text,''))>1048576 then
      raise exception 'حجم metadata رکورد از یک مگابایت بیشتر است.';
    end if;

    if entity='patient' and not is_deleted then
      select * into duplicate_row from public.clinic_sync_records
        where clinic_id=target_clinic and entity_type='patient'
          and local_id<>local_key and deleted_at is null
          and lower(trim(payload->>'code'))=lower(trim(item->'payload'->>'code'))
        limit 1;
      if found then
        conflicts:=conflicts||jsonb_build_array(jsonb_build_object(
          'entity_type',entity,'local_id',local_key,'reason','duplicate_key','current',to_jsonb(duplicate_row)));
        continue;
      end if;
    end if;

    select * into existing from public.clinic_sync_records
      where clinic_id=target_clinic and entity_type=entity and local_id=local_key
      for update;

    if not found then
      if expected<>0 then
        conflicts:=conflicts||jsonb_build_array(jsonb_build_object(
          'entity_type',entity,'local_id',local_key,'reason','missing_remote','current',null));
        continue;
      end if;
      begin
        insert into public.clinic_sync_records(
          clinic_id,entity_type,local_id,dedupe_key,payload,revision,updated_by,deleted_at
        ) values(
          target_clinic,entity,local_key,dedupe,
          case when is_deleted then null else item->'payload' end,
          1,auth.uid(),case when is_deleted then now() else null end
        ) returning * into applied_row;
      exception when unique_violation then
        select * into duplicate_row from public.clinic_sync_records
          where clinic_id=target_clinic and entity_type=entity and dedupe_key=dedupe
          limit 1;
        conflicts:=conflicts||jsonb_build_array(jsonb_build_object(
          'entity_type',entity,'local_id',local_key,'reason','duplicate_key','current',to_jsonb(duplicate_row)));
        continue;
      end;
    else
      if existing.revision<>expected then
        conflicts:=conflicts||jsonb_build_array(jsonb_build_object(
          'entity_type',entity,'local_id',local_key,'reason','stale_revision','current',to_jsonb(existing)));
        continue;
      end if;
      begin
        update public.clinic_sync_records set
          dedupe_key=dedupe,
          payload=case when is_deleted then null else item->'payload' end,
          revision=revision+1,
          updated_at=now(),
          updated_by=auth.uid(),
          deleted_at=case when is_deleted then now() else null end
        where clinic_id=target_clinic and entity_type=entity and local_id=local_key
        returning * into applied_row;
      exception when unique_violation then
        select * into duplicate_row from public.clinic_sync_records
          where clinic_id=target_clinic and entity_type=entity and dedupe_key=dedupe
          limit 1;
        conflicts:=conflicts||jsonb_build_array(jsonb_build_object(
          'entity_type',entity,'local_id',local_key,'reason','duplicate_key','current',to_jsonb(duplicate_row)));
        continue;
      end;
    end if;

    perform public.woundai_mirror_sync_record(target_clinic,entity,local_key,coalesce(applied_row.payload,item->'previous_payload'),is_deleted);
    applied:=applied||jsonb_build_array(to_jsonb(applied_row));
  end loop;

  if n>0 then
    insert into public.audit_events(clinic_id,actor_id,action,resource_type,metadata)
    values(target_clinic,auth.uid(),'clinical_sync_batch','clinic_sync_records',
      jsonb_build_object('submitted',n,'applied',jsonb_array_length(applied),'conflicts',jsonb_array_length(conflicts)));
  end if;
  return jsonb_build_object('applied',applied,'conflicts',conflicts,'submitted',n);
end;
$$;

revoke all on function public.woundai_mirror_sync_record(uuid,text,text,jsonb,boolean) from public;
revoke all on function public.sync_clinic_records(uuid,jsonb) from public;
grant execute on function public.sync_clinic_records(uuid,jsonb) to authenticated;

commit;
