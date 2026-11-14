/* WoundAI v30.7 — explicit, resumable local/cloud record transfer.
 * No background sync. Local records are retained. Writes require an AAL2 session.
 */
(function () {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const MAP_KEY = 'woundai.cloud-id-map.v1';
  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  const TABLES = ['patients','wounds','wound_images','assessments','care_plans','encounters','appointments'];
  let lastPreview = null;
  let busy = false;

  function readMap() {
    try {
      const x = JSON.parse(localStorage.getItem(MAP_KEY) || '{}');
      return x && typeof x === 'object' && !Array.isArray(x) ? x : {};
    } catch { return {}; }
  }
  function writeMap(map) { localStorage.setItem(MAP_KEY, JSON.stringify(map)); }
  function cloudId(kind, localId, map, clinicId = 'default') {
    const persistImmediately = !map;
    map = map || readMap();
    const key = `${clinicId}:${kind}:${String(localId || '')}`;
    if (!localId) throw new Error(`شناسه محلی ${kind} خالی است.`);
    if (map[key]) return map[key];
    const value = UUID_RE.test(String(localId)) ? String(localId) : crypto.randomUUID();
    map[key] = value;
    if (persistImmediately) writeMap(map);
    return value;
  }
  function localId(kind, remoteId, map = readMap(), clinicId = 'default') {
    const prefix = `${clinicId}:${kind}:`;
    const entry = Object.entries(map).find(([key, value]) => key.startsWith(prefix) && value === remoteId);
    return entry ? entry[0].slice(prefix.length) : remoteId;
  }
  function adoptCloudId(kind, localIdValue, remoteId, clinicId='default') {
    if (!kind || !localIdValue || !remoteId) throw new Error('شناسه محلی و ابری برای نگاشت لازم است.');
    const map=readMap(),key=`${clinicId}:${kind}:${String(localIdValue)}`;
    const existing=map[key];
    if(existing&&existing!==remoteId)throw new Error('تعارض در نگاشت شناسه محلی و ابری؛ از بازنویسی ارتباط پرونده جلوگیری شد.');
    map[key]=String(remoteId);writeMap(map);return map[key];
  }
  function currentClient() {
    const client = window.WoundAISupabase;
    if (!client || !client.configured() || !client.authenticated()) throw new Error('ابتدا اتصال Supabase را تنظیم و وارد حساب شوید.');
    return client;
  }
  function currentClinic() {
    const clinicId = $('cloudClinicSelect')?.value;
    if (!clinicId || !UUID_RE.test(clinicId)) throw new Error('ابتدا یک مرکز درمانی معتبر انتخاب کنید.');
    return clinicId;
  }
  function setStatus(message, isError = false) {
    const node = $('cloudSyncStatus');
    if (node) {
      node.textContent = message;
      node.dataset.state = isError ? 'error' : 'ok';
    }
  }
  function setBusy(value) {
    busy = value;
    const client=window.WoundAISupabase;
    const readReady=!!(client?.authenticated() && $('cloudClinicSelect')?.value);
    const writeReady=readReady && client.getAal?.()==='aal2';
    if($('cloudSyncPreview'))$('cloudSyncPreview').disabled=value||!readReady;
    if($('cloudSyncDownload'))$('cloudSyncDownload').disabled=value||!readReady;
    if($('cloudSyncUpload'))$('cloudSyncUpload').disabled=value||!writeReady;
  }
  function currentClientReady() {
    try { return !!(window.WoundAISupabase?.authenticated() && $('cloudClinicSelect')?.value); }
    catch { return false; }
  }
  function safeIso(value, fallback = new Date().toISOString()) {
    const date = value ? new Date(value) : new Date(fallback);
    return Number.isNaN(date.getTime()) ? fallback : date.toISOString();
  }
  function dateOnly(value) {
    if (!value) return null;
    const s = String(value).slice(0,10);
    return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null;
  }
  function dueIso(value) {
    if (!value) return null;
    const s = String(value);
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return `${s}T12:00:00.000Z`;
    return safeIso(s, null);
  }
  function eligibleData() {
    const patients = Array.isArray(state.patients) ? state.patients : [];
    const eligible = patients.filter(p => p && p.consent === true);
    const eligibleIds = new Set(eligible.map(p => p.id));
    const wounds = (state.wounds || []).filter(w => w && eligibleIds.has(w.patientId));
    const woundIds = new Set(wounds.map(w => w.id));
    const images = (state.images || []).filter(x => x && eligibleIds.has(x.patientId) && woundIds.has(x.woundId));
    const assessments = (state.assessments || []).filter(a => {
      if (!a || a.kind === 'care-plan-stage7') return false;
      const wound = wounds.find(w => w.id === a.woundId);
      return !!(wound && (a.patientId ? eligibleIds.has(a.patientId) : true));
    });
    const carePlans = (state.assessments || []).filter(a => a?.kind === 'care-plan-stage7' && eligibleIds.has(a.patientId) && woundIds.has(a.woundId));
    const appointments = (state.appointments || []).filter(a => eligibleIds.has(a.patientId) && woundIds.has(a.woundId));
    return {
      patients: eligible, wounds, images, assessments, carePlans, appointments,
      missingConsent: patients.length - eligible.length,
      orphanWounds: (state.wounds || []).length - wounds.length,
      orphanImages: (state.images || []).length - images.length,
      orphanAssessments: (state.assessments || []).filter(a => a?.kind !== 'care-plan-stage7').length - assessments.length,
      orphanAppointments: (state.appointments || []).length - appointments.length
    };
  }
  async function preview() {
    const client = currentClient(), clinicId = currentClinic();
    await client.ensureFreshSession();
    const data = eligibleData();
    const remote = await client.listRows('patients', clinicId);
    const byCode = new Map(remote.map(p => [String(p.record_code).trim().toLowerCase(), p]));
    const conflicts = [];
    const matched = [];
    const localCodes = new Map();
    for (const p of data.patients) {
      const code=String(p.code||'').trim().toLowerCase();
      if(localCodes.has(code)) {
        conflicts.push({code:p.code,localName:`تکرار محلی: ${localCodes.get(code)}`,cloudName:p.name});
        continue;
      }
      localCodes.set(code,p.name);
      const found = byCode.get(code);
      if (found) {
        if (String(found.full_name || '').trim() === String(p.name || '').trim()) matched.push({localId:p.id,cloudId:found.id});
        else conflicts.push({code:p.code,localName:p.name,cloudName:found.full_name});
      }
    }
    lastPreview = {clinicId, data, conflicts, matched, at:Date.now()};
    const summary = [
      `بیماران قابل انتقال: ${data.patients.length}`,
      `زخم‌ها: ${data.wounds.length}`,
      `تصاویر: ${data.images.length}`,
      `ارزیابی‌ها: ${data.assessments.length}`,
      `برنامه‌های مراقبتی: ${data.carePlans.length}`,
      `نوبت‌ها: ${data.appointments.length}`,
      `بیماران بدون رضایت ثبت‌شده و خارج از انتقال: ${data.missingConsent}`,
      `سابقه‌های بدون ارتباط معتبر و خارج از انتقال: ${data.orphanWounds + data.orphanImages + data.orphanAssessments + data.orphanAppointments}`,
      `پرونده‌های همسان در فضای ابری: ${matched.length}`,
      `تعارض کد پرونده: ${conflicts.length}`
    ];
    const host = $('cloudSyncPreviewResult');
    if (host) {
      host.replaceChildren();
      const ul = document.createElement('ul');
      summary.forEach(line => { const li=document.createElement('li'); li.textContent=line; ul.append(li); });
      host.append(ul);
      if (conflicts.length) {
        const p=document.createElement('p');
        p.className='micro-note';
        p.textContent='تعارض‌ها باید پیش از انتقال دستی بررسی شوند؛ هیچ پرونده‌ای با نام متفاوت به‌صورت خودکار ادغام نمی‌شود.';
        host.append(p);
      }
    }
    setStatus(conflicts.length ? 'پیش‌نمایش آماده است؛ ابتدا تعارض‌های کد پرونده را رفع کنید.' : 'پیش‌نمایش آماده است. برای شروع انتقال، دکمه انتقال را بزنید.');
    return lastPreview;
  }
  function dataUrlToBlob(dataUrl) {
    const match = /^data:(image\/(?:jpeg|png|webp));base64,([a-z0-9+/=]+)$/i.exec(String(dataUrl || ''));
    if (!match) throw new Error('تصویر محلی قالب مجاز یا داده base64 معتبر ندارد.');
    const raw = atob(match[2]);
    const bytes = new Uint8Array(raw.length);
    for (let i=0;i<raw.length;i++) bytes[i]=raw.charCodeAt(i);
    return {blob:new Blob([bytes],{type:match[1]}),type:match[1]};
  }
  function fileExtension(type) { return type==='image/png'?'png':type==='image/webp'?'webp':'jpg'; }
  async function uploadImages(client, clinicId, data, map, patientMap, woundMap, existingImageIds = new Set()) {
    const metadataRows = [], uploaded = [], queued = [], uploadedIds = [];
    for (const image of data.images) {
      const patientId = patientMap.get(image.patientId), woundId = woundMap.get(image.woundId);
      if (!patientId || !woundId) continue;
      const imageId = cloudId('image', image.id, map, clinicId);
      if (existingImageIds.has(imageId)) continue; // Never replace an existing cloud image during migration.
      const packed = dataUrlToBlob(image.image);
      if (packed.blob.size > 12 * 1024 * 1024) throw new Error(`تصویر ${image.id} بیش از ۱۲ مگابایت است؛ ابتدا آن را کوچک کنید.`);
      const path = `${clinicId}/${patientId}/${woundId}/${imageId}.${fileExtension(packed.type)}`;
      const row = {
        id:imageId, clinic_id:clinicId, patient_id:patientId, wound_id:woundId,
        storage_path:path, captured_at:safeIso(image.created),
        width_px:Number(image.width)||null, height_px:Number(image.height)||null,
        calibration:image.calibration||null, traced_area_cm2:Number.isFinite(Number(image.areaCm2))?Number(image.areaCm2):null,
        measurement_method:String(image.measurementMethod||'manual-clinician-reviewed').slice(0,100),
        metadata:{
          view_type:image.viewType||null, view_label:image.viewLabel||null, note:image.note||'',
          stored_width:image.storedWidth||null, stored_height:image.storedHeight||null,
          points:Array.isArray(image.points)?image.points:[], length_cm:image.lengthCm??null,
          width_cm:image.widthCm??null, ai_status:image.aiStatus||'not-installed',
          review_status:image.reviewStatus||'manual-draft',
          boundary_closed:!!image.boundaryClosed, segmentation:image.segmentation||null
        }
      };
      const offlineStore=window.WoundAIOfflineImages;
      try {
        await client.uploadWoundImage(path, packed.blob, packed.type);
        metadataRows.push(row);
        uploaded.push(image.id);
        uploadedIds.push(image.id);
      } catch(error) {
        const transient = (typeof navigator!=='undefined' && navigator.onLine===false) ||
          error?.name==='TypeError' || error?.status===0 || error?.status>=500;
        if(!transient || !offlineStore) throw error;
        await offlineStore.queueUpload({clinicId,path,blob:packed.blob,contentType:packed.type,row});
        queued.push(image.id);
      }
    }
    for (let i=0;i<metadataRows.length;i+=40) await client.upsertRows('wound_images',metadataRows.slice(i,i+40));
    return {count:metadataRows.length,uploaded,queued,uploadedIds};
  }
  async function transfer() {
    if (busy) return;
    const client = currentClient(), clinicId = currentClinic();
    if (client.getAal() !== 'aal2') throw new Error('برای انتقال داده، MFA را تأیید کنید.');
    if (!lastPreview || lastPreview.clinicId !== clinicId || Date.now()-lastPreview.at > 5*60*1000) await preview();
    if (lastPreview.conflicts.length) throw new Error('به دلیل تعارض کد پرونده، انتقال متوقف شد.');
    setBusy(true);
    const data = lastPreview.data, map = readMap();
    const counts = {patients:0,wounds:0,images:0,imagesQueued:0,encounters:0,assessments:0,carePlans:0,appointments:0,conflicts:0};
    try {
      const [remotePatients,remoteWounds,remoteImages,remoteEncounters,remoteAssessments,remoteCarePlans,remoteAppointments] = await Promise.all([
        client.listRows('patients',clinicId), client.listRows('wounds',clinicId),
        client.listRows('wound_images',clinicId), client.listRows('encounters',clinicId),
        client.listRows('assessments',clinicId), client.listRows('care_plans',clinicId),
        client.listRows('appointments',clinicId)
      ]);
      const byCode = new Map(remotePatients.map(p => [String(p.record_code).trim().toLowerCase(),p]));
      const remotePatientById = new Map(remotePatients.map(p=>[p.id,p]));
      const remoteWoundIds=new Set(remoteWounds.map(x=>x.id));
      const remoteImageIds=new Set(remoteImages.map(x=>x.id));
      const remoteEncounterIds=new Set(remoteEncounters.map(x=>x.id));
      const remoteAssessmentIds=new Set(remoteAssessments.map(x=>x.id));
      const remoteCarePlanIds=new Set(remoteCarePlans.map(x=>x.id));
      const remoteAppointmentIds=new Set(remoteAppointments.map(x=>x.id));
      const patientMap = new Map(), woundMap = new Map(), assessmentMap = new Map(), encounterMap = new Map(), imageMap = new Map();
      for (const p of data.patients) {
        const found = byCode.get(String(p.code||'').trim().toLowerCase());
        const cloud = found && String(found.full_name||'').trim()===String(p.name||'').trim() ? found.id : cloudId('patient',p.id,map,clinicId);
        map[`${clinicId}:patient:${p.id}`]=cloud; patientMap.set(p.id,cloud);
      }
      for (const w of data.wounds) { const id=cloudId('wound',w.id,map,clinicId); woundMap.set(w.id,id); }
      for (const x of data.images) { const id=cloudId('image',x.id,map,clinicId); imageMap.set(x.id,id); }
      for (const a of data.assessments) { assessmentMap.set(a.id,cloudId('assessment',a.id,map,clinicId)); }
      for (const a of data.carePlans) { assessmentMap.set(a.id,cloudId('carePlan',a.id,map,clinicId)); }
      for (const a of data.assessments) {
        const localEncounter=a.data?.encounterId;
        if (localEncounter) encounterMap.set(localEncounter,cloudId('encounter',localEncounter,map,clinicId));
      }
      writeMap(map);

      const patientRows = data.patients.map(p=>({
        id:patientMap.get(p.id), clinic_id:clinicId, record_code:String(p.code||'').trim().slice(0,80),
        full_name:String(p.name||'').slice(0,200), date_of_birth:dateOnly(p.dob), sex:p.sex||null,
        diabetes:p.diabetes||null, vascular_disease:p.vascular||null, allergies:p.allergies||null,
        medications:p.medications||null, medical_history:p.history||null,
        phone:p.phone||null, emergency_contact:p.emergencyContact||null,
        consent_record:{consent:true,source:'local-record',migrated_at:new Date().toISOString()},
        status:p.status==='archived'?'archived':'active',
        updated_at:safeIso(p.updated||p.created)
      }));
      const newPatientRows=[];
      for(const row of patientRows){
        const remote=remotePatientById.get(row.id);
        if(!remote){newPatientRows.push(row);continue;}
        const local=data.patients.find(x=>patientMap.get(x.id)===remote.id);
        const localTime=Date.parse(local?.updated||local?.created||0)||0;
        const remoteTime=Date.parse(remote.updated_at||remote.created_at||0)||0;
        const patch={...row};
        delete patch.id;delete patch.clinic_id;delete patch.updated_at;
        const changed=Object.keys(patch).some(key=>JSON.stringify(patch[key]??null)!==JSON.stringify(remote[key]??null));
        if(!changed)continue;
        if(localTime>remoteTime){
          try{
            await client.updateRowsVersioned('patients',clinicId,remote.id,Number(remote.revision)||1,patch);
            counts.patients++;
          }catch(error){
            if(error?.code==='WOUNDAI_CONFLICT'){counts.conflicts++;continue;}
            throw error;
          }
        }else{
          counts.conflicts++;
        }
      }
      for (let i=0;i<newPatientRows.length;i+=40) {
        const batch=newPatientRows.slice(i,i+40);
        await client.upsertRows('patients',batch);
        counts.patients+=batch.length;
      }

      const woundRows = data.wounds.map(w=>({
        id:woundMap.get(w.id), clinic_id:clinicId, patient_id:patientMap.get(w.patientId),
        etiology:w.etiology||null, anatomical_site:String(w.site||'نامشخص').slice(0,250),
        body_region:w.bodyRegion||null, laterality:w.side||null, onset_date:dateOnly(w.onset),
        clinical_notes:w.notes||null, followup_notes:w.followup||null,
        status:w.status==='closed'?'healed':(['healed','archived'].includes(w.status)?w.status:'active')
      })).filter(w=>w.patient_id&&!remoteWoundIds.has(w.id));
      for (let i=0;i<woundRows.length;i+=40) { await client.upsertRows('wounds',woundRows.slice(i,i+40)); counts.wounds+=woundRows.slice(i,i+40).length; }

      const encounterRows = [];
      for (const a of data.assessments) {
        const localEncounter=a.data?.encounterId;
        const wound=data.wounds.find(w=>w.id===a.woundId);
        if (!localEncounter || !wound) continue;
        const eid=encounterMap.get(localEncounter);
        if (encounterRows.some(x=>x.id===eid)) continue;
        if(remoteEncounterIds.has(eid)) continue;
        encounterRows.push({
          id:eid, clinic_id:clinicId, patient_id:patientMap.get(wound.patientId),
          wound_id:woundMap.get(wound.id), occurred_at:safeIso(a.created),
          recorded_by:'clinician-entered', metadata:{local_encounter_id:localEncounter}
        });
      }
      for (let i=0;i<encounterRows.length;i+=40) { await client.upsertRows('encounters',encounterRows.slice(i,i+40)); counts.encounters+=encounterRows.slice(i,i+40).length; }

      const imageResult=await uploadImages(client,clinicId,data,map,patientMap,woundMap,remoteImageIds);
      counts.images=imageResult.count;
      counts.imagesQueued=imageResult.queued.length;
      const uploadedImageIds=new Set(imageResult.uploadedIds);
      if(window.WoundAIOfflineImages){
        const pending=await window.WoundAIOfflineImages.pendingCount();
        const queueStatus=$('cloudOfflineQueueStatus');
        if(queueStatus)queueStatus.textContent=`تصاویر در صف ارسال آفلاین: ${pending}`;
      }
      for (const x of data.images) if(imageMap.has(x.id)) imageMap.set(x.id,cloudId('image',x.id,map,clinicId));

      const assessmentRows = data.assessments.map(a=>{
        const wound=data.wounds.find(w=>w.id===a.woundId);
        const patientId=patientMap.get(a.patientId||wound?.patientId);
        if(!wound||!patientId)return null;
        const encounterId=a.data?.encounterId?encounterMap.get(a.data.encounterId):null;
        return {
          id:assessmentMap.get(a.id), clinic_id:clinicId, patient_id:patientId,
          wound_id:woundMap.get(a.woundId), image_id:a.imageId&&uploadedImageIds.has(a.imageId)?imageMap.get(a.imageId)||null:null,
          encounter_id:encounterId||null, assessment_type:String(a.kind||'assessment').slice(0,100),
          assessed_at:safeIso(a.created), data:a.data||{}
        };
      }).filter(row=>row&&!remoteAssessmentIds.has(row.id));
      for (let i=0;i<assessmentRows.length;i+=40) { await client.upsertRows('assessments',assessmentRows.slice(i,i+40)); counts.assessments+=assessmentRows.slice(i,i+40).length; }

      const careRows=data.carePlans.map(a=>({
        id:assessmentMap.get(a.id),clinic_id:clinicId,patient_id:patientMap.get(a.patientId),
        wound_id:woundMap.get(a.woundId),source_assessment_id:a.data?.sourceAssessmentId?assessmentMap.get(a.data.sourceAssessmentId)||null:null,
        status:a.data?.status==='approved'?'approved':'draft',plan:a.data||{},
        clinician_name:a.data?.clinician||null,clinician_credential:a.data?.credential||null,
        approved_at:a.data?.reviewedAt||null
      })).filter(x=>x.patient_id&&x.wound_id&&!remoteCarePlanIds.has(x.id));
      for (let i=0;i<careRows.length;i+=40) {
        const inserted=await client.insertRowsIgnoreDuplicates('care_plans',careRows.slice(i,i+40));
        counts.carePlans+=Array.isArray(inserted)?inserted.length:careRows.slice(i,i+40).length;
      }

      const appointmentRows=data.appointments.map(a=>({
        id:cloudId('appointment',a.id,map,clinicId),clinic_id:clinicId,patient_id:patientMap.get(a.patientId),
        wound_id:woundMap.get(a.woundId),due_at:dueIso(a.due),reminder_lead_days:Math.max(0,Math.min(365,Number(a.lead)||0)),
        notes:a.notes||null,status:['scheduled','completed','cancelled','rescheduled','missed'].includes(a.status)?a.status:'scheduled'
      })).filter(x=>x.patient_id&&x.wound_id&&x.due_at&&!remoteAppointmentIds.has(x.id));
      for (let i=0;i<appointmentRows.length;i+=40) { await client.upsertRows('appointments',appointmentRows.slice(i,i+40)); counts.appointments+=appointmentRows.slice(i,i+40).length; }

      writeMap(map);
      window.dispatchEvent(new CustomEvent('woundai:legacy-cloud-transfer-complete',{detail:{clinicId}}));
      setStatus(`انتقال مرحله‌ای تمام شد. بیمار ${counts.patients}، زخم ${counts.wounds}، تصویر ${counts.images}، تصویر در صف آفلاین ${counts.imagesQueued}، ارزیابی ${counts.assessments}، برنامه ${counts.carePlans} و نوبت ${counts.appointments}. تعارض نیازمند بررسی: ${counts.conflicts}. نسخه محلی حفظ شد.`);
      return counts;
    } finally { setBusy(false); }
  }
  function blobToDataUrl(blob) {
    return new Promise((resolve,reject)=>{
      const reader=new FileReader();
      reader.onload=()=>resolve(reader.result);
      reader.onerror=()=>reject(new Error('خواندن تصویر دریافتی ناموفق بود.'));
      reader.readAsDataURL(blob);
    });
  }
  async function downloadAndMerge() {
    if (busy) return;
    const client=currentClient(), clinicId=currentClinic();
    await client.ensureFreshSession();
    setBusy(true);
    const previous=JSON.stringify(state);
    try {
      const tables=await Promise.all(TABLES.map(t=>client.listRows(t,clinicId)));
      const [patients,wounds,images,assessments,carePlans,encounters,appointments]=tables;
      const map=readMap(), reversePatient=new Map(), reverseWound=new Map(), reverseImage=new Map(), reverseEncounter=new Map();
      for(const p of patients) reversePatient.set(p.id,localId('patient',p.id,map,clinicId));
      for(const w of wounds) reverseWound.set(w.id,localId('wound',w.id,map,clinicId));
      for(const x of images) reverseImage.set(x.id,localId('image',x.id,map,clinicId));
      for(const x of encounters) reverseEncounter.set(x.id,localId('encounter',x.id,map,clinicId));
      const seen=(key)=>new Set(state[key].map(x=>x.id));
      const patientSeen=seen('patients'), woundSeen=seen('wounds'), imageSeen=seen('images'), assessmentSeen=seen('assessments'), appointmentSeen=seen('appointments');
      let added={patients:0,wounds:0,images:0,assessments:0,carePlans:0,appointments:0}, skippedImages=0;
      for(const p of patients) {
        const id=reversePatient.get(p.id); if(patientSeen.has(id))continue;
        state.patients.push({id,name:p.full_name,code:p.record_code,dob:p.date_of_birth||'',sex:p.sex||'',diabetes:p.diabetes||'',vascular:p.vascular_disease||'',phone:p.phone||'',emergencyContact:p.emergency_contact||'',allergies:p.allergies||'',medications:p.medications||'',history:p.medical_history||'',photo:'',consent:p.consent_record?.consent===true,created:p.created_at,updated:p.updated_at,status:p.status||'active'});
        patientSeen.add(id);added.patients++;
      }
      for(const w of wounds) {
        const id=localId('wound',w.id,map,clinicId);if(woundSeen.has(id))continue;
        state.wounds.push({id,patientId:reversePatient.get(w.patient_id)||w.patient_id,etiology:w.etiology||'',site:w.anatomical_site||'',bodyRegion:w.body_region||'',side:w.laterality||'',onset:w.onset_date||'',notes:w.clinical_notes||'',followup:w.followup_notes||'',status:w.status==='healed'?'closed':w.status||'active',created:w.created_at});
        woundSeen.add(id);added.wounds++;
      }
      for(const x of images) {
        const id=reverseImage.get(x.id);if(imageSeen.has(id))continue;
        try {
          const blob=await client.downloadWoundImage(x.storage_path);
          const dataUrl=await blobToDataUrl(blob);
          const meta=x.metadata||{};
          state.images.push({id,patientId:reversePatient.get(x.patient_id)||x.patient_id,woundId:reverseWound.get(x.wound_id)||x.wound_id,created:x.captured_at,image:dataUrl,width:x.width_px,height:x.height_px,storedWidth:meta.stored_width||x.width_px,storedHeight:meta.stored_height||x.height_px,viewType:meta.view_type||'other',viewLabel:meta.view_label||'',note:meta.note||'',points:meta.points||[],calibration:x.calibration||null,areaCm2:x.traced_area_cm2,lengthCm:meta.length_cm,widthCm:meta.width_cm,aiStatus:meta.ai_status||'not-installed',reviewStatus:meta.review_status||'manual-draft',boundaryClosed:!!meta.boundary_closed,segmentation:meta.segmentation||null,measurementMethod:x.measurement_method});
          imageSeen.add(id);added.images++;
        } catch { skippedImages++; }
      }
      const encounterById=new Map(encounters.map(e=>[e.id,e]));
      for(const a of assessments) {
        const id=localId('assessment',a.id,map,clinicId);if(assessmentSeen.has(id))continue;
        state.assessments.push({id,patientId:reversePatient.get(a.patient_id)||a.patient_id,woundId:reverseWound.get(a.wound_id)||a.wound_id,imageId:a.image_id?(reverseImage.get(a.image_id)||a.image_id):null,encounterId:a.encounter_id?(reverseEncounter.get(a.encounter_id)||a.encounter_id):null,created:a.assessed_at,kind:a.assessment_type,data:a.data||{}});
        assessmentSeen.add(id);added.assessments++;
      }
      for(const plan of carePlans) {
        const id=localId('carePlan',plan.id,map,clinicId);if(assessmentSeen.has(id))continue;
        state.assessments.push({id,patientId:reversePatient.get(plan.patient_id)||plan.patient_id,woundId:reverseWound.get(plan.wound_id)||plan.wound_id,created:plan.created_at,kind:'care-plan-stage7',data:{...(plan.plan||{}),status:plan.status,clinician:plan.clinician_name||'',credential:plan.clinician_credential||'',reviewedAt:plan.approved_at||null}});
        assessmentSeen.add(id);added.carePlans++;
      }
      for(const a of appointments) {
        const id=localId('appointment',a.id,map,clinicId);if(appointmentSeen.has(id))continue;
        state.appointments.push({id,patientId:reversePatient.get(a.patient_id)||a.patient_id,woundId:reverseWound.get(a.wound_id)||a.wound_id,due:String(a.due_at||'').slice(0,10),lead:a.reminder_lead_days||0,notes:a.notes||'',status:a.status||'scheduled',created:a.created_at});
        appointmentSeen.add(id);added.appointments++;
      }
      if(!persist()) throw new Error('فضای ذخیره‌سازی محلی کافی نیست؛ هیچ داده ابری حذف نشده است.');
      if(typeof renderPatients==='function')renderPatients();
      if(typeof renderStats==='function')renderStats();
      if(typeof renderImageHistory==='function')renderImageHistory();
      setStatus(`دریافت و ادغام انجام شد. بیمار ${added.patients}، زخم ${added.wounds}، تصویر ${added.images}، ارزیابی ${added.assessments}، برنامه ${added.carePlans} و نوبت ${added.appointments}. تصویر ناموفق: ${skippedImages}. رکوردهای موجود ابری بازنویسی نشدند؛ داده محلی حفظ شد.`);
      return added;
    } catch(error) {
      try { const restored=JSON.parse(previous); Object.keys(state).forEach(k=>delete state[k]); Object.assign(state,restored); } catch {}
      throw error;
    } finally { setBusy(false); }
  }
  function renderReadiness() {
    const client=window.WoundAISupabase;
    const readReady=!!(client?.configured()&&client?.authenticated()&&$('cloudClinicSelect')?.value);
    const writeReady=readReady&&client.getAal?.()==='aal2';
    if($('cloudSyncPreview'))$('cloudSyncPreview').disabled=!readReady||busy;
    if($('cloudSyncDownload'))$('cloudSyncDownload').disabled=!readReady||busy;
    if($('cloudSyncUpload'))$('cloudSyncUpload').disabled=!writeReady||busy;
    const status=$('cloudSyncStatus');
    if(status&&readReady&&!writeReady)status.textContent='برای مشاهده و دریافت، نشست ورود کافی است؛ برای انتقال و نوشتن، MFA سطح AAL2 را تأیید کنید.';
  }
  $('cloudSyncPreview')?.addEventListener('click',async()=>{try{setBusy(true);await preview()}catch(e){setStatus(e.message,true)}finally{setBusy(false);renderReadiness()}});
  $('cloudSyncUpload')?.addEventListener('click',async()=>{try{await transfer()}catch(e){setStatus(`انتقال کامل نشد: ${e.message} برای ادامه، پیش‌نمایش را دوباره اجرا کنید؛ داده محلی حفظ شده است.`,true)}finally{renderReadiness()}});
  $('cloudSyncDownload')?.addEventListener('click',async()=>{try{await downloadAndMerge()}catch(e){setStatus(`دریافت اطلاعات کامل نشد: ${e.message}`,true)}finally{renderReadiness()}});
  $('cloudClinicSelect')?.addEventListener('change',()=>{lastPreview=null;renderReadiness()});
  $('cloudSignIn')?.addEventListener('click',()=>setTimeout(renderReadiness,1000));
  $('cloudVerifyMfa')?.addEventListener('click',()=>setTimeout(renderReadiness,1000));
  $('cloudSignOut')?.addEventListener('click',()=>setTimeout(renderReadiness,100));
  $('cloudRefreshClinics')?.addEventListener('click',()=>setTimeout(renderReadiness,800));
  $('cloudCreateClinic')?.addEventListener('click',()=>setTimeout(renderReadiness,800));
  window.WoundAICloudSync = { preview, transfer, downloadAndMerge, eligibleData, cloudId, localId, adoptCloudId, readMap };
  renderReadiness();
})();
