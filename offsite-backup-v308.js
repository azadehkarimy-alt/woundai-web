/* WoundAI v30.8 — encrypted off-site backup to an S3-compatible object store. */
(function(){
  'use strict';
  const $=id=>document.getElementById(id);
  const MAX_BYTES=524288000,ITERATIONS=310000;
  const encoder=new TextEncoder(),decoder=new TextDecoder();
  function b64(bytes){let s='';for(const x of bytes)s+=String.fromCharCode(x);return btoa(s);}
  function unb64(value){const s=atob(value);return Uint8Array.from(s,c=>c.charCodeAt(0));}
  async function sha256(bytes){const h=await crypto.subtle.digest('SHA-256',bytes);return [...new Uint8Array(h)].map(x=>x.toString(16).padStart(2,'0')).join('');}
  async function derive(pass,salt){
    if(pass.length<12)throw new Error('عبارت عبور باید حداقل ۱۲ نویسه داشته باشد.');
    const material=await crypto.subtle.importKey('raw',encoder.encode(pass),'PBKDF2',false,['deriveKey']);
    return crypto.subtle.deriveKey({name:'PBKDF2',salt,iterations:ITERATIONS,hash:'SHA-256'},material,{name:'AES-GCM',length:256},false,['encrypt','decrypt']);
  }
  async function compress(bytes){
    if(typeof CompressionStream==='undefined')return {bytes,compressed:false};
    const stream=new Blob([bytes]).stream().pipeThrough(new CompressionStream('gzip'));
    return {bytes:new Uint8Array(await new Response(stream).arrayBuffer()),compressed:true};
  }
  async function decompress(bytes,compressed){
    if(!compressed)return bytes;
    if(typeof DecompressionStream==='undefined')throw new Error('این مرورگر امکان بازکردن نسخه فشرده پشتیبان را ندارد.');
    const stream=new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'));
    const reader=stream.getReader(),chunks=[];let total=0;
    while(true){const {done,value}=await reader.read();if(done)break;total+=value.length;
      if(total>MAX_BYTES){await reader.cancel();throw new Error('حجم داده بازشده از سقف ۵۰۰ مگابایت بیشتر است.');}
      chunks.push(value);
    }
    const out=new Uint8Array(total);let offset=0;for(const chunk of chunks){out.set(chunk,offset);offset+=chunk.length;}return out;
  }
  function blobDataUrl(blob){
    return new Promise((resolve,reject)=>{
      const reader=new FileReader();reader.onload=()=>resolve(reader.result);
      reader.onerror=()=>reject(new Error('خواندن فایل تصویر پشتیبان ناموفق بود.'));
      reader.readAsDataURL(blob);
    });
  }
  function dataUrlBlob(value){
    const m=String(value||'').match(/^data:(image\/(?:png|jpeg|jpg|webp));base64,([A-Za-z0-9+/=]+)$/i);
    if(!m)throw new Error('تصویر داخل پشتیبان معتبر نیست.');
    const raw=atob(m[2]),bytes=new Uint8Array(raw.length);
    for(let i=0;i<raw.length;i++)bytes[i]=raw.charCodeAt(i);
    return new Blob([bytes],{type:m[1].replace('image/jpg','image/jpeg')});
  }
  function client(){const c=window.WoundAISupabase;if(!c?.authenticated?.())throw new Error('ابتدا وارد حساب ابری شوید.');return c;}
  function clinic(){const id=$('cloudClinicSelect')?.value;if(!id)throw new Error('مرکز درمانی را انتخاب کنید.');return id;}
  function status(message,error=false){const n=$('offsiteBackupStatus');if(n){n.textContent=message;n.dataset.state=error?'error':'ok';}}
  async function call(action,body={}){
    return client().invokeFunction('woundai-offsite-backup',{action,clinic_id:clinic(),...body});
  }
  async function collectBackupPayload(clinicId){
    const c=client(),allRecords=await c.listClinicalSyncRecords(clinicId);
    const allowedPatients=new Set(allRecords.filter(r=>r.entity_type==='patient'&&!r.deleted_at&&r.payload?.consent===true).map(r=>r.local_id));
    const records=allRecords.filter(row=>{
      if(row.deleted_at)return true;
      if(row.entity_type==='patient')return row.payload?.consent===true;
      return allowedPatients.has(String(row.payload?.patientId||''));
    });
    const paths=new Set();
    for(const row of records){
      if(row.deleted_at||!row.payload)continue;
      if(row.payload.storage_path)paths.add(row.payload.storage_path);
      if(row.payload.photo_storage_path)paths.add(row.payload.photo_storage_path);
    }
    const media=[];
    for(const path of paths){
      const blob=await c.downloadWoundImage(path);
      if(blob.size>12*1024*1024)throw new Error(`تصویر ${path} از حد مجاز بزرگ‌تر است.`);
      const dataUrl=await blobDataUrl(blob);
      const ext=path.split('.').pop().toLowerCase();
      const type=blob.type==='image/jpg'?'image/jpeg':(blob.type||({jpg:'image/jpeg',jpeg:'image/jpeg',png:'image/png',webp:'image/webp'}[ext]||''));
      if(!['image/jpeg','image/png','image/webp'].includes(type))throw new Error(`نوع فایل تصویر ${path} پشتیبانی نمی‌شود.`);
      media.push({path,type,data:dataUrl.slice(dataUrl.indexOf(',')+1)});
    }
    return {format:'WoundAI-Cloud-Snapshot-v1',clinic_id:clinicId,exported_at:new Date().toISOString(),
      records,media,record_count:records.length,media_count:media.length,consent_scope:'consented-clinical-records-only'};
  }
  function validateBackupPayload(payload,clinicId){
    if(!payload||payload.format!=='WoundAI-Cloud-Snapshot-v1'||payload.clinic_id!==clinicId||
      !Array.isArray(payload.records)||payload.records.length>100000||!Array.isArray(payload.media)||payload.media.length>50000)
      throw new Error('ساختار یا حجم محتوای پشتیبان معتبر نیست.');
    const allowed=new Set(['patient','wound','image','assessment','appointment']);
    const patients=new Set(payload.records.filter(r=>r.entity_type==='patient'&&!r.deleted_at&&r.payload?.consent===true).map(r=>String(r.local_id)));
    for(const row of payload.records){
      if(row.clinic_id!==clinicId||!allowed.has(row.entity_type)||typeof row.local_id!=='string'||row.local_id.length>200)
        throw new Error('رکوردی با شناسه یا مرکز نامعتبر در پشتیبان وجود دارد.');
      if(row.deleted_at)continue;
      if(!row.payload||typeof row.payload!=='object')throw new Error('محتوای یک رکورد در پشتیبان معتبر نیست.');
      if(row.entity_type==='patient'&&row.payload.consent!==true)throw new Error('پشتیبان شامل پرونده بیماری بدون رضایت ثبت‌شده است.');
      if(row.entity_type!=='patient'&&!patients.has(String(row.payload.patientId||'')))
        throw new Error('رکورد وابسته به بیمار فاقد رضایت در پشتیبان وجود دارد.');
    }
    const referenced=new Set();
    for(const row of payload.records){
      if(row.deleted_at||!row.payload)continue;
      if(row.payload.storage_path)referenced.add(row.payload.storage_path);
      if(row.payload.photo_storage_path)referenced.add(row.payload.photo_storage_path);
    }
    const seen=new Set();
    for(const media of payload.media){
      if(!media||typeof media.path!=='string'||!media.path.startsWith(`${clinicId}/`)||
        !referenced.has(media.path)||seen.has(media.path)||!['image/jpeg','image/png','image/webp'].includes(media.type)||
        typeof media.data!=='string'||!/^[A-Za-z0-9+/]*={0,2}$/.test(media.data))
        throw new Error('مسیر یا محتوای فایل تصویری در پشتیبان معتبر نیست.');
      seen.add(media.path);
    }
    for(const path of referenced)if(!seen.has(path))throw new Error('یکی از فایل‌های تصویری مرجع در پشتیبان وجود ندارد.');
    return true;
  }
  async function encryptPackage(payload,pass,backupId){
    const plain=encoder.encode(JSON.stringify(payload));
    const packed=await compress(plain);
    const salt=crypto.getRandomValues(new Uint8Array(16)),iv=crypto.getRandomValues(new Uint8Array(12));
    const key=await derive(pass,salt);
    const header={format:'WoundAI-Offsite-Encrypted-Backup-v1',version:1,backup_id:backupId,
      clinic_id:payload.clinic_id,created_at:new Date().toISOString(),kdf:'PBKDF2-SHA256',
      iterations:ITERATIONS,cipher:'AES-256-GCM',salt:b64(salt),iv:b64(iv),compressed:packed.compressed,
      records:payload.record_count,media:payload.media_count};
    const cipher=new Uint8Array(await crypto.subtle.encrypt({name:'AES-GCM',iv,additionalData:encoder.encode(JSON.stringify(header))},key,packed.bytes));
    const prefix=encoder.encode(`WAI308\n${JSON.stringify(header)}\n`);
    const blob=new Blob([prefix,cipher],{type:'application/vnd.woundai.backup'});
    if(blob.size>MAX_BYTES)throw new Error('حجم پشتیبان رمزنگاری‌شده از سقف ۵۰۰ مگابایت بیشتر است.');
    return {blob,header,sha256:await sha256(await blob.arrayBuffer())};
  }
  async function createBackup(){
    const c=client(),clinicId=clinic(),pass=$('offsiteBackupPass')?.value||'';
    if(c.getAal?.()!=='aal2')throw new Error('برای پشتیبان مستقل، MFA سطح AAL2 لازم است.');
    const role=(await c.listClinicMemberships()).find(x=>x.clinic_id===clinicId)?.role;
    if(!['owner','admin'].includes(role))throw new Error('فقط مالک یا مدیر مرکز می‌تواند پشتیبان مستقل بسازد.');
    const backupId=crypto.randomUUID();
    status('در حال دریافت رکوردهای ابری و فایل‌های تصویری...');
    const payload=await collectBackupPayload(clinicId);
    status(`رمزنگاری ${payload.record_count} رکورد و ${payload.media_count} فایل تصویری...`);
    const pack=await encryptPackage(payload,pass,backupId),bytes=pack.blob.size;
    status('در حال دریافت نشانی امن فضای ذخیره‌سازی خارجی...');
    const signed=await call('sign-put',{backup_id:backupId,bytes,sha256:pack.sha256});
    const uploaded=await fetch(signed.upload_url,{method:'PUT',headers:signed.upload_headers||{},body:pack.blob,mode:'cors'});
    if(!uploaded.ok)throw new Error(`بارگذاری در فضای خارجی ناموفق بود (HTTP ${uploaded.status}). تنظیمات CORS و دسترسی S3 را بررسی کنید.`);
    status('در حال تأیید فایل ذخیره‌شده در فضای خارجی...');
    const completed=await call('complete',{backup_id:backupId,bytes,sha256:pack.sha256});
    $('offsiteBackupPass').value='';
    status(`پشتیبان رمزنگاری و بارگذاری شد. حجم: ${(bytes/1024/1024).toFixed(2)} MB · شناسه: ${completed.backup_id}`);
    await refreshList();
    return completed;
  }
  async function refreshList(){
    const result=await call('list'),host=$('offsiteBackupList');if(!host)return result.backups||[];
    host.replaceChildren();
    const rows=result.backups||[];
    if(!rows.length){host.textContent='پشتیبان خارجی ثبت‌شده‌ای وجود ندارد.';return rows;}
    for(const row of rows){
      const item=document.createElement('div');item.className='offsite-backup-row';
      const info=document.createElement('span');info.textContent=`${new Date(row.created_at).toLocaleString()} · ${(row.bytes/1024/1024).toFixed(2)} MB · ${row.id}`;
      const button=document.createElement('button');button.type='button';button.className='secondary-btn';button.textContent='دانلود';
      button.addEventListener('click',()=>downloadBackup(row).catch(e=>status(e.message,true)));
      item.append(info,button);host.append(item);
    }
    return rows;
  }
  async function downloadBackup(row){
    const result=await call('sign-get',{backup_id:row.id});
    const response=await fetch(result.download_url);
    if(!response.ok)throw new Error(`دانلود پشتیبان ناموفق بود (HTTP ${response.status}).`);
    const blob=await response.blob();
    if(blob.size!==Number(row.bytes))throw new Error('اندازه فایل دانلودشده با فهرست پشتیبان تطابق ندارد.');
    const hash=await sha256(await blob.arrayBuffer());
    if(hash!==row.sha256)throw new Error('بررسی SHA-256 ناموفق بود؛ فایل را بازیابی نکنید.');
    const url=URL.createObjectURL(blob),a=document.createElement('a');
    a.href=url;a.download=`WoundAI-offsite-${row.id}.wbackup`;a.click();
    setTimeout(()=>URL.revokeObjectURL(url),30000);
    status('فایل پشتیبان دانلود و SHA-256 آن تأیید شد.');
  }
  async function decryptFile(file,pass){
    if(!file||file.size<20||file.size>MAX_BYTES)throw new Error('اندازه فایل پشتیبان معتبر نیست.');
    const bytes=new Uint8Array(await file.arrayBuffer());
    const first=bytes.indexOf(10),second=bytes.indexOf(10,first+1);
    if(first<0||second<0||decoder.decode(bytes.slice(0,first))!=='WAI308')throw new Error('قالب فایل WoundAI v30.8 معتبر نیست.');
    const header=JSON.parse(decoder.decode(bytes.slice(first+1,second)));
    if(header.format!=='WoundAI-Offsite-Encrypted-Backup-v1'||header.cipher!=='AES-256-GCM'||header.kdf!=='PBKDF2-SHA256'||header.iterations!==ITERATIONS)throw new Error('قالب رمزنگاری پشتیبان پشتیبانی نمی‌شود.');
    const key=await derive(pass,unb64(header.salt));
    let plain;
    try{plain=new Uint8Array(await crypto.subtle.decrypt({name:'AES-GCM',iv:unb64(header.iv),additionalData:encoder.encode(JSON.stringify(header))},key,bytes.slice(second+1)));}
    catch{throw new Error('عبارت عبور اشتباه است یا فایل آسیب دیده است.');}
    const unpacked=await decompress(plain,header.compressed);
    const payload=JSON.parse(decoder.decode(unpacked));
    validateBackupPayload(payload,header.clinic_id);
    return {header,payload};
  }
  async function restoreLocal(){
    const file=$('offsiteRestoreFile')?.files?.[0],pass=$('offsiteRestorePass')?.value||'';
    if(!file)throw new Error('فایل پشتیبان را انتخاب کنید.');
    const c=client(),clinicId=clinic();
    if(c.getAal?.()!=='aal2')throw new Error('برای بازیابی تصاویر و همگام‌سازی، MFA سطح AAL2 لازم است.');
    status('در حال رمزگشایی و اعتبارسنجی فایل...');
    const {header,payload}=await decryptFile(file,pass);
    if(header.clinic_id!==clinicId)throw new Error('این پشتیبان متعلق به مرکز دیگری است. برای جلوگیری از انتقال اشتباه، بازیابی بین مراکز مجاز نیست.');
    validateBackupPayload(payload,clinicId);
    const mediaMap=new Map(payload.media.map(x=>[x.path,x]));
    status('در حال بازگردانی فایل‌های تصویری به Storage خصوصی...');
    for(const media of payload.media){
      const blob=dataUrlBlob(`data:${media.type};base64,${media.data}`);
      await c.uploadWoundImage(media.path,blob,blob.type);
    }
    const next=structuredClone(window.WoundAIApp.getState());
    const prepared=window.WoundAIClinicalSync?.prepareBackupRecords?
      window.WoundAIClinicalSync.prepareBackupRecords(payload.records,next,clinicId):payload.records.map(row=>({...row,localId:row.local_id}));
    const collectionFor={patient:'patients',wound:'wounds',image:'images',assessment:'assessments',appointment:'appointments'};
    let added=0,existing=0,deleted=0;
    for(const row of prepared){
      if(row.deleted_at){deleted++;continue;}
      const key=collectionFor[row.entity_type];if(!key||!row.payload)continue;
      const record=structuredClone(row.payload);record.id=row.localId||row.local_id;
      if(record.photo_storage_path&&mediaMap.has(record.photo_storage_path)){
        const m=mediaMap.get(record.photo_storage_path);record.photo=`data:${m.type};base64,${m.data}`;
      }
      if(record.storage_path&&mediaMap.has(record.storage_path)){
        const m=mediaMap.get(record.storage_path);record.image=`data:${m.type};base64,${m.data}`;record.thumbnail=record.image;
      }
      const list=next[key],index=list.findIndex(x=>String(x.id)===String(record.id));
      if(index<0){list.push(record);added++;}
      else existing++;
    }
    window.WoundAIApp.applyRemoteState(next);
    if(window.WoundAIClinicalSync?.resetForRestore){
      await window.WoundAIClinicalSync.resetForRestore(clinicId);
      await window.WoundAIClinicalSync.capture(next);
      const tombstones=payload.records.filter(x=>!!x.deleted_at);
      await window.WoundAIClinicalSync.importRestoreTombstones(clinicId,tombstones,next);
      const syncState=await window.WoundAIClinicalSync.status();
      if(syncState.enabled)await window.WoundAIClinicalSync.syncNow();
    }
    $('offsiteRestorePass').value='';$('offsiteRestoreFile').value='';
    status(`بازیابی انجام شد: ${added} رکورد جدید، ${existing} رکورد موجود بدون بازنویسی، ${deleted} نشانگر حذف حفظ شد؛ ${payload.media.length} تصویر به Storage بازگردانده شد.`);
    return {added,existing,deleted,media:payload.media.length};
  }
  $('offsiteBackupCreate')?.addEventListener('click',async()=>{
    try{busy(true);await createBackup()}catch(e){status(`ساخت پشتیبان ناموفق: ${e.message}`,true)}finally{busy(false)}
  });
  $('offsiteBackupRefresh')?.addEventListener('click',async()=>{
    try{busy(true);await refreshList()}catch(e){status(e.message,true)}finally{busy(false)}
  });
  $('offsiteRestoreApply')?.addEventListener('click',async()=>{
    try{busy(true);await restoreLocal()}catch(e){status(`بازیابی ناموفق: ${e.message}`,true)}finally{busy(false)}
  });
  function busy(value){
    for(const id of ['offsiteBackupCreate','offsiteBackupRefresh','offsiteRestoreApply'])if($(id))$(id).disabled=value;
  }
  window.WoundAIOffsiteBackup={createBackup,refreshList,downloadBackup,restoreLocal,decryptFile,encryptPackage,collectBackupPayload,validateBackupPayload};
})();
