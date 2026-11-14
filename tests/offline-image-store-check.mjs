import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const databases=new Map();
function fakeIndexedDBOpen(name){
  const req={result:null};
  queueMicrotask(()=>{
    let db=databases.get(name);
    if(!db){db={stores:new Map(),objectStoreNames:{contains(n){return db.stores.has(n)}},createObjectStore(n,{keyPath}){db.stores.set(n,{keyPath,rows:new Map()})},transaction(storeName){
      const storeData=db.stores.get(storeName);
      const tx={error:null,objectStore(){
        const request=(result)=>{const r={result};queueMicrotask(()=>{r.onsuccess?.();queueMicrotask(()=>tx.oncomplete?.())});return r};
        return {
          put(value){storeData.rows.set(value[storeData.keyPath],value);return request(value[storeData.keyPath])},
          get(key){return request(storeData.rows.get(key))},
          getAll(){return request([...storeData.rows.values()])},
          delete(key){storeData.rows.delete(key);return request(undefined)}
        };
      }};
      return tx;
    }};databases.set(name,db);}
    req.result=db;req.onupgradeneeded?.();req.onsuccess?.();
  });
  return req;
}
const indexedDB={open:fakeIndexedDBOpen};
const window={indexedDB};
const context={window,indexedDB,Blob,Date,Promise,Error,String,Map,Set,Array,Object,JSON};
vm.runInNewContext(fs.readFileSync(new URL('../offline-image-store-v307.js',import.meta.url),'utf8'),context);
const store=window.WoundAIOfflineImages;
assert.ok(store);
const blob=new Blob(['image-data'],{type:'image/png'});
await store.cacheImage('img-1',blob,{clinicId:'clinic-1'});
const cached=await store.getCachedImage('img-1');
assert.equal(cached.blob.size,10);
await store.queueUpload({clinicId:'clinic-1',path:'clinic/patient/wound/image.png',blob,contentType:'image/png',row:{id:'img-1',clinic_id:'clinic-1'}});
assert.equal(await store.pendingCount(),1);
const calls=[];
const client={
  authenticated:()=>true,getAal:()=> 'aal2',
  async uploadWoundImage(path,file,type){calls.push(['upload',path,file.size,type])},
  async upsertRows(table,rows){calls.push(['upsert',table,rows.length])}
};
const result=await store.flush(client);
assert.equal(result.uploaded,1);
assert.equal(result.remaining,0);
assert.equal(await store.getCachedImage('img-1'),null,'uploaded image cache entry should be cleaned up');
assert.equal(calls.length,2);
await assert.rejects(store.flush({...client,getAal:()=> 'aal1'}),/AAL2/);
console.log('offline-image-store-check: IndexedDB cache, queued upload, AAL2-gated flush and queue cleanup passed');
