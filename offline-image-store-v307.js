/* WoundAI v30.7 — IndexedDB offline image cache and retry queue. */
(function () {
  'use strict';
  const DB_NAME='woundai-offline-v307';
  const DB_VERSION=1;
  let dbPromise=null;
  function openDB() {
    if (!('indexedDB' in window)) return Promise.reject(new Error('IndexedDB در این مرورگر در دسترس نیست.'));
    if (dbPromise) return dbPromise;
    dbPromise=new Promise((resolve,reject)=>{
      const request=indexedDB.open(DB_NAME,DB_VERSION);
      request.onupgradeneeded=()=>{
        const db=request.result;
        if(!db.objectStoreNames.contains('imageCache'))db.createObjectStore('imageCache',{keyPath:'id'});
        if(!db.objectStoreNames.contains('pendingUploads'))db.createObjectStore('pendingUploads',{keyPath:'queueId'});
      };
      request.onsuccess=()=>resolve(request.result);
      request.onerror=()=>reject(request.error||new Error('بازکردن فضای آفلاین ناموفق بود.'));
      request.onblocked=()=>reject(new Error('به‌روزرسانی فضای آفلاین مسدود شده است؛ زبانه‌های دیگر برنامه را ببندید.'));
    });
    return dbPromise;
  }
  async function transact(storeName,mode,operation) {
    const db=await openDB();
    return new Promise((resolve,reject)=>{
      const tx=db.transaction(storeName,mode);
      const store=tx.objectStore(storeName);
      let result;
      try { result=operation(store); } catch(error) { reject(error); return; }
      tx.oncomplete=()=>resolve(result?.result);
      tx.onerror=()=>reject(tx.error||new Error('تراکنش فضای آفلاین ناموفق بود.'));
      tx.onabort=()=>reject(tx.error||new Error('تراکنش فضای آفلاین لغو شد.'));
    });
  }
  async function put(store,value) { return transact(store,'readwrite',s=>s.put(value)); }
  async function getAll(store) { return transact(store,'readonly',s=>s.getAll()); }
  async function remove(store,key) { return transact(store,'readwrite',s=>s.delete(key)); }
  async function cacheImage(id,blob,metadata={}) {
    if(!id||!(blob instanceof Blob))throw new Error('شناسه یا فایل تصویر معتبر نیست.');
    if(blob.size>12*1024*1024)throw new Error('تصویر بزرگ‌تر از ۱۲ مگابایت است.');
    await put('imageCache',{id:String(id),blob,contentType:blob.type||'application/octet-stream',metadata,storedAt:new Date().toISOString()});
    return true;
  }
  async function getCachedImage(id) {
    const db=await openDB();
    return new Promise((resolve,reject)=>{
      const tx=db.transaction('imageCache','readonly');
      const req=tx.objectStore('imageCache').get(String(id));
      req.onsuccess=()=>resolve(req.result||null);
      req.onerror=()=>reject(req.error);
    });
  }
  async function queueUpload(item) {
    if(!item?.clinicId||!item?.path||!item?.row||!(item.blob instanceof Blob))throw new Error('اطلاعات صف بارگذاری تصویر ناقص است.');
    const queueId=`${item.clinicId}:${item.row.id}`;
    await put('pendingUploads',{...item,queueId,queuedAt:new Date().toISOString()});
    await cacheImage(item.row.id,item.blob,{clinicId:item.clinicId,path:item.path,pending:true});
    return queueId;
  }
  async function pendingUploads() { return getAll('pendingUploads'); }
  async function pendingCount() { return (await pendingUploads()).length; }
  async function flush(client) {
    if(!client?.authenticated?.())throw new Error('برای ارسال تصاویر معوق ابتدا وارد حساب شوید.');
    if(client.getAal?.()!=='aal2')throw new Error('برای ارسال تصاویر معوق، MFA سطح AAL2 لازم است.');
    const queue=await pendingUploads();
    let uploaded=0;
    for(const item of queue) {
      await client.uploadWoundImage(item.path,item.blob,item.contentType);
      await client.upsertRows('wound_images',[item.row]);
      await remove('pendingUploads',item.queueId);
      await remove('imageCache',item.row.id);
      uploaded++;
    }
    return {uploaded,remaining:await pendingCount()};
  }
  async function clearCache(id) { await remove('imageCache',String(id)); }
  window.WoundAIOfflineImages={cacheImage,getCachedImage,queueUpload,pendingUploads,pendingCount,flush,clearCache};
})();
