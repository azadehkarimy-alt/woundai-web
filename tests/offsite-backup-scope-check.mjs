import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';
const clinic='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const records=[
 {entity_type:'patient',local_id:'p-1',payload:{id:'p-1',consent:true}},
 {entity_type:'patient',local_id:'p-2',payload:{id:'p-2',consent:false}},
 {entity_type:'wound',local_id:'w-1',payload:{id:'w-1',patientId:'p-1'}},
 {entity_type:'image',local_id:'i-1',payload:{id:'i-1',patientId:'p-1',storage_path:`${clinic}/p-1/w-1/i-1.png`}},
 {entity_type:'assessment',local_id:'a-2',payload:{id:'a-2',patientId:'p-2'}},
 {entity_type:'patient',local_id:'p-3',deleted_at:'2026-11-14T00:00:00Z',payload:null}
];
const downloads=[];
const client={
 configured:()=>true,authenticated:()=>true,getAal:()=> 'aal2',
 async listClinicalSyncRecords(){return records},
 async downloadWoundImage(path){downloads.push(path);return new Blob(['img'],{type:'image/png'})},
 async invokeFunction(){return {backups:[]}}
};
const elements={cloudClinicSelect:{value:clinic}};
const document={getElementById:id=>elements[id]||null,createElement:()=>({addEventListener(){},click(){}})};
const window={WoundAISupabase:client,WoundAIApp:{},WoundAIClinicalSync:{}};
class FakeFileReader{readAsDataURL(blob){blob.arrayBuffer().then(buf=>{const b=Buffer.from(buf).toString('base64');this.result=`data:${blob.type};base64,${b}`;this.onload?.()}).catch(e=>this.onerror?.(e))}}
const context={window,document,crypto:webcrypto,Blob,FileReader:FakeFileReader,TextEncoder,TextDecoder,Uint8Array,ArrayBuffer,Response,CompressionStream,DecompressionStream,URL,Promise,Error,String,Number,Date,JSON,Object,Map,Set,RegExp,Math,atob,btoa,structuredClone,setTimeout,clearTimeout,console};
vm.runInNewContext(fs.readFileSync(new URL('../offsite-backup-v308.js',import.meta.url),'utf8'),context);
const payload=await window.WoundAIOffsiteBackup.collectBackupPayload(clinic);
assert.equal(payload.records.some(x=>x.local_id==='p-2'),false,'Unconsented patient must not be included in off-site backup');
assert.equal(payload.records.some(x=>x.local_id==='a-2'),false,'Records linked to an unconsented patient must not be included');
assert.equal(payload.records.some(x=>x.local_id==='p-3'),true,'Tombstones must be preserved to prevent resurrection');
assert.equal(payload.media_count,1);
assert.equal(downloads.length,1);
console.log('offsite-backup-scope-check: consent-only clinical records, linked-record filtering, tombstone retention and private media collection passed');
