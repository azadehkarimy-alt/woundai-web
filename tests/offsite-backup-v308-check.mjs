import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';

const elements={};
const window={WoundAISupabase:{},WoundAIApp:{},WoundAIClinicalSync:{}};
const document={getElementById(id){return elements[id]||null},createElement(){return {addEventListener(){},click(){}}}};
const context={window,document,crypto:webcrypto,Blob,FileReader:class{},TextEncoder,TextDecoder,Uint8Array,ArrayBuffer,Response,CompressionStream,DecompressionStream,URL,Promise,Error,String,Number,Date,JSON,Object,Map,Set,RegExp,Math,atob,btoa,structuredClone,setTimeout,clearTimeout,console};
vm.runInNewContext(fs.readFileSync(new URL('../offsite-backup-v308.js',import.meta.url),'utf8'),context);
const api=window.WoundAIOffsiteBackup;
const clinicId='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const mediaPath=`${clinicId}/bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb/bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb/bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb.png`;
const payload={format:'WoundAI-Cloud-Snapshot-v1',clinic_id:clinicId,exported_at:new Date().toISOString(),
  records:[{clinic_id:clinicId,entity_type:'patient',local_id:'p-1',payload:{id:'p-1',name:'Encrypted Patient',consent:true,photo_storage_path:mediaPath}}],
  media:[{path:mediaPath,type:'image/png',data:'aW1hZ2U='}],record_count:1,media_count:1};
const pack=await api.encryptPackage(payload,'correct horse battery staple','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb');
const restored=await api.decryptFile(pack.blob,'correct horse battery staple');
assert.equal(restored.payload.records[0].payload.name,'Encrypted Patient');
assert.equal(restored.payload.media[0].data,'aW1hZ2U=');
await assert.rejects(api.decryptFile(pack.blob,'wrong passphrase'),/عبارت عبور اشتباه/);
const bytes=new Uint8Array(await pack.blob.arrayBuffer());
const first=bytes.indexOf(10),second=bytes.indexOf(10,first+1);
const header=JSON.parse(new TextDecoder().decode(bytes.slice(first+1,second)));
header.clinic_id='cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const tampered=new Blob([new TextEncoder().encode(`WAI308\n${JSON.stringify(header)}\n`),bytes.slice(second+1)]);
await assert.rejects(api.decryptFile(tampered,'correct horse battery staple'));
console.log('offsite-backup-v308-check: AES-256-GCM round-trip, compression, wrong-pass rejection and authenticated-header tamper detection passed');
