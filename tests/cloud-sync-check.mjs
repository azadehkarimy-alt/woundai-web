import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import crypto from 'node:crypto';

const uuid = () => crypto.randomUUID();
const patientId=uuid(), woundId=uuid(), imageId=uuid(), assessmentId=uuid(), encounterId=uuid(), planId=uuid(), appointmentId=uuid();
const state = {
  patients:[{id:patientId,name:'Patient A',code:'WA-1001',dob:'1980-01-01',sex:'female',phone:'123',consent:true,created:'2026-11-01T10:00:00Z'}],
  wounds:[{id:woundId,patientId,etiology:'diabetic',site:'heel',side:'left',onset:'2026-10-01',notes:'note',followup:'review',status:'active'}],
  images:[{id:imageId,patientId,woundId,created:'2026-11-02T10:00:00Z',image:'data:image/png;base64,iVBORw0KGgo=',width:1,height:1,areaCm2:1,points:[]}],
  assessments:[{id:assessmentId,patientId,woundId,imageId,created:'2026-11-02T11:00:00Z',kind:'clinical-assessment',data:{encounterId,notes:'clinical'}},
    {id:planId,patientId,woundId,created:'2026-11-02T12:00:00Z',kind:'care-plan-stage7',data:{status:'approved',clinician:'Dr Test',items:[]}}],
  appointments:[{id:appointmentId,patientId,woundId,due:'2026-11-20',lead:2,notes:'review',status:'scheduled'}],
  aiModel:null
};
const elements=new Map();
function el(id) {
  if(!elements.has(id)) elements.set(id,{
    id,value:id==='cloudClinicSelect'?'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa':'',
    disabled:false,textContent:'',dataset:{},children:[],
    addEventListener(){},replaceChildren(...xs){this.children=[...xs]},append(x){this.children.push(x)}
  });
  return elements.get(id);
}
const localStore=new Map();
const localStorage={
  getItem(k){return localStore.has(k)?localStore.get(k):null},
  setItem(k,v){localStore.set(k,String(v))},
  removeItem(k){localStore.delete(k)}
};
const writes=[];
const client={
  configured:()=>true,authenticated:()=>true,getAal:()=>'aal2',
  async ensureFreshSession(){},
  async listRows(table,clinicId){assert.equal(clinicId,'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');return table==='patients'?[]:[]},
  async upsertRows(table,rows){writes.push({table,rows});return rows},
  async insertRowsIgnoreDuplicates(table,rows){writes.push({table,rows});return rows},
  async uploadWoundImage(path,blob,type){writes.push({table:'storage',path,size:blob.size,type});return {Key:path}},
  async downloadWoundImage(){return new Blob(['x'],{type:'image/png'})}
};
const context={
  window:{WoundAISupabase:client,dispatchEvent(){}},CustomEvent:class{constructor(type,init){this.type=type;this.detail=init?.detail}},document:{getElementById:el,createElement:()=>({textContent:'',append(){}})},
  localStorage,crypto:{randomUUID:uuid},atob,Blob,FileReader:class{readAsDataURL(){this.result='data:image/png;base64,eA==';this.onload()}},
  state,persist:()=>true,renderPatients(){},renderStats(){},renderImageHistory(){},
  console,Date,Map,Set,Promise,JSON,Number,String,Array,Object,RegExp,Math,Error
};
vm.runInNewContext(fs.readFileSync(new URL('../cloud-sync-v30.js',import.meta.url),'utf8'),context,{filename:'cloud-sync-v30.js'});
const sync=context.window.WoundAICloudSync;
assert.ok(sync,'cloud sync API exported');
const preview=await sync.preview();
assert.equal(preview.data.patients.length,1,'consented patient included');
assert.equal(preview.data.images.length,1);
assert.equal(preview.data.carePlans.length,1);
const before=JSON.stringify(state);
const result=await sync.transfer();
assert.equal(result.patients,1);
assert.equal(result.wounds,1);
assert.equal(result.images,1);
assert.equal(result.assessments,1);
assert.equal(result.carePlans,1);
assert.equal(result.appointments,1);
assert.equal(writes.filter(x=>x.table==='storage').length,1,'image binary uploaded');
assert.ok(writes.some(x=>x.table==='patients'));
assert.ok(writes.some(x=>x.table==='wounds'));
assert.ok(writes.some(x=>x.table==='encounters'));
assert.ok(writes.some(x=>x.table==='assessments'));
assert.ok(writes.some(x=>x.table==='care_plans'));
assert.ok(writes.some(x=>x.table==='appointments'));
assert.equal(JSON.stringify(state),before,'local data must remain untouched by cloud transfer');
const mapped=sync.cloudId('patient','local-legacy-id');
assert.match(mapped,/^[0-9a-f-]{36}$/i);
assert.equal(sync.cloudId('patient','local-legacy-id'),mapped,'mapping must be stable across retries');
assert.equal(sync.localId('patient',mapped),'local-legacy-id');
const clinicA=sync.cloudId('patient','shared-local-id',undefined,'clinic-A');
const clinicB=sync.cloudId('patient','shared-local-id',undefined,'clinic-B');
assert.notEqual(clinicA,clinicB,'local IDs must be namespaced per clinic');
assert.equal(sync.localId('patient',clinicA,undefined,'clinic-A'),'shared-local-id');
const withoutConsent={...state,patients:[{...state.patients[0],consent:false}]};
context.state=withoutConsent;
assert.equal(sync.eligibleData().patients.length,0,'patients without recorded consent are excluded');
context.state={patients:[{id:uuid(),name:'Duplicate A',code:'DUP-1',consent:true},{id:uuid(),name:'Duplicate B',code:'DUP-1',consent:true}],wounds:[],images:[],assessments:[],appointments:[]};
const duplicatePreview=await sync.preview();
assert.equal(duplicatePreview.conflicts.length,1,'duplicate local record codes must block migration');
console.log('cloud-sync-check: consent gate, duplicate detection, preview, clinic-scoped IDs, staged writes, private image upload and local-data retention passed');


// Cloud-to-local merge: add only new rows and preserve an existing local record.
const clinicId='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const cloudExisting='cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const cloudNewPatient='dddddddd-dddd-4ddd-8ddd-dddddddddddd';
const cloudWound='eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';
const cloudImage='ffffffff-ffff-4fff-8fff-ffffffffffff';
const cloudAssessment='11111111-1111-4111-8111-111111111111';
const cloudCarePlan='22222222-2222-4222-8222-222222222222';
const cloudAppointment='33333333-3333-4333-8333-333333333333';
const existingLocalId='legacy-existing-patient';
const mapKey='woundai.cloud-id-map.v1';
const mergeStore=new Map([[mapKey,JSON.stringify({[`${clinicId}:patient:${existingLocalId}`]:cloudExisting})]]);
const mergeLocalStorage={
  getItem(k){return mergeStore.has(k)?mergeStore.get(k):null},
  setItem(k,v){mergeStore.set(k,String(v))},
  removeItem(k){mergeStore.delete(k)}
};
const mergeState={
  patients:[{id:existingLocalId,name:'Local unchanged',code:'WA-OLD',consent:true}],
  wounds:[],images:[],assessments:[],appointments:[],aiModel:null
};
const remote={
  patients:[
    {id:cloudExisting,record_code:'WA-OLD',full_name:'Cloud updated name',consent_record:{consent:true},created_at:'2026-11-01T00:00:00Z'},
    {id:cloudNewPatient,record_code:'WA-NEW',full_name:'New remote patient',consent_record:{consent:true},created_at:'2026-11-02T00:00:00Z'}
  ],
  wounds:[{id:cloudWound,patient_id:cloudNewPatient,anatomical_site:'heel',laterality:'left',status:'active',created_at:'2026-11-02T00:00:00Z'}],
  wound_images:[{id:cloudImage,patient_id:cloudNewPatient,wound_id:cloudWound,storage_path:`${clinicId}/${cloudNewPatient}/${cloudWound}/${cloudImage}.png`,captured_at:'2026-11-03T00:00:00Z',width_px:1,height_px:1,metadata:{note:'remote image'}}],
  assessments:[{id:cloudAssessment,patient_id:cloudNewPatient,wound_id:cloudWound,assessment_type:'clinical-assessment',assessed_at:'2026-11-03T00:00:00Z',data:{notes:'remote assessment'}}],
  care_plans:[{id:cloudCarePlan,patient_id:cloudNewPatient,wound_id:cloudWound,status:'approved',plan:{items:[]},created_at:'2026-11-03T00:00:00Z'}],
  encounters:[],
  appointments:[{id:cloudAppointment,patient_id:cloudNewPatient,wound_id:cloudWound,due_at:'2026-11-25T12:00:00Z',status:'scheduled'}]
};
const mergeClient={
  configured:()=>true,authenticated:()=>true,getAal:()=>'aal2',async ensureFreshSession(){},
  async listRows(table){return remote[table]||[]},
  async downloadWoundImage(){return new Blob(['img'],{type:'image/png'})}
};
const mergeEls=new Map();
function mergeEl(id){
  if(!mergeEls.has(id))mergeEls.set(id,{id,value:clinicId,disabled:false,textContent:'',dataset:{},children:[],addEventListener(){},replaceChildren(...x){this.children=[...x]},append(x){this.children.push(x)}});
  return mergeEls.get(id);
}
const mergeContext={
  window:{WoundAISupabase:mergeClient,dispatchEvent(){}},CustomEvent:class{constructor(type,init){this.type=type;this.detail=init?.detail}},document:{getElementById:mergeEl,createElement:()=>({textContent:'',append(){}})},
  localStorage:mergeLocalStorage,crypto:{randomUUID:uuid},atob,Blob,
  FileReader:class{readAsDataURL(){this.result='data:image/png;base64,eA==';this.onload()}},
  state:mergeState,persist:()=>true,renderPatients(){},renderStats(){},renderImageHistory(){},
  console,Date,Map,Set,Promise,JSON,Number,String,Array,Object,RegExp,Math,Error
};
vm.runInNewContext(fs.readFileSync(new URL('../cloud-sync-v30.js',import.meta.url),'utf8'),mergeContext,{filename:'cloud-sync-merge-test.js'});
const merged=await mergeContext.window.WoundAICloudSync.downloadAndMerge();
assert.equal(merged.patients,1,'only new cloud patient is added');
assert.equal(merged.wounds,1);
assert.equal(merged.images,1);
assert.equal(merged.assessments,1);
assert.equal(merged.carePlans,1);
assert.equal(merged.appointments,1);
assert.equal(mergeState.patients.length,2);
assert.equal(mergeState.patients[0].name,'Local unchanged','existing local record must not be overwritten');
assert.equal(mergeState.images[0].image,'data:image/png;base64,eA==');
console.log('cloud-sync-merge-check: cloud download, image restore, new-record merge and local conflict preservation passed');


// Version-aware cloud patient update must use compare-and-swap, not unconditional upsert.
const syncClinic='44444444-4444-4444-8444-444444444444';
const syncLocalId='local-patient-v307';
const syncCloudId='55555555-5555-4555-8555-555555555555';
const syncMapKey='woundai.cloud-id-map.v1';
const syncStorage=new Map([[syncMapKey,JSON.stringify({[`${syncClinic}:patient:${syncLocalId}`]:syncCloudId})]]);
const syncLocalStorage={getItem(k){return syncStorage.get(k)||null},setItem(k,v){syncStorage.set(k,String(v))},removeItem(k){syncStorage.delete(k)}};
const syncState={patients:[{id:syncLocalId,name:'Patient v307',code:'WA-307',dob:'1980-01-01',sex:'female',phone:'new-phone',consent:true,created:'2026-11-01T00:00:00Z',updated:'2026-11-14T00:00:00Z'}],wounds:[],images:[],assessments:[],appointments:[],aiModel:null};
const remotePatient={id:syncCloudId,clinic_id:syncClinic,record_code:'WA-307',full_name:'Patient v307',date_of_birth:'1980-01-01',sex:'female',phone:'old-phone',emergency_contact:null,diabetes:null,vascular_disease:null,allergies:null,medications:null,medical_history:null,consent_record:{consent:true,source:'local-record'},status:'active',created_at:'2026-11-01T00:00:00Z',updated_at:'2026-11-02T00:00:00Z',revision:4};
const versionedCalls=[];
const versionedClient={
  configured:()=>true,authenticated:()=>true,getAal:()=>'aal2',async ensureFreshSession(){},
  async listRows(table){return table==='patients'?[remotePatient]:[]},
  async updateRowsVersioned(table,clinic,id,revision,patch){versionedCalls.push({table,clinic,id,revision,patch});throw Object.assign(new Error('stale'),{code:'WOUNDAI_CONFLICT'})},
  async upsertRows(table,rows){versionedCalls.push({table,rows});return rows},
  async insertRowsIgnoreDuplicates(table,rows){return rows},
  async uploadWoundImage(){throw new Error('not expected')}
};
const syncElements=new Map();
function syncEl(id){if(!syncElements.has(id))syncElements.set(id,{id,value:syncClinic,disabled:false,textContent:'',dataset:{},children:[],addEventListener(){},replaceChildren(){},append(){}});return syncElements.get(id)}
const syncContext={window:{WoundAISupabase:versionedClient,dispatchEvent(){}},CustomEvent:class{constructor(type,init){this.type=type;this.detail=init?.detail}},document:{getElementById:syncEl,createElement:()=>({textContent:'',append(){}})},localStorage:syncLocalStorage,crypto:{randomUUID:uuid},atob,Blob,state:syncState,persist:()=>true,renderPatients(){},renderStats(){},renderImageHistory(){},console,Date,Map,Set,Promise,JSON,Number,String,Array,Object,RegExp,Math,Error};
vm.runInNewContext(fs.readFileSync(new URL('../cloud-sync-v30.js',import.meta.url),'utf8'),syncContext,{filename:'cloud-sync-conflict-test.js'});
const syncApi=syncContext.window.WoundAICloudSync;
await syncApi.preview();
const syncResult=await syncApi.transfer();
assert.equal(syncResult.conflicts,1,'stale revision must be reported as conflict');
assert.equal(versionedCalls.filter(x=>x.table==='patients').length,1,'existing patient must use versioned update');
assert.equal(versionedCalls.find(x=>x.table==='patients').revision,4);
assert.equal(syncState.patients[0].phone,'new-phone','local record remains intact after conflict');
console.log('cloud-sync-conflict-check: stale revision is detected, not overwritten, and local data remains unchanged');
