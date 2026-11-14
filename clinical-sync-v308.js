/* WoundAI v30.8 — local-first, bidirectional, record-level clinical synchronization.
 * Binary media is kept in private Supabase Storage; record envelopes contain metadata only.
 * Every remote write uses optimistic revision checks and preserves conflicts for explicit review.
 */
(function () {
  'use strict';
  const DB_NAME='woundai-clinical-sync-v308', DB_VERSION=1;
  const STORES=['shadow','outbox','conflicts','meta'];
  const COLLECTIONS=[
    {type:'patient',key:'patients'},
    {type:'wound',key:'wounds'},
    {type:'image',key:'images'},
    {type:'assessment',key:'assessments'},
    {type:'appointment',key:'appointments'}
  ];
  let dbPromise=null, busy=false, timer=null, activeClinic=null, enabled=false;
  const $=id=>document.getElementById(id);
  const makeKey=(clinic,type,id)=>`${clinic}|${type}|${id}`;
  const now=()=>new Date().toISOString();

  function openDB(){
    if(!('indexedDB' in window))return Promise.reject(new Error('IndexedDB برای صف همگام‌سازی در این مرورگر فعال نیست.'));
    if(dbPromise)return dbPromise;
    dbPromise=new Promise((resolve,reject)=>{
      const req=indexedDB.open(DB_NAME,DB_VERSION);
      req.onupgradeneeded=()=>{
        const db=req.result;
        for(const name of STORES)if(!db.objectStoreNames.contains(name))db.createObjectStore(name,{keyPath:'key'});
      };
      req.onsuccess=()=>resolve(req.result);
      req.onerror=()=>reject(req.error||new Error('فضای پایدار همگام‌سازی باز نشد.'));
      req.onblocked=()=>reject(new Error('به‌روزرسانی فضای همگام‌سازی مسدود شده است؛ زبانه‌های دیگر WoundAI را ببندید.'));
    });
    return dbPromise;
  }
  async function storeOp(name,mode,fn){
    const db=await openDB();
    return new Promise((resolve,reject)=>{
      const tx=db.transaction(name,mode),store=tx.objectStore(name);
      let req;
      try{req=fn(store)}catch(e){reject(e);return}
      tx.oncomplete=()=>resolve(req?.result);
      tx.onerror=()=>reject(tx.error||new Error('عملیات IndexedDB ناموفق بود.'));
      tx.onabort=()=>reject(tx.error||new Error('تراکنش IndexedDB لغو شد.'));
    });
  }
  const get=(s,k)=>storeOp(s,'readonly',x=>x.get(k));
  const all=s=>storeOp(s,'readonly',x=>x.getAll());
  const put=(s,v)=>storeOp(s,'readwrite',x=>x.put(v));
  const del=(s,k)=>storeOp(s,'readwrite',x=>x.delete(k));

  function canonical(value){
    if(Array.isArray(value))return `[${value.map(canonical).join(',')}]`;
    if(typeof value==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(value)){
      const parsed=Date.parse(`${value}T00:00:00.000Z`);if(Number.isFinite(parsed))return JSON.stringify(new Date(parsed).toISOString());
    }
    if(typeof value==='string'&&/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(value)){
      const parsed=Date.parse(value);if(Number.isFinite(parsed))return JSON.stringify(new Date(parsed).toISOString());
    }
    if(value&&typeof value==='object'){
      return `{${Object.keys(value).filter(k=>value[k]!==undefined).sort().map(k=>`${JSON.stringify(k)}:${canonical(value[k])}`).join(',')}}`;
    }
    return JSON.stringify(value);
  }
  async function digestBytes(bytes){
    const hash=await crypto.subtle.digest('SHA-256',bytes);
    return [...new Uint8Array(hash)].map(x=>x.toString(16).padStart(2,'0')).join('');
  }
  async function digest(value){
    const bytes=new TextEncoder().encode(canonical(value));
    const hash=await crypto.subtle.digest('SHA-256',bytes);
    return [...new Uint8Array(hash)].map(x=>x.toString(16).padStart(2,'0')).join('');
  }
  function clone(value){return JSON.parse(JSON.stringify(value));}
  function isDataUrl(value){return typeof value==='string'&&/^data:image\/(png|jpeg|jpg|webp);base64,/i.test(value);}
  function dataUrlToBlob(value){
    const match=String(value||'').match(/^data:(image\/(?:png|jpeg|jpg|webp));base64,([A-Za-z0-9+/=]+)$/i);
    if(!match)throw new Error('داده تصویر محلی معتبر نیست.');
    const raw=atob(match[2]),bytes=new Uint8Array(raw.length);
    for(let i=0;i<raw.length;i++)bytes[i]=raw.charCodeAt(i);
    const blob=new Blob([bytes],{type:match[1].toLowerCase().replace('image/jpg','image/jpeg')});
    if(blob.size>12*1024*1024)throw new Error('حجم فایل رسانه‌ای بیش از ۱۲ مگابایت است.');
    return blob;
  }
  function blobToDataUrl(blob){
    return new Promise((resolve,reject)=>{
      const reader=new FileReader();
      reader.onload=()=>resolve(reader.result);
      reader.onerror=()=>reject(new Error('بازخوانی تصویر دریافتی ناموفق بود.'));
      reader.readAsDataURL(blob);
    });
  }
  function extFor(type){return type==='image/png'?'png':type==='image/webp'?'webp':'jpg';}
  function client(){const c=window.WoundAISupabase;if(!c?.configured?.()||!c?.authenticated?.())throw new Error('ابتدا به حساب ابری WoundAI وارد شوید.');return c;}
  function canSync(){try{const c=client();return c.authenticated()&&c.getAal()==='aal2';}catch{return false;}}
  function app(){if(!window.WoundAIApp?.getState)throw new Error('اتصال برنامه بالینی به موتور همگام‌سازی برقرار نیست.');return window.WoundAIApp;}
  const kindFor={patient:'patient',wound:'wound',image:'image',assessment:'assessment',appointment:'appointment'};
  function serverId(type,localId,clinic){return window.WoundAICloudSync.cloudId(kindFor[type],String(localId),null,clinic);}
  function localId(type,remoteId,clinic){
    const api=window.WoundAICloudSync;
    return api?.localId?api.localId(kindFor[type],String(remoteId),api.readMap(),clinic):String(remoteId);
  }
  function cloudizePayload(type,payload,clinic,remoteId){
    const copy=clone(payload);copy.id=remoteId||serverId(type,copy.id,clinic);
    const ref=(kind,value)=>value?window.WoundAICloudSync.cloudId(kind,String(value),null,clinic):value;
    if(type==='wound'&&copy.patientId)copy.patientId=ref('patient',copy.patientId);
    if(type==='wound'&&!copy.bodyRegion)delete copy.bodyRegion;
    if(type==='wound'&&copy.status==='closed')copy.status='healed';
    if(type==='image'){if(copy.patientId)copy.patientId=ref('patient',copy.patientId);if(copy.woundId)copy.woundId=ref('wound',copy.woundId);}
    if(type==='assessment'){
      if(copy.patientId)copy.patientId=ref('patient',copy.patientId);
      if(copy.woundId)copy.woundId=ref('wound',copy.woundId);
      if(copy.imageId)copy.imageId=ref('image',copy.imageId);else delete copy.imageId;
      if(copy.data?.encounterId)copy.data.encounterId=ref('encounter',copy.data.encounterId);
      if(copy.data?.sourceAssessmentId)copy.data.sourceAssessmentId=ref('assessment',copy.data.sourceAssessmentId);
    }
    if(type==='appointment'){if(copy.patientId)copy.patientId=ref('patient',copy.patientId);if(copy.woundId)copy.woundId=ref('wound',copy.woundId);}
    return copy;
  }
  function localizePayload(type,payload,remoteId,clinic){
    const copy=clone(payload||{});copy.id=localId(type,remoteId,clinic);
    const ref=(kind,value)=>value?window.WoundAICloudSync.localId(kind,String(value),window.WoundAICloudSync.readMap(),clinic):value;
    if(type==='wound'&&copy.patientId)copy.patientId=ref('patient',copy.patientId);
    if(type==='wound'&&!copy.bodyRegion)delete copy.bodyRegion;
    if(type==='wound'&&copy.status==='closed')copy.status='healed';
    if(type==='image'){if(copy.patientId)copy.patientId=ref('patient',copy.patientId);if(copy.woundId)copy.woundId=ref('wound',copy.woundId);}
    if(type==='assessment'){
      if(copy.patientId)copy.patientId=ref('patient',copy.patientId);
      if(copy.woundId)copy.woundId=ref('wound',copy.woundId);
      if(copy.imageId)copy.imageId=ref('image',copy.imageId);else delete copy.imageId;
      if(copy.data?.encounterId)copy.data.encounterId=ref('encounter',copy.data.encounterId);
      if(copy.data?.sourceAssessmentId)copy.data.sourceAssessmentId=ref('assessment',copy.data.sourceAssessmentId);
    }
    if(type==='appointment'){if(copy.patientId)copy.patientId=ref('patient',copy.patientId);if(copy.woundId)copy.woundId=ref('wound',copy.woundId);}
    return copy;
  }
  function localCollections(state){return COLLECTIONS.map(c=>({ ...c, rows:Array.isArray(state[c.key])?state[c.key]:[] }));}
  function sameTime(a,b){
    const x=Date.parse(a||''),y=Date.parse(b||'');
    return Number.isFinite(x)&&Number.isFinite(y)&&Math.abs(x-y)<1000;
  }
  function dedupeKey(type,record){
    if(type==='patient')return String(record.code||'').trim().toLocaleLowerCase('en-US');
    return String(record.id||'');
  }
  async function buildEnvelope(type,record){
    const copy=clone(record);
    if(!copy.patientId&&copy.woundId){
      const related=app().getState().wounds.find(w=>String(w.id)===String(copy.woundId));
      if(related?.patientId)copy.patientId=related.patientId;
    }
    let mediaBlob=null,mediaKind=null;
    if(type==='patient'&&isDataUrl(copy.photo)){
      mediaBlob=dataUrlToBlob(copy.photo);mediaKind='patient-photo';
      if(!copy.photo_storage_path||copy.photo_sha256)copy.photo_sha256=await digestBytes(await mediaBlob.arrayBuffer());
      delete copy.photo;
    }
    if(type==='image'&&isDataUrl(copy.image)){
      mediaBlob=dataUrlToBlob(copy.image);mediaKind='wound-image';
      if(!copy.storage_path||copy.media_sha256)copy.media_sha256=await digestBytes(await mediaBlob.arrayBuffer());
      delete copy.image;
      if(isDataUrl(copy.thumbnail))delete copy.thumbnail;
    }
    return {payload:copy,mediaBlob,mediaKind};
  }
  async function uploadOutboxMedia(item,c){
    if(!item.mediaBlob)return item;
    if(!window.WoundAICloudSync?.cloudId)throw new Error('نگاشت شناسه‌های ابری آماده نیست.');
    let path;
    if(item.type==='patient'){
      const patientCloud=window.WoundAICloudSync.cloudId('patient',item.localId,null,item.clinicId);
      const mediaCloud=window.WoundAICloudSync.cloudId('patientPhoto',item.localId,null,item.clinicId);
      path=item.payload.photo_storage_path||`${item.clinicId}/${patientCloud}/${patientCloud}/${mediaCloud}.${extFor(item.mediaBlob.type)}`;
      item.payload.photo_storage_path=path;
      await put('outbox',item);
      await c.uploadWoundImage(path,item.mediaBlob,item.mediaBlob.type);
    }else if(item.type==='image'){
      const state=app().getState();
      const image=state.images.find(x=>String(x.id)===item.localId);
      const patient=state.patients.find(x=>x.id===image?.patientId);
      const wound=state.wounds.find(x=>x.id===image?.woundId);
      if(!patient||!wound)throw new Error('ارتباط بیمار و زخم برای تصویر پیدا نشد.');
      const patientCloud=window.WoundAICloudSync.cloudId('patient',patient.id,null,item.clinicId);
      const woundCloud=window.WoundAICloudSync.cloudId('wound',wound.id,null,item.clinicId);
      const imageCloud=window.WoundAICloudSync.cloudId('image',item.localId,null,item.clinicId);
      path=item.payload.storage_path||`${item.clinicId}/${patientCloud}/${woundCloud}/${imageCloud}.${extFor(item.mediaBlob.type)}`;
      item.payload.storage_path=path;
      await put('outbox',item);
      await c.uploadWoundImage(path,item.mediaBlob,item.mediaBlob.type);
    }
    // Preserve the local data URL; only attach the Storage locator to the local record.
    const current=clone(app().getState());
    const collection=COLLECTIONS.find(x=>x.type===item.type)?.key;
    const record=current[collection]?.find(x=>String(x.id)===item.localId);
    if(record){
      if(item.type==='patient'){record.photo_storage_path=path;if(item.payload.photo_sha256)record.photo_sha256=item.payload.photo_sha256;}
      if(item.type==='image'){record.storage_path=path;if(item.payload.media_sha256)record.media_sha256=item.payload.media_sha256;}
      app().applyRemoteState(current);
    }
    item.mediaBlob=null;
    return item;
  }
  async function hydrateMedia(type,payload,c){
    const copy=clone(payload);
    const path=type==='patient'?copy.photo_storage_path:(type==='image'?copy.storage_path:null);
    const field=type==='patient'?'photo':'image';
    if(path&&!copy[field]){
      const blob=await c.downloadWoundImage(path);
      const expected=type==='patient'?copy.photo_sha256:copy.media_sha256;
      if(expected&&await digestBytes(await blob.arrayBuffer())!==expected)throw new Error('SHA-256 تصویر دریافتی با metadata پرونده مطابقت ندارد.');
      copy[field]=await blobToDataUrl(blob);
      if(type==='image'&&!copy.thumbnail)copy.thumbnail=copy[field];
    }
    return copy;
  }
  async function getShadow(clinic,type,id){return get('shadow',makeKey(clinic,type,id));}
  async function saveShadow(clinic,type,id,row){
    const remoteId=row.local_id||serverId(type,id,clinic);
    if(window.WoundAICloudSync?.adoptCloudId)window.WoundAICloudSync.adoptCloudId(kindFor[type],id,remoteId,clinic);
    const localized=row.payload?localizePayload(type,row.payload,remoteId,clinic):null;
    return put('shadow',{key:makeKey(clinic,type,id),clinicId:clinic,type,localId:id,
      serverId:row.local_id||serverId(type,id,clinic),
      revision:Number(row.revision)||1,hash:row.deleted_at?'__deleted__':await digest(localized||{}),
      payload:localized,deleted:!!row.deleted_at,updatedAt:row.updated_at||now()});
  }
  async function queueChange(clinic,type,id,record,expectedRevision,deleted=false){
    const key=makeKey(clinic,type,id),old=await get('outbox',key);
    let payload=null,dedupe=id,mediaBlob=null,mediaKind=null,hash='__deleted__';
    const shadow=await get('shadow',key);
    const previousPayload=deleted?(old?.payload||shadow?.payload||null):null;
    if(!deleted){
      const envelope=await buildEnvelope(type,record);
      payload=envelope.payload;mediaBlob=envelope.mediaBlob;mediaKind=envelope.mediaKind;
      dedupe=dedupeKey(type,payload);
      if(!dedupe)throw new Error(type==='patient'?'کد پرونده برای همگام‌سازی خالی است.':'شناسه رکورد برای همگام‌سازی خالی است.');
      hash=await digest(payload);
    }
    await put('outbox',{key,clinicId:clinic,type,localId:id,serverId:serverId(type,id,clinic),dedupeKey:dedupe,
      expectedRevision:old?old.expectedRevision:expectedRevision,payload,previousPayload,mediaBlob,mediaKind,hash,deleted,queuedAt:now()});
  }
  async function capture(state){
    if(!enabled||!activeClinic)return {queued:0};
    const clinic=activeClinic,shadowRows=(await all('shadow')).filter(x=>x.clinicId===clinic);
    const shadowMap=new Map(shadowRows.map(x=>[makeKey(clinic,x.type,x.localId),x]));
    const current=new Map(), eligiblePatients=new Set((state.patients||[]).filter(p=>p?.consent===true).map(p=>String(p.id)));
    const eligibleWounds=new Set((state.wounds||[]).filter(w=>eligiblePatients.has(String(w.patientId))).map(w=>String(w.id)));
    for(const collection of localCollections(state)){
      for(const record of collection.rows){
        if(!record||record.id===undefined||record.id===null)continue;
        if(collection.type==='patient'&&record.consent!==true)continue;
        const relatedPatientId=record.patientId||state.wounds?.find(w=>String(w.id)===String(record.woundId))?.patientId;
        if(['wound','image','assessment','appointment'].includes(collection.type)&&!eligiblePatients.has(String(relatedPatientId)))continue;
        if(['image','assessment','appointment'].includes(collection.type)&&!eligibleWounds.has(String(record.woundId)))continue;
        const id=String(record.id),key=makeKey(clinic,collection.type,id);
        current.set(key,{type:collection.type,id,record});
      }
    }
    let queued=0;
    for(const [key,item] of current){
      const normalized=await buildEnvelope(item.type,item.record),hash=await digest(normalized.payload);
      const shadow=shadowMap.get(key),outbox=await get('outbox',key);
      const conflict=await get('conflicts',key);
      if(conflict){
        const duplicateWasEdited=conflict.reason==='duplicate_key'&&
          String(item.record.code||'').trim().toLowerCase()!==String(conflict.localPayload?.code||'').trim().toLowerCase();
        if(duplicateWasEdited)await del('conflicts',key);
        else continue;
      }
      if((!shadow||shadow.hash!==hash)&&(!outbox||outbox.hash!==hash)){
        await queueChange(clinic,item.type,item.id,item.record,shadow?.revision||0,false);queued++;
      }
    }
    const pendingRows=(await all('outbox')).filter(x=>x.clinicId===clinic);
    for(const pending of pendingRows){
      if(current.has(pending.key)||pending.deleted)continue;
      await queueChange(clinic,pending.type,pending.localId,null,pending.expectedRevision,true);queued++;
    }
    for(const [key,shadow] of shadowMap){
      if(shadow.deleted||current.has(key))continue;
      const pending=await get('outbox',key);
      if(pending?.deleted)continue;
      await queueChange(clinic,shadow.type,shadow.localId,null,pending?.expectedRevision??shadow.revision,true);queued++;
    }
    return {queued};
  }
  async function mergeRemote(remoteRows){
    const state=clone(app().getState()),collections=new Map(localCollections(state).map(x=>[x.type,x]));
    const remoteKeys=new Set(),conflicted=new Set();
    const localPatients=collections.get('patient')?.rows||[],allowedPatientServerIds=new Set();
    for(const row of remoteRows.filter(x=>x.entity_type==='patient'&&!x.deleted_at)){
      const remotePatientId=String(row.local_id),mapped=localId('patient',remotePatientId,activeClinic);
      let local=localPatients.find(x=>String(x.id)===mapped);
      if(!local){
        const code=String(row.payload?.code||'').trim().toLowerCase();
        const matches=localPatients.filter(x=>String(x.code||'').trim().toLowerCase()===code);
        if(code&&matches.length===1){
          local=matches[0];
          window.WoundAICloudSync.adoptCloudId('patient',String(local.id),remotePatientId,activeClinic);
        }
      }
      if(row.payload?.consent===true||local?.consent===true)allowedPatientServerIds.add(remotePatientId);
    }
    const localWounds=collections.get('wound')?.rows||[];
    for(const row of remoteRows.filter(x=>x.entity_type==='wound'&&!x.deleted_at)){
      const remoteId=String(row.local_id),mapped=localId('wound',remoteId,activeClinic);
      if(localWounds.some(x=>String(x.id)===mapped))continue;
      const payload=localizePayload('wound',row.payload,remoteId,activeClinic);
      const matches=localWounds.filter(x=>String(x.patientId)===String(payload.patientId)&&
        String(x.site||'')===String(payload.site||'')&&String(x.onset||'')===String(payload.onset||'')&&
        sameTime(x.created,payload.created));
      if(matches.length===1)window.WoundAICloudSync.adoptCloudId('wound',String(matches[0].id),remoteId,activeClinic);
    }
    for(const row of remoteRows){
      const type=row.entity_type,remoteId=String(row.local_id);let id=localId(type,remoteId,activeClinic),key=makeKey(activeClinic,type,id);
      const localizedRow={...row,local_id:remoteId,payload:row.payload?localizePayload(type,row.payload,remoteId,activeClinic):null};
      const shadowBefore=await get('shadow',key);
      if(!row.deleted_at&&type==='patient'&&!allowedPatientServerIds.has(remoteId)&&!shadowBefore)continue;
      if(!row.deleted_at&&type!=='patient'){
        const patientServer=String(row.payload?.patientId||'');
        if(!patientServer||(!allowedPatientServerIds.has(patientServer)&&!shadowBefore))continue;
      }
      if(row.deleted_at&&!shadowBefore)continue;
      remoteKeys.add(key);
      const collection=collections.get(type);if(!collection)continue;
      let localIndex=collection.rows.findIndex(x=>String(x.id)===id);
      if(localIndex<0&&!row.deleted_at){
        const p=localizedRow.payload||{};
        let matches=[];
        if(type==='patient'&&p.code){
          const code=String(p.code).trim().toLowerCase();
          matches=collection.rows.filter(x=>String(x.code||'').trim().toLowerCase()===code);
        }else if(type==='assessment'){
          matches=collection.rows.filter(x=>x.kind===p.kind&&String(x.patientId||'')===String(p.patientId||'')&&
            String(x.woundId||'')===String(p.woundId||'')&&sameTime(x.created,p.created));
        }else if(type==='image'){
          matches=collection.rows.filter(x=>String(x.patientId)===String(p.patientId)&&String(x.woundId)===String(p.woundId)&&
            sameTime(x.created,p.created)&&String(x.viewType||'')===String(p.viewType||''));
        }else if(type==='appointment'){
          matches=collection.rows.filter(x=>String(x.patientId)===String(p.patientId)&&String(x.woundId)===String(p.woundId)&&
            sameTime(x.due,p.due));
        }
        if(matches.length===1){
          localIndex=collection.rows.indexOf(matches[0]);
          window.WoundAICloudSync.adoptCloudId(kindFor[type],String(matches[0].id),remoteId,activeClinic);
          id=String(matches[0].id);key=makeKey(activeClinic,type,id);
          localizedRow.payload.id=id;
        }
      }
      remoteKeys.add(key);
      const local=localIndex>=0?collection.rows[localIndex]:null;
      if(local&&type==='image'&&localizedRow.payload?.storage_path&&!local.storage_path)local.storage_path=localizedRow.payload.storage_path;
      if(local&&type==='image'&&localizedRow.payload?.media_sha256&&!local.media_sha256)local.media_sha256=localizedRow.payload.media_sha256;
      if(local&&type==='patient'&&localizedRow.payload?.photo_storage_path&&!local.photo_storage_path)local.photo_storage_path=localizedRow.payload.photo_storage_path;
      if(local&&type==='patient'&&localizedRow.payload?.photo_sha256&&!local.photo_sha256)local.photo_sha256=localizedRow.payload.photo_sha256;
      if(local&&type==='wound'&&localizedRow.payload?.bodyRegion&&!local.bodyRegion)local.bodyRegion=localizedRow.payload.bodyRegion;
      const shadow=await get('shadow',key);
      const remoteDeleted=!!row.deleted_at;
      const remoteHash=remoteDeleted?'__deleted__':await digest(localizedRow.payload||{});
      if(!shadow){
        if(!local){
          if(!remoteDeleted){
            const hydrated=await hydrateMedia(type,localizedRow.payload,client());
            collection.rows.push(hydrated);
          }
          await saveShadow(activeClinic,type,id,localizedRow);
        }else{
          const localPayload=(await buildEnvelope(type,local)).payload;
          const localHash=await digest(localPayload);
          if(localHash===remoteHash)await saveShadow(activeClinic,type,id,localizedRow);
          else{
            await saveConflict(type,id,localPayload,localizedRow,'same_id_new_record');
            conflicted.add(key);
          }
        }
        continue;
      }
      const localPayload=local?(await buildEnvelope(type,local)).payload:null;
      const localHash=local?await digest(localPayload):'__deleted__';
      const localChanged=localHash!==shadow.hash;
      const remoteChanged=Number(row.revision)!==Number(shadow.revision)||remoteHash!==shadow.hash;
      if(!localChanged&&remoteChanged){
        if(remoteDeleted){if(localIndex>=0)collection.rows.splice(localIndex,1);}
        else{
          const hydrated=await hydrateMedia(type,localizedRow.payload,client());
          if(localIndex>=0)collection.rows[localIndex]=hydrated;else collection.rows.push(hydrated);
        }
        await saveShadow(activeClinic,type,id,localizedRow);
      }else if(localChanged&&!remoteChanged){
        // The local version is queued after this merge pass.
      }else if(localChanged&&remoteChanged){
        if(localHash===remoteHash)await saveShadow(activeClinic,type,id,localizedRow);
        else{
          await saveConflict(type,id,localPayload,localizedRow,'both_changed');
          conflicted.add(key);
        }
      }else{
        await saveShadow(activeClinic,type,id,localizedRow);
      }
    }
    // Shadow rows missing from the server indicate a data-integrity problem, not a delete.
    const shadows=(await all('shadow')).filter(x=>x.clinicId===activeClinic&&!x.deleted);
    for(const shadow of shadows){
      const key=makeKey(activeClinic,shadow.type,shadow.localId);
      if(!remoteKeys.has(key)){
        await saveConflict(shadow.type,shadow.localId,null,null,'remote_record_missing');
        conflicted.add(key);
      }
    }
    app().applyRemoteState(state);
    return {conflicts:conflicted.size};
  }
  async function saveConflict(type,id,localPayload,remoteRow,reason){
    const key=makeKey(activeClinic,type,id);
    await put('conflicts',{key,clinicId:activeClinic,type,localId:id,
      localPayload,remoteRow,reason,createdAt:now()});
    await del('outbox',key);
  }
  async function pushOutbox(){
    const dependencyOrder={patient:0,wound:1,image:2,assessment:3,appointment:4};
    const pending=(await all('outbox')).filter(x=>x.clinicId===activeClinic)
      .sort((a,b)=>(dependencyOrder[a.type]??99)-(dependencyOrder[b.type]??99));
    let applied=0,conflicts=0;
    for(let offset=0;offset<pending.length;offset+=100){
      const prepared=[];
      for(const item of pending.slice(offset,offset+100)){
        const ready=await uploadOutboxMedia({...item},client());
        if(ready.deleted&&ready.previousPayload){
          const path=ready.type==='patient'?ready.previousPayload.photo_storage_path:
            (ready.type==='image'?ready.previousPayload.storage_path:null);
          if(path)await client().deleteWoundImage(path);
        }
        if(ready.hash!== '__deleted__')ready.hash=await digest(ready.payload);
        await put('outbox',ready);
        prepared.push(ready);
      }
      const batch=prepared.map(x=>({
        entity_type:x.type,local_id:x.serverId,dedupe_key:x.dedupeKey,
        expected_revision:x.expectedRevision,payload:x.deleted?null:cloudizePayload(x.type,x.payload,activeClinic,x.serverId),previous_payload:x.previousPayload||null,deleted:x.deleted
      }));
      const result=await client().syncClinicalRecords(activeClinic,batch);
      for(const row of result.applied||[]){
        const local=localId(row.entity_type,row.local_id,activeClinic);
        const key=makeKey(activeClinic,row.entity_type,local);
        await saveShadow(activeClinic,row.entity_type,local,row);
        await del('outbox',key);applied++;
      }
      for(const conflict of result.conflicts||[]){
        const local=localId(conflict.entity_type,conflict.local_id,activeClinic);
        const key=makeKey(activeClinic,conflict.entity_type,local);
        const pendingRow=await get('outbox',key);
        const current=conflict.current?{...conflict.current,payload:conflict.current.payload?localizePayload(conflict.entity_type,conflict.current.payload,conflict.current.local_id,activeClinic):null}:null;
        const currentHash=current?(current.deleted_at?'__deleted__':await digest(current.payload||{})):null;
        const pendingHash=pendingRow?.deleted?'__deleted__':(pendingRow?await digest(pendingRow.payload||{}):null);
        if(current&&currentHash===pendingHash){
          await saveShadow(activeClinic,conflict.entity_type,local,current);
          await del('outbox',key);applied++;
          continue;
        }
        await saveConflict(conflict.entity_type,local,pendingRow?.payload||null,current,conflict.reason||'server_conflict');
        conflicts++;
      }
    }
    return {applied,conflicts};
  }
  async function renderStatus(message,isError=false){
    const node=$('clinicalSyncStatus');
    if(node){node.textContent=message;node.dataset.state=isError?'error':'ok';}
    const count=(await all('outbox')).filter(x=>x.clinicId===activeClinic).length;
    const out=$('clinicalSyncQueueCount');if(out)out.textContent=String(count);
    await renderConflicts();
  }
  async function renderConflicts(){
    const host=$('clinicalSyncConflicts');if(!host)return;
    host.replaceChildren();
    const items=(await all('conflicts')).filter(x=>x.clinicId===activeClinic);
    if(!items.length){host.textContent='تعارض حل‌نشده‌ای وجود ندارد.';return;}
    for(const item of items){
      const card=document.createElement('article');card.className='sync-conflict-item';
      const title=document.createElement('b');title.textContent=`${item.type} · ${item.localId}`;
      const reason=document.createElement('p');reason.textContent=`علت: ${item.reason}`;
      const local=document.createElement('pre');local.textContent=item.localPayload?JSON.stringify(item.localPayload,null,2).slice(0,1200):'نسخه محلی موجود نیست.';
      const remote=document.createElement('pre');remote.textContent=item.remoteRow?.payload?JSON.stringify(item.remoteRow.payload,null,2).slice(0,1200):(item.remoteRow?.deleted_at?'نسخه ابری حذف شده است.':'نسخه ابری موجود نیست.');
      const actions=document.createElement('div');actions.className='sync-conflict-actions';
      const keep=document.createElement('button');keep.type='button';keep.className='secondary-btn';keep.textContent='حفظ نسخه محلی';
      keep.disabled=['duplicate_key'].includes(item.reason);keep.addEventListener('click',()=>resolveConflict(item.key,'local'));
      const use=document.createElement('button');use.type='button';use.className='secondary-btn';use.textContent='استفاده از نسخه ابری';
      use.disabled=!item.remoteRow||localId(item.type,item.remoteRow.local_id,activeClinic)!==item.localId;use.addEventListener('click',()=>resolveConflict(item.key,'remote'));
      actions.append(keep,use);card.append(title,reason,document.createTextNode('نسخه محلی'),local,document.createTextNode('نسخه ابری'),remote,actions);host.append(card);
    }
  }
  async function resolveConflict(key,choice){
    const item=await get('conflicts',key);if(!item)return;
    const shadowRow=item.remoteRow;
    if(choice==='remote'){
      if(!shadowRow)throw new Error('نسخه ابری برای جایگزینی موجود نیست.');
      const state=clone(app().getState()),collection=state[COLLECTIONS.find(x=>x.type===item.type).key];
      const idx=collection.findIndex(x=>String(x.id)===item.localId);
      if(shadowRow.deleted_at){if(idx>=0)collection.splice(idx,1);}
      else{
        const payload=await hydrateMedia(item.type,localizePayload(item.type,shadowRow.payload,shadowRow.local_id,activeClinic),client());
        if(idx>=0)collection[idx]=payload;else collection.push(payload);
      }
      app().applyRemoteState(state);
      if(shadowRow)await saveShadow(activeClinic,item.type,item.localId,shadowRow);
      await del('outbox',key);await del('conflicts',key);
    }else{
      const local=app().getState()[COLLECTIONS.find(x=>x.type===item.type).key].find(x=>String(x.id)===item.localId);
      const localDelete=item.localPayload===null;
      if(!local&&!localDelete)throw new Error('نسخه محلی وجود ندارد؛ برای حذف، نسخه ابری را انتخاب کنید.');
      if(shadowRow)await saveShadow(activeClinic,item.type,item.localId,shadowRow);
      const revokeConsent=item.type==='patient'&&local?.consent!==true;
      const deleteLocal=localDelete||revokeConsent;
      await queueChange(activeClinic,item.type,item.localId,deleteLocal?null:local,Number(shadowRow?.revision)||0,deleteLocal);
      await del('conflicts',key);
      await syncNow();
    }
    await renderStatus('تعارض بررسی شد.');
  }
  async function syncNow(){
    if(busy)return {skipped:true};
    if(!enabled||!activeClinic)throw new Error('همگام‌سازی خودکار برای این مرکز فعال نشده است.');
    if(!navigator.onLine)throw new Error('اتصال اینترنت برقرار نیست؛ تغییرات محلی محفوظ هستند.');
    const c=client();await c.ensureFreshSession();
    if(c.getAal()!=='aal2')throw new Error('برای همگام‌سازی دوطرفه، تأیید MFA سطح AAL2 لازم است.');
    busy=true;setButtons(true);
    try{
      const remote=await c.listClinicalSyncRecords(activeClinic);
      const merge=await mergeRemote(remote);
      await capture(app().getState());
      const push=await pushOutbox();
      const remaining=(await all('outbox')).filter(x=>x.clinicId===activeClinic).length;
      await renderStatus(`همگام‌سازی انجام شد · دریافت ${remote.length} رکورد · ارسال ${push.applied} تغییر · صف باقی‌مانده ${remaining} · تعارض ${merge.conflicts+push.conflicts}`);
      return {downloaded:remote.length,...push,remaining,conflicts:merge.conflicts+push.conflicts};
    }catch(error){await renderStatus(`همگام‌سازی ناموفق: ${error.message}`,true);throw error;}
    finally{busy=false;setButtons(false);}
  }
  function setButtons(disabled){
    const sync=$('clinicalSyncNow');if(sync)sync.disabled=disabled||!enabled;
    const toggle=$('clinicalSyncEnable');if(toggle)toggle.disabled=disabled;
  }
  function prepareBackupRecords(rows,state,clinicId){
    const collections=new Map(localCollections(state).map(x=>[x.type,x]));
    const patients=collections.get('patient')?.rows||[];
    for(const row of rows.filter(x=>x.entity_type==='patient'&&!x.deleted_at)){
      const remote=String(row.local_id),mapped=localId('patient',remote,clinicId);
      if(patients.some(x=>String(x.id)===mapped))continue;
      const code=String(row.payload?.code||'').trim().toLowerCase();
      const matches=patients.filter(x=>String(x.code||'').trim().toLowerCase()===code);
      if(code&&matches.length===1)window.WoundAICloudSync.adoptCloudId('patient',String(matches[0].id),remote,clinicId);
    }
    const wounds=collections.get('wound')?.rows||[];
    for(const row of rows.filter(x=>x.entity_type==='wound'&&!x.deleted_at)){
      const remote=String(row.local_id),mapped=localId('wound',remote,clinicId);
      if(wounds.some(x=>String(x.id)===mapped))continue;
      const payload=localizePayload('wound',row.payload,remote,clinicId);
      const matches=wounds.filter(x=>String(x.patientId)===String(payload.patientId)&&
        String(x.site||'')===String(payload.site||'')&&String(x.onset||'')===String(payload.onset||'')&&sameTime(x.created,payload.created));
      if(matches.length===1)window.WoundAICloudSync.adoptCloudId('wound',String(matches[0].id),remote,clinicId);
    }
    for(const row of rows.filter(x=>!x.deleted_at&&x.entity_type!=='patient'&&x.entity_type!=='wound')){
      const type=row.entity_type,remote=String(row.local_id),collection=collections.get(type);
      if(!collection)continue;
      const mapped=localId(type,remote,clinicId);
      if(collection.rows.some(x=>String(x.id)===mapped))continue;
      const payload=localizePayload(type,row.payload,remote,clinicId);
      let matches=[];
      if(type==='assessment')matches=collection.rows.filter(x=>x.kind===payload.kind&&String(x.patientId||'')===String(payload.patientId||'')&&String(x.woundId||'')===String(payload.woundId||'')&&sameTime(x.created,payload.created));
      if(type==='image')matches=collection.rows.filter(x=>String(x.patientId)===String(payload.patientId)&&String(x.woundId)===String(payload.woundId)&&sameTime(x.created,payload.created)&&String(x.viewType||'')===String(payload.viewType||''));
      if(type==='appointment')matches=collection.rows.filter(x=>String(x.patientId)===String(payload.patientId)&&String(x.woundId)===String(payload.woundId)&&sameTime(x.due,payload.due));
      if(matches.length===1)window.WoundAICloudSync.adoptCloudId(kindFor[type],String(matches[0].id),remote,clinicId);
    }
    return rows.map(row=>{
      const type=row.entity_type,remote=String(row.local_id);
      return {...row,localId:localId(type,remote,clinicId),
        payload:row.payload?localizePayload(type,row.payload,remote,clinicId):null};
    });
  }
  async function resetForRestore(clinicId){
    if(enabled&&activeClinic!==clinicId)throw new Error('مرکز فعال همگام‌سازی با مرکز پشتیبان یکسان نیست.');
    const pending=(await all('outbox')).filter(x=>x.clinicId===clinicId);
    if(pending.length)throw new Error('ابتدا صف تغییرات محلی را همگام‌سازی کنید؛ برای جلوگیری از حذف تغییرات معوق، بازنشانی مجاز نیست.');
    for(const name of ['shadow','conflicts']){
      const rows=(await all(name)).filter(x=>x.clinicId===clinicId);
      for(const row of rows)await del(name,row.key);
    }
    activeClinic=clinicId;
    return true;
  }
  async function importRestoreTombstones(clinicId,rows,stateSnapshot){
    let count=0;
    for(const row of rows||[]){
      if(!row.deleted_at||!kindFor[row.entity_type])continue;
      const collectionKey=COLLECTIONS.find(x=>x.type===row.entity_type)?.key;
      const remote=String(row.local_id),local=localId(row.entity_type,remote,clinicId),key=makeKey(clinicId,row.entity_type,local);
      if(collectionKey&&stateSnapshot?.[collectionKey]?.some(x=>String(x.id)===local))continue;
      window.WoundAICloudSync.adoptCloudId(kindFor[row.entity_type],local,remote,clinicId);
      await put('outbox',{key,clinicId,type:row.entity_type,localId:local,serverId:remote,
        dedupeKey:local,expectedRevision:0,payload:null,previousPayload:null,mediaBlob:null,
        hash:'__deleted__',deleted:true,queuedAt:now()});
      count++;
    }
    return count;
  }
  async function configure(clinicId,turnOn){
    if(!clinicId)throw new Error('ابتدا مرکز درمانی را انتخاب کنید.');
    const c=client();await c.ensureFreshSession();
    if(c.getAal()!=='aal2')throw new Error('برای فعال‌سازی همگام‌سازی، MFA سطح AAL2 لازم است.');
    const role=(await c.listClinicMemberships()).find(x=>x.clinic_id===clinicId)?.role;
    if(!['owner','admin','clinician'].includes(role))throw new Error('نقش فعلی اجازه همگام‌سازی و نوشتن اطلاعات بالینی را ندارد.');
    activeClinic=clinicId;enabled=!!turnOn;
    await put('meta',{key:'config',clinicId,enabled,changedAt:now()});
    if(enabled){await syncNow();}
    else await renderStatus('همگام‌سازی خودکار غیرفعال شد؛ داده‌های محلی حذف نمی‌شوند.');
    setButtons(false);
    return {clinicId,enabled};
  }
  async function init(){
    const cfg=await get('meta','config');
    if(cfg?.enabled&&cfg.clinicId){activeClinic=cfg.clinicId;enabled=true;}
    const toggle=$('clinicalSyncEnable'),sync=$('clinicalSyncNow');
    if(toggle){toggle.checked=enabled;toggle.addEventListener('change',async()=>{
      try{
        const clinic=$('cloudClinicSelect')?.value;
        if(toggle.checked){
          if(!confirm('همگام‌سازی دوطرفه اطلاعات بالینی این مرکز فعال شود؟ فقط پرونده‌های دارای رضایت ثبت‌شده همگام می‌شوند.')){toggle.checked=false;return;}
          await configure(clinic,true);
        }else{
          activeClinic=clinic||activeClinic;enabled=false;
          await put('meta',{key:'config',clinicId:activeClinic,enabled:false,changedAt:now()});
          await renderStatus('همگام‌سازی خودکار غیرفعال شد؛ داده‌های محلی و صف ارسال حفظ شدند.');
        }
      }catch(e){toggle.checked=false;await renderStatus(e.message,true);}
      setButtons(false);
    });}
    if(sync)sync.addEventListener('click',()=>syncNow().catch(e=>renderStatus(e.message,true)));
    window.addEventListener('online',()=>{if(enabled&&canSync())syncNow().catch(e=>renderStatus(e.message,true));});
    window.addEventListener('woundai:cloud-session-changed',event=>{
      if(enabled&&event.detail?.signed&&event.detail?.aal2)syncNow().catch(e=>renderStatus(e.message,true));
    });
    window.addEventListener('woundai:legacy-cloud-transfer-complete',event=>{
      if(enabled&&event.detail?.clinicId===activeClinic)syncNow().catch(e=>renderStatus(e.message,true));
    });
    document.addEventListener('visibilitychange',()=>{if(!document.hidden&&enabled&&canSync())syncNow().catch(e=>renderStatus(e.message,true));});
    if(enabled){
      await renderStatus('همگام‌سازی خودکار فعال است؛ برای ارسال تغییرات MFA لازم است.');
      if(canSync())await syncNow();
    }
    setButtons(false);
  }
  window.WoundAIClinicalSync={
    capture(state){return capture(state).then(result=>{if(enabled&&result.queued)schedule();return result;});},
    syncNow,configure,renderStatus,
    resetForRestore,importRestoreTombstones,prepareBackupRecords,status:async()=>({enabled,clinicId:activeClinic,pending:(await all('outbox')).filter(x=>x.clinicId===activeClinic).length,
      conflicts:(await all('conflicts')).filter(x=>x.clinicId===activeClinic).length}),
    resolveConflict
  };
  function schedule(){
    if(timer)clearTimeout(timer);
    timer=setTimeout(()=>{if(enabled&&navigator.onLine)syncNow().catch(e=>renderStatus(e.message,true));},1800);
  }
  init().catch(e=>renderStatus(e.message,true));
})();
