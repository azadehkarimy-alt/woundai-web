import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const dbs=new Map();
function open(name){
  const req={};
  queueMicrotask(()=>{
    let db=dbs.get(name);
    if(!db){
      db={stores:new Map(),objectStoreNames:{contains(n){return db.stores.has(n)}},createObjectStore(n,{keyPath}){db.stores.set(n,{keyPath,rows:new Map()})},
        transaction(name){const data=db.stores.get(name);const tx={error:null,objectStore(){
          const make=(result)=>{const r={result};queueMicrotask(()=>{r.onsuccess?.();queueMicrotask(()=>tx.oncomplete?.())});return r};
          return {put(v){data.rows.set(v[data.keyPath],v);return make(v[data.keyPath])},get(k){return make(data.rows.get(k))},getAll(){return make([...data.rows.values()])},delete(k){data.rows.delete(k);return make(undefined)}};
        }};return tx;}};
      dbs.set(name,db);
    }
    req.result=db;req.onupgradeneeded?.();req.onsuccess?.();
  });
  return req;
}
const indexedDB={open};
const clinic='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const uid='11111111-1111-4111-8111-111111111111';
const pid='22222222-2222-4222-8222-222222222222';
const wid='33333333-3333-4333-8333-333333333333';
const iid='44444444-4444-4444-8444-444444444444';
const aid='55555555-5555-4555-8555-555555555555';
const apid='66666666-6666-4666-8666-666666666666';
const patient={id:pid,name:'Patient A',code:'W-001',consent:true,phone:'111',photo:'data:image/png;base64,aW1hZ2U=',created:'2026-11-01T00:00:00Z'};
const wound={id:wid,patientId:pid,site:'Heel',created:'2026-11-01T00:00:00Z'};
const image={id:iid,patientId:pid,woundId:wid,image:'data:image/png;base64,aW1hZ2U=',created:'2026-11-01T00:00:00Z'};
const assessment={id:aid,patientId:pid,woundId:wid,created:'2026-11-02T00:00:00Z',kind:'care-plan-stage7',data:{status:'draft'}};
const appointment={id:apid,patientId:pid,woundId:wid,due:'2026-11-20',status:'scheduled'};
const noConsent={id:uid,name:'No Consent',code:'W-002',consent:false};
let state={patients:[patient,noConsent],wounds:[wound,{id:'w2',patientId:uid,site:'Other'}],images:[image],assessments:[assessment],appointments:[appointment],aiModel:null};
const cloud=new Map(),calls=[],uploads=[],downloads=[],deletes=[];
const uuidMap=new Map();
const cloudId=(kind,id,unused,clinicId)=>{const k=`${clinicId}:${kind}:${id}`;if(!uuidMap.has(k))uuidMap.set(k,`${(uuidMap.size+1).toString(16).padStart(8,'0')}-aaaa-4aaa-8aaa-aaaaaaaaaaaa`);return uuidMap.get(k)};
const localId=(kind,remoteId,map,clinicId)=>{for(const [k,v] of uuidMap)if(k.startsWith(`${clinicId}:${kind}:`)&&v===remoteId)return k.slice(`${clinicId}:${kind}:`.length);return remoteId};
const adoptCloudId=(kind,id,remoteId,clinicId)=>{uuidMap.set(`${clinicId}:${kind}:${id}`,remoteId);return remoteId};
const client={
 configured:()=>true,authenticated:()=>true,getAal:()=> 'aal2',async ensureFreshSession(){},
 async listClinicMemberships(){return [{clinic_id:clinic,role:'owner'}]},
 async listClinicalSyncRecords(){return [...cloud.values()].map(x=>structuredClone(x))},
 async uploadWoundImage(path,blob,type){uploads.push({path,size:blob.size,type});return true},
 async downloadWoundImage(path){downloads.push(path);return new Blob(['image'],{type:'image/png'})},
 async deleteWoundImage(path){deletes.push(path);return true},
 async syncClinicalRecords(clinicId,changes){
   const applied=[],conflicts=[];
   for(const change of changes){
     const key=`${clinicId}|${change.entity_type}|${change.local_id}`,old=cloud.get(key);
     if(!old&&change.expected_revision!==0){conflicts.push({entity_type:change.entity_type,local_id:change.local_id,reason:'missing_remote',current:null});continue;}
     if(old&&old.revision!==change.expected_revision){conflicts.push({entity_type:change.entity_type,local_id:change.local_id,reason:'stale_revision',current:structuredClone(old)});continue;}
     const row={clinic_id:clinicId,entity_type:change.entity_type,local_id:change.local_id,dedupe_key:change.dedupe_key,payload:change.deleted?null:structuredClone(change.payload),revision:(old?.revision||0)+1,updated_at:new Date().toISOString(),updated_by:'test-user',deleted_at:change.deleted?new Date().toISOString():null};
     cloud.set(key,row);applied.push(structuredClone(row));calls.push(change);
   }
   return {applied,conflicts,submitted:changes.length};
 }
};
const appApi={getState:()=>state,applyRemoteState(next){state=structuredClone(next);return true}};
const host={replaceChildren(){},append(){},textContent:''};
const elements={clinicalSyncConflicts:host,clinicalSyncQueueCount:{textContent:''},clinicalSyncStatus:{textContent:'',dataset:{}},clinicalSyncEnable:{checked:false,addEventListener(){}},clinicalSyncNow:{disabled:false,addEventListener(){}},cloudClinicSelect:{value:clinic}};
const window={indexedDB,WoundAISupabase:client,WoundAIApp:appApi,WoundAICloudSync:{cloudId,localId,adoptCloudId,readMap:()=>({})},addEventListener(){},setTimeout,clearTimeout};
const document={getElementById(id){return elements[id]||null},addEventListener(){},hidden:false,
 createElement(){return {className:'',textContent:'',disabled:false,addEventListener(){},append(){},appendChild(){}}},createTextNode(text){return {textContent:text}}};
const context={window,indexedDB,document,navigator:{onLine:true},crypto,Blob,FileReader:class{readAsDataURL(blob){blob.arrayBuffer().then(b=>{this.result='data:'+blob.type+';base64,'+Buffer.from(b).toString('base64');this.onload()})}},TextEncoder,TextDecoder,Uint8Array,ArrayBuffer,Map,Set,Promise,Error,String,Number,Date,JSON,Object,RegExp,Math,atob,confirm:()=>true,setTimeout,clearTimeout,console,structuredClone};
vm.runInNewContext(fs.readFileSync(new URL('../clinical-sync-v308.js',import.meta.url),'utf8'),context,{filename:'clinical-sync-v308.js'});
const sync=window.WoundAIClinicalSync;
await sync.configure(clinic,true);
assert.equal(cloud.size,5,'Only consented patient and dependent clinical records should sync');
assert.equal(uploads.length,2,'Patient photo and wound image should upload separately to private Storage');
assert.ok([...cloud.values()].some(x=>x.entity_type==='assessment'&&x.payload.kind==='care-plan-stage7'));
assert.ok([...cloud.values()].every(x=>!JSON.stringify(x.payload).includes('data:image/')),'Binary data URLs must not enter record envelopes');
assert.equal((await sync.status()).pending,0);
await sync.syncNow();
assert.equal(cloud.size,5,'A clean second sync must not duplicate records');

// Legacy cloud records without consent are never imported.
const unconsentedId='77777777-7777-4777-8777-777777777777';
cloud.set(`${clinic}|patient|${unconsentedId}`,{clinic_id:clinic,entity_type:'patient',local_id:unconsentedId,
  dedupe_key:'W-UNCONSENTED',payload:{id:unconsentedId,name:'No consent remote',code:'W-UNCONSENTED',consent:false},
  revision:1,updated_at:new Date().toISOString(),deleted_at:null});
await sync.syncNow();
assert.equal(state.patients.some(x=>x.id===unconsentedId),false,'Unconsented remote patient must not be imported');

// Offline edits stay in IndexedDB until the browser is online again.
context.navigator.onLine=false;
state.appointments.find(x=>x.id===apid).notes='offline-note';
await sync.capture(state);
assert.equal((await sync.status()).pending,1,'Offline edit must be durably queued');
context.navigator.onLine=true;
await sync.syncNow();
const appointmentServerId=cloudId('appointment',apid,null,clinic);
assert.equal(cloud.get(`${clinic}|appointment|${appointmentServerId}`).payload.notes,'offline-note');

// Remote-only update is applied to the local state.
const patientServerId=cloudId('patient',pid,null,clinic);const patientKey=`${clinic}|patient|${patientServerId}`,remotePatient=cloud.get(patientKey);
remotePatient.payload.phone='222';remotePatient.revision++;
cloud.set(patientKey,remotePatient);
await sync.syncNow();
assert.equal(state.patients.find(x=>x.id===pid).phone,'222','Remote-only changes must merge to local state');

// Simultaneous local + remote edits create a conflict and preserve local data.
state.patients.find(x=>x.id===pid).phone='local-edit';
state.patients.find(x=>x.id===pid).updated='2026-11-14T00:00:00Z';
remotePatient.payload.allergies='remote-edit';remotePatient.revision++;
cloud.set(patientKey,remotePatient);
await sync.capture(state);
await sync.syncNow();
assert.equal(state.patients.find(x=>x.id===pid).phone,'local-edit','Local conflicting value must not be overwritten');
assert.equal((await sync.status()).conflicts,1,'Concurrent changes must be surfaced for review');
assert.equal((await sync.status()).pending,0,'Conflicted records must not be retried automatically');

// Explicitly keep local version; compare-and-swap writes it over the reviewed remote revision.
const conflict=(await dbs.get('woundai-clinical-sync-v308').stores.get('conflicts').rows.values().next().value);
await sync.resolveConflict(conflict.key,'local');
assert.equal(cloud.get(patientKey).payload.phone,'local-edit','Keep-local resolution should write the chosen local version');
assert.equal((await sync.status()).conflicts,0);

// Local deletion becomes a tombstone, not a physical delete.
state.wounds=state.wounds.filter(x=>x.id!==wid);
await sync.capture(state);
await sync.syncNow();
assert.ok(cloud.get(`${clinic}|wound|${cloudId('wound',wid,null,clinic)}`).deleted_at,'Local deletion should be represented as a cloud tombstone');

// Revoking consent replaces an already queued update with tombstones for the patient and linked records.
state.patients.find(x=>x.id===pid).phone='pending-before-revoke';
await sync.capture(state);
state.patients.find(x=>x.id===pid).consent=false;
await sync.capture(state);
const pendingPatient=await dbs.get('woundai-clinical-sync-v308').stores.get('outbox').rows.get(`${clinic}|patient|${pid}`);
assert.equal(pendingPatient.deleted,true,'Consent revocation must override any pending non-delete update');
await sync.syncNow();
assert.ok(cloud.get(patientKey).deleted_at,'Consent revocation must tombstone the cloud patient');
assert.ok(cloud.get(`${clinic}|image|${cloudId('image',iid,null,clinic)}`).deleted_at,'Consent revocation must tombstone linked images');
assert.ok(deletes.length>=2,'Consent revocation must remove private image and patient-photo objects from Storage');

console.log('clinical-sync-v308-check: consent gate/revocation, all 5 record collections, media upload, no binary JSON, two-way merge, conflict preservation/resolution, offline outbox and tombstones passed');
