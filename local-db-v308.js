/* WoundAI v30.8 — durable local-first clinical state store. */
(function(){
  'use strict';
  const DB_NAME='woundai-local-clinical-v308',VERSION=1,STORE='snapshots',KEY='clinicalState';
  let dbPromise=null,writeChain=Promise.resolve(),ready=false,restoring=true;
  const isDataUrl=x=>typeof x==='string'&&/^data:image\/[^;]+;base64,/i.test(x);
  function clone(x){return structuredClone(x);}
  function open(){
    if(!('indexedDB' in window))return Promise.reject(new Error('IndexedDB در این مرورگر پشتیبانی نمی‌شود.'));
    if(dbPromise)return dbPromise;
    dbPromise=new Promise((resolve,reject)=>{
      const req=indexedDB.open(DB_NAME,VERSION);
      req.onupgradeneeded=()=>{const db=req.result;if(!db.objectStoreNames.contains(STORE))db.createObjectStore(STORE,{keyPath:'key'});};
      req.onsuccess=()=>resolve(req.result);
      req.onerror=()=>reject(req.error||new Error('بازکردن پایگاه داده محلی ناموفق بود.'));
      req.onblocked=()=>reject(new Error('به‌روزرسانی پایگاه داده محلی مسدود شده است؛ زبانه‌های دیگر WoundAI را ببندید.'));
    });
    return dbPromise;
  }
  async function request(mode,fn){
    const db=await open();
    return new Promise((resolve,reject)=>{
      const tx=db.transaction(STORE,mode),store=tx.objectStore(STORE);
      let req;try{req=fn(store)}catch(e){reject(e);return}
      tx.oncomplete=()=>resolve(req?.result);
      tx.onerror=()=>reject(tx.error||new Error('ذخیره پایدار محلی ناموفق بود.'));
      tx.onabort=()=>reject(tx.error||new Error('تراکنش ذخیره محلی لغو شد.'));
    });
  }
  function getSnapshot(){return request('readonly',s=>s.get(KEY));}
  function save(state,savedAt=Date.now()){
    const payload=clone(state);
    writeChain=writeChain.catch(()=>{}).then(()=>request('readwrite',s=>s.put({key:KEY,savedAt,payload})));
    return writeChain;
  }
  function toLocalSnapshot(state,savedAt=Date.now()){
    const copy=clone(state);
    copy.patients=(copy.patients||[]).map(p=>{
      if(isDataUrl(p.photo)){p.photo='';p._photoInIndexedDB=true;}
      return p;
    });
    copy.images=(copy.images||[]).map(img=>{
      if(isDataUrl(img.image)){img.image='';img._imageInIndexedDB=true;}
      if(isDataUrl(img.thumbnail))img.thumbnail='';
      return img;
    });
    copy._localSavedAt=savedAt;
    copy._mediaInIndexedDB=true;copy._fallbackFull=false;
    return copy;
  }
  async function restore(initialState){
    restoring=true;
    try{
      const saved=await getSnapshot();
      const local=(()=>{try{return JSON.parse(localStorage.getItem('woundai_pro_local_v2')||'null')}catch{return null}})();
      if(saved?.payload){
        if(local?._fallbackFull&&Number(local._localSavedAt)>Number(saved.savedAt)){
          const recovered=clone(local);delete recovered._fallbackFull;delete recovered._localSavedAt;
          await save(recovered,Number(local._localSavedAt)||Date.now());
          ready=true;return recovered;
        }
        ready=true;return clone(saved.payload);
      }
      const initial=clone(initialState||{patients:[],wounds:[],assessments:[],images:[],appointments:[],aiModel:null});
      const missingImage=initial.images?.some(x=>x._imageInIndexedDB&&!x.image);
      const missingPhoto=initial.patients?.some(x=>x._photoInIndexedDB&&!x.photo);
      if(missingImage||missingPhoto){
        throw new Error('نسخه محلی به فایل‌های تصویری IndexedDB وابسته است اما پایگاه داده اصلی پیدا نشد؛ پیش از ادامه، فایل پشتیبان را بازیابی کنید.');
      }
      await save(initial);
      ready=true;
      return initial;
    }catch(error){
      ready=false;
      throw error;
    }finally{
      restoring=false;
      unlock();
    }
  }
  function unlock(){
    const button=document.getElementById('enterWoundAI');
    if(button)button.disabled=false;
    const status=document.getElementById('localDbBootStatus');if(status)status.textContent=ready?'اطلاعات محلی بازیابی شد.':'ذخیره‌سازی پایدار در دسترس نیست؛ از پشتیبان استفاده کنید.';
  }
  function isReady(){return ready;}
  function isRestoring(){return restoring;}
  window.WoundAILocalStore={restore,save,toLocalSnapshot,isReady,isRestoring,unlock};
  const enter=document.getElementById('enterWoundAI');
  if(enter){enter.disabled=true;enter.textContent='در حال بازیابی پرونده‌ها…';}
})();
