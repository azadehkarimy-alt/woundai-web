import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const dbs=new Map();
function openDB(name){
 const req={};
 queueMicrotask(()=>{
  let db=dbs.get(name);
  if(!db){db={stores:new Map(),objectStoreNames:{contains:n=>db.stores.has(n)},createObjectStore(n,{keyPath}){db.stores.set(n,{keyPath,rows:new Map()})},transaction(storeName){
    const storeData=db.stores.get(storeName),tx={error:null,objectStore(){
      const make=result=>{const r={result};queueMicrotask(()=>{r.onsuccess?.();queueMicrotask(()=>tx.oncomplete?.())});return r};
      return {get:k=>make(storeData.rows.get(k)),put:v=>{storeData.rows.set(v[storeData.keyPath],v);return make(v[storeData.keyPath])}};
    }};return tx;
  }};dbs.set(name,db);}
  req.result=db;req.onupgradeneeded?.();req.onsuccess?.();
 });
 return req;
}
const elements={enterWoundAI:{disabled:false,textContent:'Enter'},localDbBootStatus:{textContent:''}};
const localStorageMap=new Map();
const localStorage={getItem:k=>localStorageMap.get(k)||null,setItem:(k,v)=>localStorageMap.set(k,String(v))};
const window={indexedDB:{open:openDB}};
const document={getElementById:id=>elements[id]||null};
const context={window,document,indexedDB:{open:openDB},localStorage,structuredClone,Promise,Error,Date,JSON,String,Array,Map,Set,Blob};
vm.runInNewContext(fs.readFileSync(new URL('../local-db-v308.js',import.meta.url),'utf8'),context);
assert.equal(elements.enterWoundAI.disabled,true,'startup remains locked during local restore');
const initial={patients:[{id:'p-1',photo:'data:image/png;base64,cGhvdG8='}],wounds:[],images:[{id:'i-1',image:'data:image/png;base64,aW1hZ2U=',thumbnail:'data:image/png;base64,aW1hZ2U='}],assessments:[],appointments:[],aiModel:null};
const restored=await window.WoundAILocalStore.restore(initial);
assert.equal(restored.images[0].image,'data:image/png;base64,aW1hZ2U=');
assert.equal(window.WoundAILocalStore.isReady(),true);
const compact=window.WoundAILocalStore.toLocalSnapshot(restored,123);
assert.equal(compact.images[0].image,'');
assert.equal(compact.images[0]._imageInIndexedDB,true);
assert.equal(compact.patients[0].photo,'');
assert.equal(compact.patients[0]._photoInIndexedDB,true);
const updated=structuredClone(restored);updated.patients[0].name='Updated';
await window.WoundAILocalStore.save(updated,456);
const roundTrip=await window.WoundAILocalStore.restore({});
assert.equal(roundTrip.patients[0].name,'Updated');
window.WoundAILocalStore.unlock();
assert.equal(elements.enterWoundAI.disabled,false);
assert.ok(elements.localDbBootStatus.textContent.includes('بازیابی شد'));
console.log('local-db-v308-check: first-run migration, IndexedDB persistence, media-light localStorage snapshot and startup lock/unlock passed');
