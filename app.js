const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)];
function dismissStartup(){
 const splash=$('#startupScreen'),shell=$('.app-shell');
 if(!splash)return;
 splash.classList.add('is-leaving');
 splash.setAttribute('aria-hidden','true');
 splash.addEventListener('transitionend',()=>splash.remove(),{once:true});
 setTimeout(()=>splash.remove(),500);
 if(shell){shell.removeAttribute('aria-hidden');shell.inert=false;}
}
$('#enterWoundAI')?.addEventListener('click',dismissStartup);
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&$('#startupScreen'))dismissStartup();});
const APP_VERSION='19.1';const DB='woundai_pro_local_v2';let state={patients:[],wounds:[],assessments:[],images:[],aiModel:null};let lang='fa',stream=null,currentImage=null,points=[],calibration=null,calibrationMode=false,calibrationPoints=[],cameraFacing='environment';
const tr={
fa:{dashboard:'داشبورد',patients:'بیماران',imaging:'تصویربرداری و اندازه‌گیری',reports:'گزارش‌ها',security:'امنیت و پشتیبان‌گیری',workspace:'فضای کاری کلینیک',localMode:'حالت ذخیره‌سازی محلی',clinicalWorkspace:'فضای کاری بالینی',safetyNotice:'نسخه آزمایشی و پژوهشی؛ خروجی‌ها جایگزین ارزیابی و تشخیص متخصص نیستند. از اطلاعات واقعی بیمار در این نسخه استفاده نکنید.',overview:'نمای کلی',welcome:'خوش آمدید به',dashboardDesc:'مدیریت پرونده‌ها، ارزیابی‌های بالینی و پایش روند زخم در یک فضای یکپارچه.',newPatient:'ثبت بیمار جدید',totalPatients:'کل بیماران',savedOnDevice:'ذخیره‌شده در این دستگاه',activeWounds:'زخم‌های فعال',acrossRecords:'در تمام پرونده‌ها',assessments:'ارزیابی‌ها',clinicalEntries:'ثبت‌های بالینی',followups:'پیگیری‌های ثبت‌شده',plannedFollowups:'برنامه‌های پیگیری',recentPatients:'بیماران اخیر',recentPatientsDesc:'آخرین پرونده‌های ثبت‌شده',viewAll:'مشاهده همه ←',noPatients:'هنوز بیماری ثبت نشده است',addFirstPatient:'برای شروع، اولین پرونده را ایجاد کنید.',quickActions:'دسترسی سریع',quickActionsDesc:'شروع یک فرایند جدید',registerPatient:'ثبت بیمار',createPatientRecord:'ایجاد پرونده و سوابق پایه',captureWound:'تصویربرداری زخم',cameraOrGallery:'دوربین یا انتخاب تصویر',exportData:'خروجی و پشتیبان',backupRecords:'دریافت نسخه پشتیبان اطلاعات',modules:'ماژول‌های تخصصی WoundAI',modulesDesc:'ساختار پرونده و ارزیابی مطابق مشخصات بالینی پروژه',patientManagement:'مدیریت بیمار و چند زخم',patientManagementDesc:'پرونده مستقل، سوابق، مراجعات و رضایت',clinicalForms:'فرم‌های ارزیابی تخصصی',imageAnalysis:'تصویربرداری و اندازه‌گیری',imageAnalysisDesc:'دوربین، کالیبراسیون و ترسیم مرز دستی',longitudinal:'پایش طولی و گزارش',longitudinalDesc:'تاریخچه ارزیابی و خروجی قابل نگهداری',records:'پرونده‌ها',patientDirectory:'فهرست بیماران',patientDirectoryDesc:'پرونده‌ها را جست‌وجو و مدیریت کنید.',allRecords:'همه پرونده‌ها',active:'فعال',archived:'بایگانی‌شده',imagingTitle:'تصویربرداری و اندازه‌گیری زخم',imagingDesc:'تصویر را ثبت کنید، مقیاس را کالیبره و مرز را دستی ترسیم کنید.',imageSource:'منبع تصویر',cameraSecure:'برای دوربین، سایت باید با HTTPS باز شده باشد.',openCamera:'باز کردن دوربین',chooseImage:'انتخاب از گالری',switchCamera:'تعویض دوربین',cameraPlaceholder:'پیش‌نمایش تصویر زخم',cameraHelp:'دوربین را باز کنید یا یک تصویر انتخاب کنید.',cameraIdle:'دوربین هنوز فعال نشده است.',stopCamera:'توقف دوربین',measurementTools:'ابزارهای اندازه‌گیری',manualOnly:'ترسیم دستی؛ تأیید نهایی با ارزیاب',calibrationLength:'طول مرجع (سانتی‌متر)',calibrationPixels:'طول همان خط روی تصویر (پیکسل)',calibrate:'ثبت کالیبراسیون',calibrationNeeded:'برای محاسبه سانتی‌متر مربع، کالیبراسیون معتبر لازم است.',undo:'بازگشت نقطه',clearDrawing:'پاک‌کردن ترسیم',manualArea:'مساحت ترسیم‌شده',drawHint:'برای ترسیم، روی تصویر چند نقطه بزنید.',saveImageAssessment:'ذخیره ارزیابی تصویر',depthWarning:'عمق زخم از عکس دوبعدی محاسبه نمی‌شود؛ آن را با روش بالینی جداگانه ثبت کنید.',aiStatusTitle:'وضعیت هوش مصنوعی',aiStatusBody:'مدل تشخیص و قطعه‌بندی بالینیِ اعتبارسنجی‌شده در این بسته نصب نشده است. این نسخه مرز زخم را به‌صورت خودکار تشخیص نمی‌دهد و نتیجه ساختگی تولید نمی‌کند. محل اتصال مدل AI و ثبت بازبینی متخصص در معماری پیش‌بینی شده است.',researchOnly:'پژوهشی / در انتظار مدل معتبر',reportsTitle:'گزارش و پشتیبان‌گیری',reportsDesc:'از اطلاعات محلی خروجی بگیرید و در صورت نیاز بازیابی کنید.',backupTitle:'دریافت نسخه پشتیبان',backupDesc:'پرونده‌ها، زخم‌ها، ارزیابی‌ها و تصاویر ذخیره‌شده در این مرورگر در یک فایل خروجی قرار می‌گیرند.',downloadBackup:'دانلود پشتیبان JSON',restoreTitle:'بازیابی نسخه پشتیبان',restoreDesc:'فایل پشتیبان قبلی را انتخاب کنید. داده‌ها به اطلاعات موجود اضافه می‌شوند.',summaryTitle:'خلاصه پرونده‌ها',summaryDesc:'خروجی خلاصه بیماران و زخم‌ها برای بررسی و بایگانی.',downloadCsv:'دانلود CSV بیماران',localStorageWarning:'محدودیت مهم ذخیره‌سازی',localStorageWarningBody:'این نسخه برای نمونه‌سازی، داده‌ها را فقط در حافظه مرورگر همین دستگاه نگه می‌دارد. ورود با شناسه، همگام‌سازی بین دستگاه‌ها، رمزنگاری سمت سرور، کنترل نقش واقعی و پشتیبان‌گیری خودکار سروری هنوز فعال نیست. برای اطلاعات واقعی بیمار، ابتدا باید بک‌اند امن، میزبانی مجاز، کنترل دسترسی و آزمون امنیتی راه‌اندازی شود.',securityTitle:'امنیت، حریم خصوصی و دسترسی',securityDesc:'وضعیت فعلی و الزامات نسخه عملیاتی',currentPrototype:'وضعیت این نمونه',localOnly:'ذخیره محلی روی همین مرورگر',manualBackup:'خروجی و بازیابی دستی',noCloudAuth:'ورود و احراز هویت ابری',noEncryption:'رمزنگاری و تفکیک مرکز در سرور',productionChecklist:'الزامات پیش از استفاده واقعی',secureAuth:'احراز هویت امن، MFA و بازیابی حساب',roleAccess:'نقش‌ها و مجوزهای دسترسی در سطح مرکز و پرونده',encryptedStorage:'پایگاه داده و فضای تصویر رمزنگاری‌شده',auditTrail:'ثبت رویدادهای مشاهده، ایجاد، ویرایش و حذف',gdprReview:'بازبینی GDPR / DPIA و الزامات MDR متناسب با بازار',backupRestore:'پشتیبان‌گیری خودکار و آزمون بازیابی',footerNote:'سامانه مستندسازی و پشتیبان تصمیم بالینی • نسخه نمونه‌سازی',patientProfile:'پرونده بیمار',fullName:'نام و نام خانوادگی',recordCode:'کد پرونده',birthDate:'تاریخ تولد',sex:'جنس',unknown:'نامشخص',female:'زن',male:'مرد',diabetes:'دیابت',vascularDisease:'بیماری عروقی / PAD',allergies:'آلرژی‌ها',medicalHistory:'سوابق پزشکی، داروها و توضیحات',consentText:'رضایت ثبت اطلاعات در نسخه آزمایشی (بدون اطلاعات هویتی واقعی)',cancel:'انصراف',savePatient:'ذخیره پرونده',yes:'بله',no:'خیر'},
en:{dashboard:'Dashboard',patients:'Patients',imaging:'Imaging & Measurement',reports:'Reports',security:'Security & Backup',workspace:'Clinic workspace',localMode:'Local storage mode',clinicalWorkspace:'CLINICAL WORKSPACE',safetyNotice:'Research prototype. Outputs do not replace professional assessment or diagnosis. Do not enter real patient data.',overview:'OVERVIEW',welcome:'Welcome to',dashboardDesc:'Manage records, clinical assessments and wound progress in one workspace.',newPatient:'New patient',totalPatients:'Total patients',savedOnDevice:'Saved on this device',activeWounds:'Active wounds',acrossRecords:'Across all records',assessments:'Assessments',clinicalEntries:'Clinical entries',followups:'Follow-ups',plannedFollowups:'Follow-up plans',recentPatients:'Recent patients',recentPatientsDesc:'Latest patient records',viewAll:'View all →',noPatients:'No patients registered yet',addFirstPatient:'Create the first record to get started.',quickActions:'Quick actions',quickActionsDesc:'Start a workflow',registerPatient:'Register patient',createPatientRecord:'Create a patient record and history',captureWound:'Wound imaging',cameraOrGallery:'Camera or image upload',exportData:'Export & backup',backupRecords:'Download a data backup',modules:'WoundAI clinical modules',modulesDesc:'Record and assessment structure based on the clinical specification',patientManagement:'Patient & multi-wound records',patientManagementDesc:'Separate records, history, encounters and consent',clinicalForms:'Specialized assessment forms',imageAnalysis:'Imaging & measurement',imageAnalysisDesc:'Camera, calibration and manual boundary tracing',longitudinal:'Longitudinal monitoring & reports',longitudinalDesc:'Assessment history and exportable reports',records:'RECORDS',patientDirectory:'Patient directory',patientDirectoryDesc:'Search and manage patient records.',allRecords:'All records',active:'Active',archived:'Archived',imagingTitle:'Wound imaging & measurement',imagingDesc:'Capture an image, calibrate scale and manually trace the boundary.',imageSource:'Image source',cameraSecure:'Camera access requires HTTPS.',openCamera:'Open camera',chooseImage:'Choose image',switchCamera:'Switch camera',cameraPlaceholder:'Wound image preview',cameraHelp:'Open the camera or choose an image.',cameraIdle:'Camera is not active.',stopCamera:'Stop camera',measurementTools:'Measurement tools',manualOnly:'Manual tracing; clinician confirmation required',calibrationLength:'Reference length (cm)',calibrationPixels:'Same line length in image (pixels)',calibrate:'Set calibration',calibrationNeeded:'Valid calibration is required to calculate cm².',undo:'Undo point',clearDrawing:'Clear drawing',manualArea:'Traced area',drawHint:'Tap several points on the image to trace.',saveImageAssessment:'Save image assessment',depthWarning:'Wound depth cannot be derived from a 2D photo; record it separately using a clinical method.',aiStatusTitle:'AI status',aiStatusBody:'No clinically validated detection or segmentation model is installed in this package. This version does not automatically detect wound boundaries or fabricate results. The architecture reserves an integration point for a validated model and clinician review.',researchOnly:'Research / awaiting validated model',reportsTitle:'Reports & backup',reportsDesc:'Export locally stored data and restore it when needed.',backupTitle:'Download backup',backupDesc:'Patients, wounds, assessments and locally stored images are bundled into one export file.',downloadBackup:'Download JSON backup',restoreTitle:'Restore backup',restoreDesc:'Select a previous backup file. Data will be added to existing records.',summaryTitle:'Record summary',summaryDesc:'Export a patient and wound summary for review and archiving.',downloadCsv:'Download patient CSV',localStorageWarning:'Important storage limitation',localStorageWarningBody:'This prototype stores data only in this browser on this device. Account login, cross-device sync, server-side encryption, real role controls and automatic server backups are not active. A secure backend, compliant hosting, access controls and security testing are required before real patient data can be used.',securityTitle:'Security, privacy & access',securityDesc:'Current status and production requirements',currentPrototype:'Prototype status',localOnly:'Local storage in this browser',manualBackup:'Manual export and restore',noCloudAuth:'Cloud login and authentication',noEncryption:'Server encryption and clinic isolation',productionChecklist:'Before real-world use',secureAuth:'Secure authentication, MFA and account recovery',roleAccess:'Role-based permissions at clinic and record level',encryptedStorage:'Encrypted database and image storage',auditTrail:'Audit events for viewing, creation, editing and deletion',gdprReview:'GDPR / DPIA and applicable medical-device review',backupRestore:'Automated backups and restore testing',footerNote:'Clinical documentation and decision-support system • Prototype',patientProfile:'PATIENT PROFILE',fullName:'Full name',recordCode:'Record code',birthDate:'Date of birth',sex:'Sex',unknown:'Unknown',female:'Female',male:'Male',diabetes:'Diabetes',vascularDisease:'Vascular disease / PAD',allergies:'Allergies',medicalHistory:'Medical history, medications and notes',consentText:'I agree to enter test data in this prototype (no real identifying information)',cancel:'Cancel',savePatient:'Save patient',yes:'Yes',no:'No'}};
function applyLang(){document.documentElement.lang=lang;document.documentElement.dir=lang==='fa'?'rtl':'ltr';$$('[data-i18n]').forEach(el=>{let k=el.dataset.i18n;if(tr[lang][k])el.textContent=tr[lang][k]});$('#langBtn').textContent=lang==='fa'?'EN':'FA';$('#pageTitle').textContent=tr[lang][currentPage]||tr[lang].dashboard;$('#patientSearch').placeholder=lang==='fa'?'جست‌وجو با نام یا کد پرونده…':'Search name or record code…';}
let currentPage='dashboard';function goto(page){currentPage=page;if(page==='ai')refreshAnnStatus();$$('.page').forEach(p=>p.classList.toggle('active',p.id==='page-'+page));$$('.nav-item').forEach(n=>n.classList.toggle('active',n.dataset.page===page));$('#pageTitle').textContent=tr[lang][page]||tr[lang].dashboard;$('#sidebar').classList.remove('open');if(page==='patients')renderPatients();}
function load(){
 try{
  const raw=localStorage.getItem(DB);
  const x=raw?JSON.parse(raw):{};
  const valid= x && typeof x==='object' && !Array.isArray(x);
  if(valid){
   state.patients=Array.isArray(x.patients)?x.patients:[];
   state.wounds=Array.isArray(x.wounds)?x.wounds:[];
   state.assessments=Array.isArray(x.assessments)?x.assessments:[];
   state.images=Array.isArray(x.images)?x.images:[];state.aiModel=x.aiModel||null;
  }
 }catch(e){console.error('WoundAI load error',e);showStorageError('اطلاعات ذخیره‌شده قابل خواندن نیست. پیش از پاک‌کردن داده‌ها، نسخه پشتیبان را بررسی کنید.');}
 renderStats();
}
function persist(){
 try{
  localStorage.setItem(DB,JSON.stringify(state));
  renderStats();
  return true;
 }catch(e){
  console.error('WoundAI save error',e);
  showStorageError(e?.name==='QuotaExceededError'?'فضای ذخیره‌سازی این مرورگر پر شده است. تصویرهای بزرگ را کاهش دهید و نسخه پشتیبان بگیرید.':'ذخیره‌سازی مرورگر در دسترس نیست. تنظیمات مرورگر را بررسی کنید.');
  return false;
 }
}
function showStorageError(message){
 const t=$('#toast');if(t){t.textContent=message;t.classList.add('show');setTimeout(()=>t.classList.remove('show'),6000);}
}
function id(){return crypto.randomUUID?crypto.randomUUID():'id-'+Date.now()+'-'+Math.random().toString(16).slice(2)}
function toast(msg){let t=$('#toast');t.textContent=msg;t.classList.add('show');setTimeout(()=>t.classList.remove('show'),2600)}
function renderStats(){$('#patientCount').textContent=state.patients.length;$('#statPatients').textContent=state.patients.length;$('#statWounds').textContent=state.wounds.filter(w=>w.status!=='closed').length;$('#statAssessments').textContent=state.assessments.length;$('#statFollowups').textContent=state.wounds.filter(w=>w.followup).length;let recent=state.patients.slice(-4).reverse();$('#recentPatients').className=recent.length?'recent-list':'recent-list empty-state';$('#recentPatients').innerHTML=recent.length?recent.map(p=>`<div class="recent-row"><span class="patient-initial">${esc((p.name||'W').slice(0,1))}</span><div><b>${esc(p.name)}</b><small>${esc(p.code)} · ${new Date(p.created).toLocaleDateString(lang==='fa'?'fa-IR':'en-US')}</small></div><button class="text-btn" data-open-patient="${p.id}">${lang==='fa'?'پرونده ←':'Open →'}</button></div>`).join(''):`<span class="empty-symbol">♙</span><b>${tr[lang].noPatients}</b><small>${tr[lang].addFirstPatient}</small>`;}
function esc(s){return String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function openModal(){pendingPatientPhoto='';$('#pPhoto').value='';showPatientPhoto('');$('#modalBackdrop').hidden=false;$('#pName').focus()}function closeModal(){$('#modalBackdrop').hidden=true;$('#patientForm').reset();pendingPatientPhoto='';showPatientPhoto('')}
let pendingPatientPhoto='';
function resizePatientPhoto(file){
 return new Promise((resolve,reject)=>{
  if(!file||!file.type.startsWith('image/'))return reject(new Error('not-image'));
  const reader=new FileReader();
  reader.onload=()=>{const im=new Image();im.onload=()=>{const max=720,scale=Math.min(1,max/Math.max(im.width,im.height)),c=document.createElement('canvas');c.width=Math.round(im.width*scale);c.height=Math.round(im.height*scale);c.getContext('2d').drawImage(im,0,0,c.width,c.height);resolve(c.toDataURL('image/jpeg',.78))};im.onerror=reject;im.src=reader.result};
  reader.onerror=reject;reader.readAsDataURL(file);
 });
}
function showPatientPhoto(src){const box=$('#patientPhotoPreview');if(!box)return;box.innerHTML=src?`<img src="${src}" alt="عکس بیمار">`:'<span>عکس بیمار</span>'}
$('#pPhoto')?.addEventListener('change',async e=>{const f=e.target.files?.[0];if(!f)return;try{pendingPatientPhoto=await resizePatientPhoto(f);showPatientPhoto(pendingPatientPhoto)}catch(err){toast('فایل تصویر قابل خواندن نیست.');pendingPatientPhoto='';e.target.value=''}});
$('#removePatientPhoto')?.addEventListener('click',()=>{pendingPatientPhoto='';$('#pPhoto').value='';showPatientPhoto('')});

$('#newPatientBtn').onclick=openModal;$('#addPatientBtn').onclick=openModal;$('#quickPatient').onclick=openModal;$('#closeModal').onclick=closeModal;$('#cancelPatient').onclick=closeModal;$('#modalBackdrop').addEventListener('click',e=>{if(e.target.id==='modalBackdrop')closeModal()});
// Legacy patient submit handler removed; the edit-aware handler below is the single source of truth.

function renderPatients(){let q=$('#patientSearch').value.toLowerCase(),f=$('#patientFilter').value;let arr=state.patients.filter(p=>(f==='all'||p.status===f)&&(`${p.name} ${p.code}`.toLowerCase().includes(q)));$('#patientList').innerHTML=arr.length?arr.map(p=>{let wounds=state.wounds.filter(w=>w.patientId===p.id);return `<article class="patient-card"><div class="patient-card-head"><span class="patient-initial patient-avatar">${p.photo?`<img src="${p.photo}" alt="عکس بیمار">`:esc(p.name.slice(0,1))}</span><span class="pill">${p.status==='active'?(lang==='fa'?'فعال':'ACTIVE'):(lang==='fa'?'بایگانی':'ARCHIVED')}</span></div><h3>${esc(p.name)}</h3><p>${lang==='fa'?'کد پرونده':'Record'}: ${esc(p.code)}</p><div class="patient-meta"><span>${wounds.length} ${lang==='fa'?'زخم':'wounds'}</span><span>${lang==='fa'?'ثبت':'Created'}: ${new Date(p.created).toLocaleDateString(lang==='fa'?'fa-IR':'en-US')}</span></div><div class="card-actions"><button class="secondary-btn" data-view-patient="${p.id}">مشاهده پرونده</button><button class="secondary-btn" data-edit-patient="${p.id}">ویرایش</button><button class="secondary-btn" data-add-wound="${p.id}">${lang==='fa'?'＋ افزودن زخم':'＋ Add wound'}</button><button class="secondary-btn" data-delete-patient="${p.id}" ${lang==='fa'?'':'hidden'}>حذف بیمار</button><button class="secondary-btn" data-archive="${p.id}">${p.status==='active'?(lang==='fa'?'بایگانی':'Archive'):(lang==='fa'?'فعال‌سازی':'Activate')}</button></div><div class="wound-list">${wounds.map(w=>`<div class="wound-row"><span>◉ ${esc(w.etiology)} · ${esc(w.site)}</span><button class="text-btn" data-assess="${w.id}">${lang==='fa'?'ارزیابی':'Assess'} ←</button></div>`).join('')}</div></article>`}).join(''):`<div class="panel empty-state"><b>${lang==='fa'?'پرونده‌ای یافت نشد':'No records found'}</b><small>${lang==='fa'?'جست‌وجو را تغییر دهید یا بیمار جدید ثبت کنید.':'Change your search or add a patient.'}</small></div>`;}
$('#patientSearch').oninput=renderPatients;$('#patientFilter').onchange=renderPatients;

// v20: interactive anatomical body map (front and back).
function selectWoundBodyRegion(region, source){
 const hidden=document.getElementById('wBodyRegion');
 const display=document.getElementById('selectedBodyRegion');
 const site=document.getElementById('wSite');
 if(hidden)hidden.value=region;
 if(display)display.textContent=region?'محل انتخاب‌شده: '+region:'هنوز ناحیه‌ای انتخاب نشده است.';
 if(site){site.value=region;site.dispatchEvent(new Event('input',{bubbles:true}));}
 document.querySelectorAll('#woundModalBackdrop [data-body-region]').forEach(el=>{
   const selected=el.dataset.bodyRegion===region;
   el.classList.toggle('selected',selected);
   if(el.tagName==='BUTTON')el.setAttribute('aria-pressed',selected?'true':'false');
   else el.classList.toggle('selected',selected);
 });
}
document.getElementById('woundModalBackdrop')?.addEventListener('click',e=>{
 const target=e.target.closest('[data-body-region]');
 if(!target)return;
 e.preventDefault();
 selectWoundBodyRegion(target.dataset.bodyRegion,target);
});
document.getElementById('woundModalBackdrop')?.addEventListener('keydown',e=>{
 const target=e.target.closest('[data-body-region]');
 if(target&&(e.key==='Enter'||e.key===' ')){
   e.preventDefault();selectWoundBodyRegion(target.dataset.bodyRegion,target);
 }
});

function addWound(patientId){let et=prompt(lang==='fa'?'نوع زخم (دیابتی، فشاری، وریدی، شریانی، جراحی، تروماتیک، سوختگی، مختلط یا نامشخص):':'Wound type (diabetic, pressure, venous, arterial, surgical, traumatic, burn, mixed, unknown):','diabetic');if(et===null)return;let site=prompt(lang==='fa'?'محل دقیق زخم و سمت بدن:':'Exact anatomical site and laterality:','');if(site===null)return;let w={id:id(),patientId,etiology:et,site,onset:'',status:'active',created:new Date().toISOString(),followup:''};state.wounds.push(w);persist();renderPatients();toast(lang==='fa'?'زخم به پرونده افزوده شد.':'Wound added to patient.');}
document.addEventListener('click',e=>{let a=e.target.closest('[data-page]');if(a)goto(a.dataset.page);let g=e.target.closest('[data-goto]');if(g)goto(g.dataset.goto);let o=e.target.closest('[data-open-patient]');if(o){let p=state.patients.find(x=>x.id===o.dataset.openPatient);toast(`${p.name} · ${p.code}`)}let aw=e.target.closest('[data-add-wound]');if(aw)addWound(aw.dataset.addWound);let ar=e.target.closest('[data-archive]');if(ar){let p=state.patients.find(x=>x.id===ar.dataset.archive);p.status=p.status==='active'?'archived':'active';persist();renderPatients()}let as=e.target.closest('[data-assess]');if(as){goto('imaging');toast(lang==='fa'?'زخم انتخاب شد؛ تصویر را ثبت و ارزیابی را ذخیره کنید.':'Wound selected. Capture an image and save assessment.')}});
$$('[data-goto]').forEach(b=>b.addEventListener('click',()=>goto(b.dataset.goto)));$('#menuBtn').onclick=()=>$('#sidebar').classList.toggle('open');$('#langBtn').onclick=()=>{lang=lang==='fa'?'en':'fa';applyLang();renderStats();if(currentPage==='patients')renderPatients()};
function stopCamera(){if(stream){stream.getTracks().forEach(t=>t.stop());stream=null}$('#cameraVideo').hidden=true;$('#stopCamera').disabled=true;$('#switchCamera').disabled=true;$('#capturePhoto').disabled=true}
async function startCamera(facing='environment'){if(!navigator.mediaDevices?.getUserMedia){toast(lang==='fa'?'دوربین در این مرورگر پشتیبانی نمی‌شود؛ از گالری استفاده کنید.':'Camera unsupported. Use image upload.');return}try{stopCamera();cameraFacing=facing;stream=await navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:facing},width:{ideal:1920},height:{ideal:1080}},audio:false});let v=$('#cameraVideo');v.srcObject=stream;v.hidden=false;$('#woundImage').hidden=true;$('#drawCanvas').hidden=true;$('#cameraStage .camera-placeholder').hidden=true;$('#stopCamera').disabled=false;$('#switchCamera').disabled=false;$('#cameraStatus').textContent=lang==='fa'?'دوربین فعال است. کادر، نور و مقیاس را بررسی و سپس «ثبت عکس» را بزنید.':'Camera active. Check framing, lighting and scale, then capture.';currentImage=null;$('#saveImageRecord').disabled=true;v.onloadedmetadata=()=>{if(v.videoWidth&&v.videoHeight)$('#cameraStage').style.aspectRatio=`${v.videoWidth} / ${v.videoHeight}`;$('#capturePhoto').disabled=!(v.videoWidth&&v.videoHeight)};}catch(err){let msg=err.name==='NotAllowedError'?'اجازه دوربین رد شده است. از تنظیمات مرورگر مجوز بدهید.':err.name==='NotFoundError'?'دوربین پیدا نشد؛ از گالری استفاده کنید.':'دوربین باز نشد؛ صفحه را با HTTPS باز و مجوزها را بررسی کنید.';$('#cameraStatus').textContent=lang==='fa'?msg:'Camera unavailable. Check HTTPS and browser permissions.';toast(msg)}}
function capturePhoto(){let v=$('#cameraVideo');if(!stream||!v.videoWidth){toast(lang==='fa'?'دوربین هنوز آماده نیست.':'Camera is not ready.');return}let c=document.createElement('canvas');c.width=v.videoWidth;c.height=v.videoHeight;c.getContext('2d').drawImage(v,0,0);loadImage(c.toDataURL('image/jpeg',.94));stopCamera()}
$('#startCamera').onclick=()=>startCamera('environment');$('#switchCamera').onclick=()=>startCamera(cameraFacing==='environment'?'user':'environment');$('#capturePhoto').onclick=capturePhoto;$('#stopCamera').onclick=stopCamera;


// Experimental, clinician-reviewed color-region segmentation. This is not a trained CNN.
let segmentationSeedMode=false,segmentationMaskCanvas=null,segmentationData=null;
function clearSegmentation(silent=false){
 segmentationSeedMode=false;segmentationMaskCanvas=null;segmentationData=null;
 const b=$('#clearSegmentation');if(b)b.disabled=true;
 const seed=$('#startSegmentationSeed');if(seed)seed.textContent='انتخاب نقطه داخل زخم';
 const status=$('#segmentationStatus');if(status)status.textContent='پیشنهاد مرزبندی پاک شد. می‌توانید دوباره نقطه انتخاب کنید.';
 if(typeof renderCanvas==='function'&&currentImage)renderCanvas();
 if(!silent)updateArea();
}
function segmentFromSeed(nativePoint){
 const img=$('#woundImage');if(!img?.naturalWidth||!img.naturalHeight)return;
 const maxSide=480,scale=Math.min(1,maxSide/Math.max(img.naturalWidth,img.naturalHeight));
 const w=Math.max(1,Math.round(img.naturalWidth*scale)),h=Math.max(1,Math.round(img.naturalHeight*scale));
 const src=document.createElement('canvas');src.width=w;src.height=h;
 const sctx=src.getContext('2d',{willReadFrequently:true});sctx.drawImage(img,0,0,w,h);
 const pixels=sctx.getImageData(0,0,w,h).data,n=w*h;
 const sx=Math.min(w-1,Math.max(0,Math.round(nativePoint.x/img.naturalWidth*w)));
 const sy=Math.min(h-1,Math.max(0,Math.round(nativePoint.y/img.naturalHeight*h)));
 const seed=(sy*w+sx)*4, sr=pixels[seed],sg=pixels[seed+1],sb=pixels[seed+2];
 const threshold=Number($('#segmentationThreshold')?.value||55),limit=threshold*threshold*3;
 const mask=new Uint8Array(n),queue=new Int32Array(n);let head=0,tail=0;
 const start=sy*w+sx;mask[start]=1;queue[tail++]=start;
 let minX=sx,maxX=sx,minY=sy,maxY=sy;
 // Four-connected flood fill constrained by seed-color similarity.
 while(head<tail){
  const idx=queue[head++],x=idx%w,y=(idx/w)|0;
  if(x<minX)minX=x;if(x>maxX)maxX=x;if(y<minY)minY=y;if(y>maxY)maxY=y;
  const neighbors=[];
  if(x>0)neighbors.push(idx-1);if(x<w-1)neighbors.push(idx+1);
  if(y>0)neighbors.push(idx-w);if(y<h-1)neighbors.push(idx+w);
  for(const ni of neighbors){
   if(mask[ni])continue;
   const p=ni*4,dr=pixels[p]-sr,dg=pixels[p+1]-sg,db=pixels[p+2]-sb;
   if(dr*dr+dg*dg+db*db<=limit){mask[ni]=1;queue[tail++]=ni}
  }
  if(tail>n*.38){throw new Error('ناحیه انتخاب‌شده بیش از حد بزرگ است؛ نقطه یا حساسیت را تغییر دهید.')}
 }
 const minPixels=Math.max(12,Math.floor(n*.0003));
 if(tail<minPixels)throw new Error('ناحیه قابل‌تشخیص کوچک است؛ نقطه دیگری داخل بستر زخم انتخاب کنید.');
 // Reject broad regions likely to represent skin/background rather than a bounded wound region.
 if((maxX-minX+1)*(maxY-minY+1)>n*.55)throw new Error('مرز ناحیه قابل اتکا نیست؛ حساسیت را کم یا نقطه دیگری انتخاب کنید.');
 const overlay=document.createElement('canvas');overlay.width=w;overlay.height=h;
 const octx=overlay.getContext('2d'),out=octx.createImageData(w,h);
 for(let i=0;i<n;i++)if(mask[i]){const p=i*4;out.data[p]=0;out.data[p+1]=190;out.data[p+2]=165;out.data[p+3]=105}
 octx.putImageData(out,0,0);
 segmentationMaskCanvas=overlay;
 segmentationData={pixelCount:tail,width:w,height:h,minX,maxX,minY,maxY,nativeWidth:img.naturalWidth,nativeHeight:img.naturalHeight,threshold,method:'seeded-rgb-region-growing-research'};
 $('#clearSegmentation').disabled=false;
 $('#segmentationStatus').textContent=calibration
  ? `ناحیه پیشنهادی ${tail.toLocaleString('fa-IR')} پیکسل در تصویر کم‌حجم‌شده جدا شد. مساحت تقریبی پس از کالیبراسیون نمایش داده می‌شود؛ مرز را بررسی و اصلاح کنید.`
  : `ناحیه پیشنهادی جدا شد (${tail.toLocaleString('fa-IR')} پیکسل). برای تبدیل به cm²، ابتدا مقیاس را کالیبره کنید.`;
 renderCanvas();updateArea();
}
function getSegmentationMetrics(){
 if(!segmentationData||!calibration)return null;
 const d=segmentationData,pxPerCm=calibration.px/calibration.cm;
 const nativePixelArea=(d.nativeWidth/d.width)*(d.nativeHeight/d.height);
 return {
  areaCm2:d.pixelCount*nativePixelArea/(pxPerCm*pxPerCm),
  lengthCm:(d.maxX-d.minX+1)*(d.nativeWidth/d.width)/pxPerCm,
  widthCm:(d.maxY-d.minY+1)*(d.nativeHeight/d.height)/pxPerCm,
  pxPerCm,method:'assisted-color-region-growing'
 };
}
$('#startSegmentationSeed')?.addEventListener('click',()=>{
 if(!currentImage){toast('ابتدا تصویر زخم را انتخاب کنید.');return}
 segmentationSeedMode=true;traceMode='add';
 $('#startSegmentationSeed').textContent='اکنون داخل بستر زخم لمس کنید';
 $('#segmentationStatus').textContent='یک نقطه نسبتاً یکنواخت درون بستر زخم انتخاب کنید؛ از پوست سالم و ترشح براق دوری کنید.';
});
$('#clearSegmentation')?.addEventListener('click',()=>clearSegmentation());
$('#segmentationThreshold')?.addEventListener('input',e=>{$('#segmentationThresholdValue').textContent=e.target.value;if(segmentationData)$('#segmentationStatus').textContent='حساسیت تغییر کرد؛ برای اعمال مقدار جدید، پیشنهاد قبلی را پاک و نقطه داخل زخم را دوباره انتخاب کنید.'});

function loadImage(src){stopCamera();let img=$('#woundImage');img.onload=()=>{currentImage=src;$('#cameraStage').style.aspectRatio=`${img.naturalWidth} / ${img.naturalHeight}`;img.hidden=false;$('#cameraVideo').hidden=true;$('#cameraStage .camera-placeholder').hidden=true;let c=$('#drawCanvas');c.width=img.naturalWidth;c.height=img.naturalHeight;c.hidden=false;points=[];traceClosed=false;traceMode='add';dragPointIndex=-1;clearSegmentation(true);calibration=null;calibrationMode=false;calibrationPoints=[];$('#selectScaleLine').disabled=false;renderCanvas();$('#cameraStatus').textContent=lang==='fa'?'تصویر بارگذاری شد. برای ترسیم مرز روی تصویر لمس کنید.':'Image loaded. Tap the image to trace the boundary.';$('#saveImageRecord').disabled=false;$('#clearPoints').disabled=false;$('#startSegmentationSeed').disabled=false;$('#startSegmentationSeed').disabled=false;$('#undoPoint').disabled=true;$('#calibrationStatus').textContent=tr[lang].calibrationNeeded};img.src=src}
$('#imageUpload').onchange=e=>{let f=e.target.files[0];if(!f)return;if(!f.type.startsWith('image/')){toast('Invalid image');return}let reader=new FileReader();reader.onload=()=>loadImage(reader.result);reader.readAsDataURL(f)};
function renderCanvas(){let c=$('#drawCanvas'),ctx=c.getContext('2d');ctx.clearRect(0,0,c.width,c.height);if(segmentationMaskCanvas){ctx.save();ctx.globalAlpha=1;ctx.drawImage(segmentationMaskCanvas,0,0,c.width,c.height);ctx.restore()}if(calibrationPoints.length){ctx.strokeStyle='#ffb020';ctx.fillStyle='#ffb020';ctx.lineWidth=Math.max(4,c.width/280);ctx.beginPath();calibrationPoints.forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));ctx.stroke();calibrationPoints.forEach(p=>{ctx.beginPath();ctx.arc(p.x,p.y,Math.max(7,c.width/150),0,Math.PI*2);ctx.fill()})}if(points.length){ctx.strokeStyle='#00bfae';ctx.fillStyle='#00bfae';ctx.lineWidth=Math.max(3,c.width/350);ctx.beginPath();points.forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));if(traceClosed&&points.length>2)ctx.closePath();ctx.stroke();points.forEach(p=>{ctx.beginPath();ctx.arc(p.x,p.y,Math.max(5,c.width/180),0,Math.PI*2);ctx.fill()})}
 if($('#measurementGridToggle')?.checked){
  const step=Number($('#measurementGridStep')?.value||50);
  ctx.save();ctx.strokeStyle='rgba(5,105,130,.35)';ctx.lineWidth=Math.max(1,c.width/1800);
  for(let x=step;x<c.width;x+=step){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,c.height);ctx.stroke()}
  for(let y=step;y<c.height;y+=step){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(c.width,y);ctx.stroke()}
  ctx.restore();
 }
 updateArea()}
let traceMode='add',traceClosed=false,dragPointIndex=-1;
function canvasPoint(e){let r=e.currentTarget.getBoundingClientRect();return{x:(e.clientX-r.left)/r.width*e.currentTarget.width,y:(e.clientY-r.top)/r.height*e.currentTarget.height}}
function nearestPoint(p){let best=-1,dist=Infinity;points.forEach((q,i)=>{let d=Math.hypot(q.x-p.x,q.y-p.y);if(d<dist){dist=d;best=i}});return dist<Math.max(18,$('#drawCanvas').width/35)?best:-1}
function updateTraceControls(){let closed=$('#finishTrace');if(closed)closed.disabled=points.length<3||traceClosed;$('#undoPoint').disabled=!points.length;$('#clearPoints').disabled=!points.length;$('#traceAddMode')?.classList.toggle('active',traceMode==='add');$('#traceEditMode')?.classList.toggle('active',traceMode==='edit');if($('#traceHelp'))$('#traceHelp').textContent=lang==='fa'?(traceMode==='edit'?tr.fa.traceEditHelp:(traceClosed?tr.fa.traceClosed:tr.fa.traceAddHelp)):(traceMode==='edit'?tr.en.traceEditHelp:(traceClosed?tr.en.traceClosed:tr.en.traceAddHelp))}
$('#drawCanvas').addEventListener('pointerdown',e=>{if(!currentImage)return;e.preventDefault();let p=canvasPoint(e);if(segmentationSeedMode){segmentationSeedMode=false;$('#startSegmentationSeed').textContent='انتخاب نقطه داخل زخم';try{segmentFromSeed(p)}catch(err){segmentationMaskCanvas=null;segmentationData=null;$('#segmentationStatus').textContent=err.message;toast(err.message)}return}if(calibrationMode){calibrationPoints.push(p);if(calibrationPoints.length===2){let dx=calibrationPoints[1].x-calibrationPoints[0].x,dy=calibrationPoints[1].y-calibrationPoints[0].y,px=Math.hypot(dx,dy);$('#referencePx').value=px.toFixed(1);calibrationMode=false;$('#calibrationStatus').textContent=lang==='fa'?`طول خط انتخاب‌شده: ${px.toFixed(1)} پیکسل؛ حالا طول واقعی را وارد و کالیبراسیون را ثبت کنید.`:`Selected line: ${px.toFixed(1)} px. Enter its real length and set calibration.`}renderCanvas();return}if(traceMode==='edit'){dragPointIndex=nearestPoint(p);if(dragPointIndex<0)toast(lang==='fa'?'نقطه‌ای نزدیک محل لمس پیدا نشد.':'No nearby vertex found.');else e.currentTarget.setPointerCapture(e.pointerId);return}points.push(p);traceClosed=false;renderCanvas();updateTraceControls()});
$('#drawCanvas').addEventListener('pointermove',e=>{if(dragPointIndex<0)return;e.preventDefault();points[dragPointIndex]=canvasPoint(e);renderCanvas()});
$('#drawCanvas').addEventListener('pointerup',()=>{if(dragPointIndex>=0){dragPointIndex=-1;updateTraceControls()}});
$('#drawCanvas').addEventListener('pointercancel',()=>{dragPointIndex=-1});
$('#traceAddMode')?.addEventListener('click',()=>{traceMode='add';updateTraceControls()});
$('#traceEditMode')?.addEventListener('click',()=>{traceMode='edit';updateTraceControls()});
$('#finishTrace')?.addEventListener('click',()=>{if(points.length<3){toast(lang==='fa'?tr.fa.traceNeedPoints:tr.en.traceNeedPoints);return}traceClosed=true;renderCanvas();updateTraceControls()});
$('#selectScaleLine').onclick=()=>{if(!currentImage){toast(lang==='fa'?'ابتدا تصویر را ثبت یا انتخاب کنید.':'Capture or choose an image first.');return}calibrationMode=true;calibrationPoints=[];renderCanvas();$('#calibrationStatus').textContent=lang==='fa'?'دو سر یک فاصله معلوم روی خط‌کش/کارت مقیاس را لمس کنید.':'Tap both ends of a known distance on the ruler/scale card.'};
$('#undoPoint').onclick=()=>{points.pop();traceClosed=false;renderCanvas();updateTraceControls()};$('#clearPoints').onclick=()=>{points=[];traceClosed=false;renderCanvas();updateTraceControls()};
function polygonArea(ps){let s=0;for(let i=0;i<ps.length;i++){let j=(i+1)%ps.length;s+=ps[i].x*ps[j].y-ps[j].x*ps[i].y}return Math.abs(s/2)}
function calculateTraceMetrics(){
 if(points.length<3||!calibration||!traceClosed)return getSegmentationMetrics();
 const xs=points.map(p=>p.x),ys=points.map(p=>p.y),pxPerCm=calibration.px/calibration.cm;
 const lengthPx=Math.max(...xs)-Math.min(...xs),widthPx=Math.max(...ys)-Math.min(...ys);
 return {lengthCm:lengthPx/pxPerCm,widthCm:widthPx/pxPerCm,areaCm2:polygonArea(points)/(pxPerCm*pxPerCm),pxPerCm};
}
function updateArea(){
 const m=calculateTraceMetrics();
 $('#areaResult').textContent=m?`${m.areaCm2.toFixed(2)} cm²`:'— cm²';
 $('#lengthResult').textContent=m?`${m.lengthCm.toFixed(2)} cm`:'— cm';
 $('#widthResult').textContent=m?`${m.widthCm.toFixed(2)} cm`:'— cm';
 const cmp=$('#measurementComparison');
 if(cmp){
  const wid=$('#imageWoundSelect')?.value;
  const prev=state.images.filter(x=>x.woundId===wid&&Number.isFinite(x.areaCm2)).sort((a,b)=>b.created.localeCompare(a.created))[0];
  if(m&&prev){
   const delta=((m.areaCm2-prev.areaCm2)/prev.areaCm2)*100;
   cmp.textContent=`نسبت به آخرین ارزیابی ثبت‌شده: ${delta<0?'کاهش':'افزایش'} ${Math.abs(delta).toFixed(1)}٪ مساحت (مقایسه با ${new Date(prev.created).toLocaleDateString('fa-IR')})`;
  }else cmp.textContent='برای مقایسه روند، پس از ذخیره این ارزیابی، در مراجعه بعدی دوباره اندازه‌گیری کنید.';
 }
 $('#polygonStatus').textContent=points.length<3?'حداقل سه نقطه برای محاسبه لازم است.':(!traceClosed?'ابتدا حاشیه زخم را ببندید.':(segmentationData?'مساحت از مرزبندی کمکی رنگی و کالیبراسیون محاسبه شده؛ بازبینی دستی الزامی است.':(calibration?'اندازه‌ها بر اساس کالیبراسیون و مرز دستی محاسبه شده‌اند.':'ترسیم ثبت شد؛ کالیبراسیون لازم است.')));
}
$('#measurementGridToggle')?.addEventListener('change',()=>{if(currentImage)renderCanvas()});
$('#measurementGridStep')?.addEventListener('change',()=>{if(currentImage)renderCanvas()});
$('#calibrateBtn').onclick=()=>{let cm=Number($('#referenceCm').value),px=Number($('#referencePx').value);if(!currentImage||!Number.isFinite(cm)||!Number.isFinite(px)||cm<=0||px<=0||px>Math.max($('#drawCanvas').width,$('#drawCanvas').height)*2){toast(lang==='fa'?'تصویر و مقادیر معتبر کالیبراسیون لازم است؛ طول واقعی و پیکسلی را بررسی کنید.':'Check the image and valid real/pixel calibration values.');return}calibration={cm,px,pxPerCm:px/cm};$('#calibrationStatus').textContent=lang==='fa'?`کالیبراسیون ثبت شد: ${(px/cm).toFixed(2)} پیکسل بر سانتی‌متر`:`Calibration set: ${(px/cm).toFixed(2)} px/cm`;updateArea()};
function populateImagePatientSelect(){
 const sel=$('#imagePatientSelect');if(!sel)return;
 const previous=sel.value;
 sel.innerHTML='<option value="">انتخاب بیمار...</option>'+state.patients.map(p=>`<option value="${esc(p.id)}">${esc(p.name)} — ${esc(p.code)}</option>`).join('');
 if(state.patients.some(p=>p.id===previous))sel.value=previous;
 populateImageWoundSelect();
}
function populateImageWoundSelect(){
 const patientId=$('#imagePatientSelect')?.value,sel=$('#imageWoundSelect');if(!sel)return;
 const list=state.wounds.filter(w=>w.patientId===patientId&&w.status!=='closed');
 sel.innerHTML='<option value="">انتخاب زخم...</option>'+list.map(w=>`<option value="${esc(w.id)}">${esc(w.site||'محل نامشخص')} — ${esc(w.etiology||'اتیولوژی نامشخص')}</option>`).join('');
 sel.disabled=!patientId||!list.length;
 renderImageHistory();
}
function renderImageHistory(){
 const box=$('#imageHistoryList');if(!box)return;
 const wid=$('#imageWoundSelect')?.value;
 const records=state.images.filter(x=>x.woundId===wid).sort((a,b)=>b.created.localeCompare(a.created));
 $('#imageHistoryCount').textContent=String(records.length);
 box.innerHTML=records.length?records.map(x=>`<article class="image-history-card"><img src="${x.thumbnail||x.image}" alt="تصویر ثبت‌شده زخم"><div><b>${new Date(x.created).toLocaleString(lang==='fa'?'fa-IR':'en-US')}</b><small>${esc(x.viewLabel||x.viewType||'تصویر')} · ${x.width||'—'}×${x.height||'—'} px</small><small>${esc(x.note||'بدون یادداشت')}</small></div></article>`).join(''):'<p class="muted">برای این زخم هنوز تصویری ثبت نشده است.</p>';
}
$('#imagePatientSelect')?.addEventListener('change',populateImageWoundSelect);
$('#imageWoundSelect')?.addEventListener('change',renderImageHistory);
function compressClinicalImage(src,maxSide=1600,quality=.82){
 return new Promise((resolve,reject)=>{const im=new Image();im.onload=()=>{const scale=Math.min(1,maxSide/Math.max(im.naturalWidth,im.naturalHeight));const c=document.createElement('canvas');c.width=Math.max(1,Math.round(im.naturalWidth*scale));c.height=Math.max(1,Math.round(im.naturalHeight*scale));c.getContext('2d',{alpha:false}).drawImage(im,0,0,c.width,c.height);resolve({data:c.toDataURL('image/jpeg',quality),width:im.naturalWidth,height:im.naturalHeight,storedWidth:c.width,storedHeight:c.height})};im.onerror=reject;im.src=src});
}
$('#saveImageRecord').onclick=async()=>{
 if(!currentImage){toast(lang==='fa'?'ابتدا تصویر ثبت کنید.':'Capture or upload an image first.');return}
 const patientId=$('#imagePatientSelect').value,woundId=$('#imageWoundSelect').value;
 if(!patientId||!woundId){toast('برای ثبت تصویر، بیمار و زخم مرتبط را انتخاب کنید.');return}
 const patient=state.patients.find(p=>p.id===patientId),wound=state.wounds.find(w=>w.id===woundId&&w.patientId===patientId);
 if(!patient||!wound){toast('ارتباط بیمار و زخم معتبر نیست.');return}
 const btn=$('#saveImageRecord');btn.disabled=true;
 try{
  const packed=await compressClinicalImage(currentImage);
  const created=new Date().toISOString(),viewType=$('#imageViewType').value;
  const labels={baseline:'تصویر پایه',followup:'تصویر پیگیری',detail:'نمای نزدیک',other:'سایر'};
  const record={id:id(),patientId,woundId,created,image:packed.data,thumbnail:packed.data,width:packed.width,height:packed.height,storedWidth:packed.storedWidth,storedHeight:packed.storedHeight,viewType,viewLabel:labels[viewType],note:$('#imageNote').value.trim(),points:points.map(p=>({x:p.x,y:p.y})),calibration:calibration?{...calibration}:null,areaCm2:calculateTraceMetrics()?.areaCm2??null,lengthCm:calculateTraceMetrics()?.lengthCm??null,widthCm:calculateTraceMetrics()?.widthCm??null,aiStatus:'not-installed',reviewStatus:'manual-draft',boundaryClosed:traceClosed,segmentation:segmentationData?{...segmentationData}:null,measurementMethod:segmentationData&&!traceClosed?'assisted-color-region-growing-research':'manual-polygon'};
  state.images.push(record);
  state.assessments.push({id:id(),patientId,woundId,imageId:record.id,created,kind:'image-measurement',data:{pointCount:points.length,calibrated:!!calibration,areaCm2:record.areaCm2,lengthCm:record.lengthCm,widthCm:record.widthCm,imageWidth:record.width,imageHeight:record.height}});
  if(!persist()){state.images.pop();state.assessments.pop();return}
  renderImageHistory();$('#imageNote').value='';toast('تصویر با تاریخ و ارتباط پرونده ذخیره شد.');
 }catch(err){console.error(err);toast('ذخیره تصویر ناموفق بود؛ حجم یا قالب عکس را بررسی کنید.')}
 finally{btn.disabled=false}
};


// ===== Stage 5: trainable, transparent ANN research module =====
const ANN_FEATURES=['area_cm2','depth_mm','pain_0_10','exudate_0_3','tissue_granulation_pct','tissue_slough_pct','infection_signs_0_5','days_since_onset'];
function parseCSV(text){
 const rows=[];let row=[],cell='',quoted=false;
 for(let i=0;i<text.length;i++){const c=text[i];if(c==='"'&&quoted&&text[i+1]==='"'){cell+='"';i++}else if(c==='"'){quoted=!quoted}else if(c===','&&!quoted){row.push(cell.trim());cell=''}else if((c==='\n'||c==='\r')&&!quoted){if(c==='\r'&&text[i+1]==='\n')i++;row.push(cell.trim());if(row.some(v=>v!==''))rows.push(row);row=[];cell=''}else cell+=c}
 row.push(cell.trim());if(row.some(v=>v!==''))rows.push(row);return rows;
}
function refreshAnnStatus(){
 const m=state.aiModel,el=$('#annTrainingStatus'),run=$('#runAnnBtn');
 if(!el)return;
 if(m?.trained){el.textContent=`مدل پژوهشی آموزش‌دیده است · ${m.samples} نمونه · ${m.epochs} دوره آموزش`;run.disabled=false}
 else{el.textContent='مدل هنوز آموزش ندیده است؛ فایل CSV برچسب‌خورده لازم است.';run.disabled=true}
}
function annForward(x,model){
 const z=x.map((v,i)=>(v-model.mean[i])/model.std[i]);
 const h=model.b1.map((b,j)=>Math.tanh(b+z.reduce((s,v,i)=>s+v*model.w1[i][j],0)));
 const o=model.b2.map((b,k)=>b+h.reduce((s,v,j)=>s+v*model.w2[j][k],0));
 const maxO=Math.max(...o),ex=o.map(v=>Math.exp(v-maxO)),sum=ex.reduce((a,b)=>a+b,0);return ex.map(v=>v/sum);
}
function trainANN(rows){
 const data=rows.map(r=>({x:ANN_FEATURES.map(k=>Number(r[k])),y:Number(r.label)}));
 if(data.length<20)throw Error('حداقل ۲۰ نمونه لازم است.');
 if(data.some(d=>d.x.some(v=>!Number.isFinite(v))||![0,1].includes(d.y)))throw Error('مقادیر ویژگی‌ها باید عددی و label فقط ۰ یا ۱ باشد.');
 const groups=[data.map((d,i)=>d.y===0?i:-1).filter(i=>i>=0),data.map((d,i)=>d.y===1?i:-1).filter(i=>i>=0)];
 if(groups.some(g=>g.length<2))throw Error('برای هر کلاس حداقل دو نمونه لازم است تا آموزش و آزمون هر دو شامل آن باشند.');
 const hash=i=>((i*9301+49297)%233280)/233280;
 const train=[],test=[];
 groups.forEach(g=>{
  const ordered=[...g].sort((a,b)=>hash(a)-hash(b));
  const cut=Math.min(ordered.length-1,Math.max(1,Math.floor(ordered.length*.8)));
  train.push(...ordered.slice(0,cut));test.push(...ordered.slice(cut));
 });
 const mean=ANN_FEATURES.map((_,i)=>train.reduce((s,idx)=>s+data[idx].x[i],0)/train.length);
 const std=ANN_FEATURES.map((_,i)=>Math.sqrt(train.reduce((s,idx)=>s+(data[idx].x[i]-mean[i])**2,0)/train.length)||1);
 const norm=data.map(d=>d.x.map((v,i)=>(v-mean[i])/std[i]));
 let seed=20261109;const rand=(a,b)=>{seed=(seed*9301+49297)%233280;return a+(b-a)*(seed/233280)};
 const H=10,w1=ANN_FEATURES.map(()=>Array.from({length:H},()=>rand(-.15,.15))),b1=Array(H).fill(0);
 const w2=Array.from({length:H},()=>[rand(-.15,.15),rand(-.15,.15)]),b2=[0,0];
 const lr=.025,epochs=350;
 for(let ep=0;ep<epochs;ep++){
  for(const idx of train){
   const x=norm[idx],y=data[idx].y;
   const h=b1.map((b,j)=>Math.tanh(b+x.reduce((s,v,i)=>s+v*w1[i][j],0)));
   const o=b2.map((b,k)=>b+h.reduce((s,v,j)=>s+v*w2[j][k],0));
   const maxO=Math.max(...o),ex=o.map(v=>Math.exp(v-maxO)),sm=ex.reduce((a,b)=>a+b,0),p=ex.map(v=>v/sm);
   const go=[p[0]-(y===0?1:0),p[1]-(y===1?1:0)],gh=Array(H).fill(0);
   for(let j=0;j<H;j++)for(let k=0;k<2;k++){gh[j]+=go[k]*w2[j][k];w2[j][k]-=lr*go[k]*h[j]}
   for(let k=0;k<2;k++)b2[k]-=lr*go[k];
   for(let j=0;j<H;j++){const dz=gh[j]*(1-h[j]*h[j]);b1[j]-=lr*dz;for(let i=0;i<x.length;i++)w1[i][j]-=lr*dz*x[i]}
  }
 }
 const model={trained:true,algorithm:'MLP-ANN',features:ANN_FEATURES,mean,std,w1,b1,w2,b2,samples:data.length,trainCount:train.length,testCount:test.length,epochs,trainedAt:new Date().toISOString(),labels:{0:'کلاس ۰',1:'کلاس ۱'},splitMethod:'stratified-80-20',normalizationFit:'training-set-only'};
 let correct=0,tp=0,tn=0,fp=0,fn=0;
 for(const idx of test){const p=annForward(data[idx].x,model),pred=p[1]>=p[0]?1:0,y=data[idx].y;if(pred===y)correct++;if(y===1&&pred===1)tp++;else if(y===0&&pred===0)tn++;else if(pred===1)fp++;else fn++}
 model.accuracy=test.length?correct/test.length:null;model.confusion={tp,tn,fp,fn};
 return model;
}
$('#downloadAnnTemplate')?.addEventListener('click',()=>{
 const header=[...ANN_FEATURES,'label'].join(',');
 const sample='10,4,3,1,60,20,1,14,0\n4,2,1,0,80,5,0,7,1\n';
 download('WoundAI_ANN_dataset_template.csv',header+'\n'+sample,'text/csv;charset=utf-8');
});
$('#trainAnnBtn')?.addEventListener('click',async()=>{
 const f=$('#annDataset').files[0];if(!f){toast('ابتدا فایل CSV را انتخاب کنید.');return}
 const btn=$('#trainAnnBtn');btn.disabled=true;
 try{
  const rows=parseCSV(await f.text());const headers=rows.shift().map(x=>x.toLowerCase());
  for(const k of [...ANN_FEATURES,'label'])if(!headers.includes(k))throw Error('ستون الزامی پیدا نشد: '+k);
  const objects=rows.map(r=>Object.fromEntries(headers.map((h,i)=>[h,r[i]??''])));
  const model=trainANN(objects),previousModel=state.aiModel;state.aiModel=model;
  if(!persist()){state.aiModel=previousModel;throw Error('ذخیره مدل در مرورگر ناموفق بود.')}
  $('#annMetrics').innerHTML=`<div><b>${model.samples}</b><small>نمونه</small></div><div><b>${model.trainCount}</b><small>نمونه آموزش</small></div><div><b>${model.testCount}</b><small>نمونه آزمون</small></div><div><b>${model.accuracy===null?'—':(model.accuracy*100).toFixed(1)+'٪'}</b><small>دقت روی بخش آزمون</small></div><div><b>${model.confusion.tp}/${model.confusion.tn}/${model.confusion.fp}/${model.confusion.fn}</b><small>TP/TN/FP/FN</small></div>`;
  $('#annTrainingStatus').textContent='آموزش انجام شد. مدل فقط پژوهشی است و نیازمند اعتبارسنجی مستقل است.';
  $('#runAnnBtn').disabled=false;toast('آموزش ANN انجام شد.');
 }catch(e){toast(e.message||'آموزش مدل ناموفق بود.')}
 finally{btn.disabled=false}
});
$('#fillAnnFromClinical')?.addEventListener('click',()=>{
 fillAnnFromClinical();
 goto('ai');
 toast('ویژگی‌های موجود از ارزیابی بالینی به فرم پژوهشی ANN منتقل شدند؛ مقادیر خالی را تکمیل کنید.');
});
$('#runAnnBtn')?.addEventListener('click',()=>{
 const m=state.aiModel;if(!m?.trained){toast('ابتدا مدل را آموزش دهید.');return}
 const ids=['annArea','annDepth','annPain','annExudate','annGranulation','annSlough','annInfection','annDays'];
 const x=ids.map(id=>Number($('#'+id).value));
 if(ids.some(id=>$('#'+id).value==='')||x.some(v=>!Number.isFinite(v)||v<0)){toast('تمام ویژگی‌ها را با مقادیر معتبر تکمیل کنید.');return}
 if(x[4]+x[5]>100){toast('مجموع درصد گرانولاسیون و اسلاف نباید بیش از ۱۰۰ باشد.');return}
 const p=annForward(x,m),klass=p[1]>=p[0]?1:0;
 $('#annPrediction').innerHTML=`<b>خروجی مدل پژوهشی: ${klass===1?'کلاس ۱':'کلاس ۰'}</b><p>احتمال محاسباتی کلاس ۰: ${(p[0]*100).toFixed(1)}٪</p><p>احتمال محاسباتی کلاس ۱: ${(p[1]*100).toFixed(1)}٪</p><small>این اعداد احتمال کالیبره‌شده بالینی نیستند و نباید برای تشخیص، انتخاب پانسمان یا تصمیم درمانی استفاده شوند. معنای کلاس‌ها تابع برچسب‌های دیتاست آموزشی است.</small>`;
 const wid=$('#assessmentWound')?.value||selectedWoundId;
 if(wid){
  const record={id:id(),woundId:wid,created:new Date().toISOString(),kind:'ann-research-prediction',data:{class:klass,probabilities:p,features:x,modelTrainedAt:m.trainedAt,disclaimer:'Research-only output; not a diagnosis or treatment recommendation.'}};
  state.assessments.push(record);
  if(!persist()){state.assessments.pop();toast('پیش‌بینی نمایش داده شد اما ذخیره آن ناموفق بود.');}
  else toast('خروجی پژوهشی ANN در تاریخچه زخم ذخیره شد.');
 }else toast('پیش‌بینی فقط نمایش داده شد؛ برای اتصال به پرونده، ابتدا زخم را در ارزیابی بالینی انتخاب کنید.');
});
refreshAnnStatus();
$('#exportBackup').onclick=()=>download(`WoundAI-backup-${new Date().toISOString().slice(0,10)}.json`,JSON.stringify({app:'WoundAI',version:APP_VERSION,exportedAt:new Date().toISOString(),...state},null,2),'application/json');
$('#importBackup').onchange=async e=>{let f=e.target.files[0];if(!f)return;try{let x=JSON.parse(await f.text());if(!Array.isArray(x.patients)||!Array.isArray(x.wounds))throw Error('invalid');for(let k of ['patients','wounds','assessments','images'])if(Array.isArray(x[k]))state[k]=[...state[k],...x[k]];persist();renderPatients();toast(lang==='fa'?'بازیابی انجام شد؛ موارد تکراری را بررسی کنید.':'Restore completed. Check for duplicates.')}catch(err){toast(lang==='fa'?'فایل پشتیبان معتبر نیست.':'Invalid backup file.')}e.target.value=''};
function download(name,content,type){let a=document.createElement('a'),u=URL.createObjectURL(new Blob([content],{type}));a.href=u;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(u),2000)}
$('#exportCsv').onclick=()=>{let rows=[['code','name','dob','sex','diabetes','vascular','created'],...state.patients.map(p=>[p.code,p.name,p.dob,p.sex,p.diabetes,p.vascular,p.created])];let csv='\ufeff'+rows.map(r=>r.map(v=>'"'+String(v??'').replaceAll('"','""')+'"').join(',')).join('\n');download('WoundAI-patients.csv',csv,'text/csv;charset=utf-8')};
$('#todayLabel').textContent=new Date().toLocaleDateString('fa-IR',{weekday:'short',year:'numeric',month:'short',day:'numeric'});load();applyLang();Object.assign(tr.fa,{photoGuideTitle:'راهنمای عکس استاندارد',photoGuide1:'نور یکنواخت؛ از سایه شدید و فلاش مستقیم پرهیز کنید.',photoGuide2:'دوربین را عمود بر پوست بگیرید و تمام لبه‌های زخم را داخل کادر قرار دهید.',photoGuide3:'خط‌کش یا کارت مقیاس را هم‌سطح پوست و کنار زخم قرار دهید.',photoGuide4:'برای مقایسه‌های بعدی، فاصله و زاویه دوربین را ثابت نگه دارید.',capturePhoto:'ثبت عکس',selectScaleLine:'تعیین خط مقیاس روی تصویر',scaleLineHelp:'دو سر یک فاصله معلوم روی خط‌کش را لمس کنید؛ سپس طول واقعی را به سانتی‌متر وارد کنید.'});
Object.assign(tr.en,{photoGuideTitle:'Standard photo guide',photoGuide1:'Use even lighting; avoid harsh shadows and direct flash.',photoGuide2:'Hold the camera perpendicular to the skin and keep the entire wound edge in frame.',photoGuide3:'Place a ruler or scale card beside the wound at skin level.',photoGuide4:'Keep camera distance and angle consistent for follow-up images.',capturePhoto:'Capture photo',selectScaleLine:'Select scale line on image',scaleLineHelp:'Tap both ends of a known ruler distance, then enter its real length in centimeters.'});
if('serviceWorker'in navigator)window.addEventListener('load',()=>navigator.serviceWorker.register('./sw.js').catch(()=>{}));
// Clinical assessment form: values are stored as clinician-entered observations, not AI diagnoses.
Object.assign(tr.fa,{clinical:'ارزیابی بالینی',clinicalTitle:'ارزیابی بالینی زخم',clinicalDesc:'اطلاعات مشاهده‌شده و گزارش‌شده را جداگانه ثبت کنید؛ طبقه‌بندی فقط با داده کافی انجام می‌شود.',patientWound:'بیمار / زخم',assessor:'نام ارزیاب',etiology:'اتیولوژی زخم',pain:'درد (۰ تا ۱۰)',temperature:'دما (°C)',heartRate:'ضربان قلب (در دقیقه)',length:'طول (cm)',width:'عرض (cm)',depth:'عمق (mm) — روش بالینی',depthMethod:'روش ثبت عمق',exudate:'مقدار ترشح',exudateType:'نوع ترشح',tissuePercent:'درصد اجزای بستر زخم (جمع حداکثر ۱۰۰٪)',localSigns:'نشانه‌های موضعی عفونت / التهاب',infectionSeverity:'شدت عفونت (ارزیابی بالینی)',npiapStage:'مرحله آسیب فشاری (در صورت کاربرد)',timeFramework:'چارچوب TIME / TIMERS — یادداشت ساختاریافته',clinicalNotes:'یادداشت ارزیاب / آزمایش‌ها / درمان‌های انجام‌شده',followupDate:'تاریخ پیگیری پیشنهادی',sinbadSite:'SINBAD — محل (Site)'});
Object.assign(tr.en,{clinical:'Clinical assessment',clinicalTitle:'Wound clinical assessment',clinicalDesc:'Record observed and patient-reported findings separately. Classifications require complete inputs.',patientWound:'Patient / wound',assessor:'Assessor name',etiology:'Wound etiology',pain:'Pain (0–10)',temperature:'Temperature (°C)',heartRate:'Heart rate (bpm)',length:'Length (cm)',width:'Width (cm)',depth:'Depth (mm) — clinical method',depthMethod:'Depth assessment method',exudate:'Exudate amount',exudateType:'Exudate type',tissuePercent:'Wound bed tissue percentages (total ≤100%)',localSigns:'Local infection / inflammation signs',infectionSeverity:'Infection severity (clinical assessment)',npiapStage:'Pressure injury stage (if applicable)',timeFramework:'TIME / TIMERS structured notes',clinicalNotes:'Assessor notes / labs / interventions',followupDate:'Suggested follow-up date',sinbadSite:'SINBAD — Site'});
let selectedWoundId=null;

// Stage 6 integration: pull the latest saved image measurement into the selected wound assessment.
function latestImageForWound(woundId){
 return state.images.filter(x=>x.woundId===woundId).sort((a,b)=>String(b.created).localeCompare(String(a.created)))[0]||null;
}
function syncMeasurementToClinical(woundId){
 const rec=latestImageForWound(woundId);
 if(!rec){const note=$('#measurementLinkStatus');if(note)note.textContent='برای این زخم هنوز تصویر اندازه‌گیری‌شده‌ای ثبت نشده است.';return false;}
 const setFromMeasurement=(id,value)=>{const el=$('#'+id);if(el&&value!==null&&value!==undefined&&Number.isFinite(Number(value)))el.value=String(value)};
 setFromMeasurement('aLength',rec.lengthCm);setFromMeasurement('aWidth',rec.widthCm);
 const depth=state.assessments.filter(a=>a.woundId===woundId&&a.kind==='clinical-assessment').sort((a,b)=>String(b.created).localeCompare(String(a.created)))[0]?.data?.depthMm;
 setFromMeasurement('aDepth',depth);
 const note=$('#measurementLinkStatus');
 if(note)note.textContent=`آخرین اندازه‌گیری تصویری: ${new Date(rec.created).toLocaleString('fa-IR')} · مساحت ${rec.areaCm2??'—'} cm² · طول ${rec.lengthCm??'—'} cm · عرض ${rec.widthCm??'—'} cm${rec.calibration?' · کالیبره‌شده':' · بدون کالیبراسیون'}`;
 return true;
}
function fillAnnFromClinical(){
 const map={annDepth:'aDepth',annPain:'aPain',annGranulation:'tGran',annSlough:'tSlough'};
 Object.entries(map).forEach(([to,from])=>{const src=$('#'+from),dst=$('#'+to);if(src&&dst&&src.value!=='')dst.value=src.value});
 const wid=$('#assessmentWound')?.value,latest=wid?latestImageForWound(wid):null;
 const areaField=$('#annArea');
 if(areaField&&latest?.areaCm2!==null&&latest?.areaCm2!==undefined)areaField.value=String(latest.areaCm2);
 const link=$('#annLinkStatus');if(link)link.textContent=latest?`اطلاعات زخم انتخاب‌شده منتقل شد؛ مساحت فقط در صورت اندازه‌گیری و کالیبراسیون معتبر استفاده می‌شود. شناسه تصویر: ${latest.id}`:'ویژگی‌های بالینی موجود منتقل شدند؛ برای مساحت واقعی، تصویر کالیبره‌شده لازم است.';
 const ex={'none':0,'low':1,'moderate':2,'high':3};
 const e=$('#aExudate'),exEl=$('#annExudate');
 const exMap={'none':0,'low':1,'moderate':2,'high':3};
 if(e&&exEl&&Object.prototype.hasOwnProperty.call(exMap,e.value))exEl.value=String(exMap[e.value]);
 const signs=['sRed','sWarm','sSwelling','sPain','sPus','sOdor'].filter(id=>$('#'+id)?.checked).length;
 if($('#annInfection'))$('#annInfection').value=String(Math.min(5,signs));
 const w=state.wounds.find(x=>x.id===wid);
 const days=w?.onset?Math.max(0,Math.floor((Date.now()-new Date(w.onset).getTime())/86400000)):0;
 if($('#annDays'))$('#annDays').value=String(days);
}
function currentAnnPredictionForWound(woundId){
 return state.assessments.filter(a=>a.woundId===woundId&&a.kind==='ann-research-prediction').sort((a,b)=>String(b.created).localeCompare(String(a.created)))[0]||null;
}
function refreshAssessmentWounds(){let sel=$('#assessmentWound');if(!sel)return;let opts=state.wounds.map(w=>{let p=state.patients.find(x=>x.id===w.patientId);return `<option value="${w.id}">${esc(p?.name||'')} — ${esc(w.etiology)} — ${esc(w.site)}</option>`}).join('');sel.innerHTML=opts||`<option value="">${lang==='fa'?'ابتدا بیمار و زخم ثبت کنید':'Register a patient and wound first'}</option>`;if(selectedWoundId&&state.wounds.some(w=>w.id===selectedWoundId))sel.value=selectedWoundId;else selectedWoundId=sel.value||null;}

// ===== Stage 7: structured care plan, clinician review and audit trail =====
let stage7Current=null;
function stage7PopulatePatients(){
 const psel=$('#stage7Patient'),wsel=$('#stage7Wound');if(!psel||!wsel)return;
 const prev=psel.value;
 psel.innerHTML='<option value="">انتخاب بیمار</option>'+state.patients.filter(p=>p.status!=='archived').map(p=>`<option value="${esc(p.id)}">${esc(p.name)} — ${esc(p.code||'')}</option>`).join('');
 if(state.patients.some(p=>p.id===prev))psel.value=prev;
 stage7PopulateWounds();
}
function stage7PopulateWounds(){
 const pid=$('#stage7Patient')?.value,wsel=$('#stage7Wound');if(!wsel)return;
 const list=state.wounds.filter(w=>w.patientId===pid);
 wsel.innerHTML='<option value="">انتخاب زخم</option>'+list.map(w=>`<option value="${esc(w.id)}">${esc(w.site||'محل نامشخص')} — ${esc(w.etiology||'اتیولوژی نامشخص')}</option>`).join('');
 wsel.disabled=!pid||!list.length;
 stage7Current=null;
 $('#stage7Output').innerHTML='<div class="panel stage7-empty">برای مشاهده برنامه، یک زخم انتخاب کنید و «تولید برنامه» را بزنید.</div>';
 $('#stage7SourceStatus').textContent=list.length?'زخم را انتخاب کنید.':'برای این بیمار هنوز زخمی ثبت نشده است.';
 stage7RenderHistory();
}
function stage7LatestAssessment(wid){
 return state.assessments.filter(a=>a.woundId===wid&&a.kind==='clinical-assessment').sort((a,b)=>String(b.created).localeCompare(String(a.created)))[0]||null;
}
function stage7RenderHistory(){
 const box=$('#stage7History');if(!box)return;
 const wid=$('#stage7Wound')?.value;
 const records=state.assessments.filter(a=>a.woundId===wid&&a.kind==='care-plan-stage7').sort((a,b)=>String(b.created).localeCompare(String(a.created)));
 box.innerHTML=records.length?records.map(r=>`<article class="stage7-history-item"><div><b>${esc(r.data?.status==='approved'?'تأییدشده توسط متخصص':'پیش‌نویس')}</b><small>${new Date(r.created).toLocaleString('fa-IR')} · ${esc(r.data?.clinician||'بدون نام تأییدکننده')}</small></div><span>${esc(r.data?.urgency||'')}</span></article>`).join(''):'<p class="muted">برای این زخم هنوز برنامه مراقبتی ذخیره نشده است.</p>';
}
function stage7Generate(){
 const wid=$('#stage7Wound')?.value;if(!wid){toast('ابتدا بیمار و زخم را انتخاب کنید.');return}
 const wound=state.wounds.find(w=>w.id===wid),patient=state.patients.find(p=>p.id===wound?.patientId);
 const assessment=stage7LatestAssessment(wid);
 if(!assessment){stage7Current=null;$('#stage7Output').innerHTML='<div class="panel stage7-empty">برای این زخم هنوز ارزیابی بالینی ذخیره‌شده وجود ندارد. ابتدا ارزیابی بالینی را تکمیل و ذخیره کنید.</div>';$('#stage7SourceStatus').textContent='ارزیابی بالینی ذخیره‌شده پیدا نشد.';return}
 const d=assessment.data||{},draft=d.carePlanDraft||{};
 const items=Array.isArray(draft.items)?draft.items:[];
 const domains=Array.isArray(draft.clinicalDomains)?draft.clinicalDomains:[];
 if(!items.length&&!domains.length){$('#stage7Output').innerHTML='<div class="panel stage7-empty">ارزیابی ذخیره شده، اما پیش‌نویس برنامه مراقبتی یا محورهای تخصصی در آن وجود ندارد. ارزیابی بالینی را دوباره تولید و ذخیره کنید.</div>';$('#stage7SourceStatus').textContent='داده کافی برای ساخت برنامه وجود ندارد.';stage7Current=null;return}
 const image=d.imageMeasurement||null,ann=d.annResearch||null;
 const patientSummary=[
  ['بیمار',patient?.name||'نامشخص'],['شناسه پرونده',patient?.code||'—'],
  ['محل زخم',wound?.site||'—'],['اتیولوژی',d.etiology||wound?.etiology||'—'],
  ['درد',d.pain!==''&&d.pain!==undefined?d.pain+'/10':'ثبت نشده'],
  ['ابعاد زخم',image?`مساحت ${image.areaCm2??'—'} cm² · طول ${image.lengthCm??'—'} cm · عرض ${image.widthCm??'—'} cm`:'اندازه‌گیری تصویری متصل نیست'],
  ['پرفیوژن',d.vascular?`ABI: ${d.vascular.abi||'ثبت نشده'} · TBI: ${d.vascular.tbi||'ثبت نشده'} · نبض: ${d.vascular.pedalPulse||'ثبت نشده'}`:'داده عروقی ثبت نشده'],['نوروپاتی / کاهش فشار',`${d.neuropathy||'ثبت نشده'} · ${d.offloading||'کاهش فشار ثبت نشده'}`],['ANN',ann?'خروجی پژوهشی موجود است؛ به‌تنهایی مبنای تصمیم درمانی نیست.':'پیش‌بینی ANN برای این ارزیابی ثبت نشده']
 ];
 const summaryHtml=patientSummary.map(([k,v])=>`<div class="stage7-summary-cell"><small>${esc(k)}</small><b>${esc(v)}</b></div>`).join('');
 const domainsHtml=domains.map(x=>`<article class="clinical-domain"><b>${esc(x.title||'محور تخصصی')}</b><p>${esc(x.summary||'')}</p></article>`).join('');
 const safeItems=items.map(x=>String(x));
 const guidelineRefs=Array.isArray(draft.guidelineRefs)?draft.guidelineRefs:[
  {label:'IWII — Wound infection in clinical practice, 4th edition (2026)',url:'https://woundsinternational.com/consensus-documents/wound-infection-in-clinical-practice-principles-of-best-practice-fourth-edition/'},
  {label:'IWGDF/IDSA — Diabetes-related foot infection guideline (2023)',url:'https://www.idsociety.org/practice-guideline/diabetic-foot-infections/'},
  {label:'IWGDF — Offloading guideline (2023)',url:'https://iwgdfguidelines.org/offloading-guideline-2023/'},
  {label:'NPIAP/EPUAP/PPPIA — International Pressure Injury Guideline, 4th edition (2026)',url:'https://www.internationalguideline.com/the-international-guideline'},
  {label:'NICE NG152 — Leg ulcer infection: antimicrobial prescribing',url:'https://www.nice.org.uk/guidance/ng152/chapter/recommendations'}
 ];
 stage7Current={patientId:wound.patientId,woundId:wid,assessmentId:assessment.id,assessmentCreated:assessment.created,urgency:draft.urgency||'نیازمند بازبینی متخصص',items:safeItems,domains,patientSummary,gradeSummary:draft.gradeSummary||'',riskFlags:draft.riskFlags||[],dressingConsiderations:draft.dressingConsiderations||'',guidelineRefs,generatedAt:new Date().toISOString()};
 $('#stage7Output').innerHTML=`<section class="panel"><div class="stage7-plan-head"><div><small>خلاصه وضعیت بر اساس آخرین ارزیابی ذخیره‌شده</small><h3>${esc(patient?.name||'بیمار')} — ${esc(wound?.site||'زخم')}</h3></div><span class="stage7-urgency">${esc(stage7Current.urgency)}</span></div><div class="stage7-summary-grid">${summaryHtml}</div></section><section class="panel"><h3>اولویت‌ها و هشدارها</h3><ol class="stage7-list">${(stage7Current.riskFlags.length?stage7Current.riskFlags:['هشدار مشخصی در پیش‌نویس ثبت نشده؛ نبود هشدار ثبت‌شده به معنی نبود خطر نیست.']).map(x=>`<li>${esc(x)}</li>`).join('')}</ol></section><section class="panel"><h3>ارزیابی هفت‌محوری</h3><div class="clinical-seven-grid">${domainsHtml||'<p>محورهای تخصصی در ارزیابی منبع ثبت نشده‌اند.</p>'}</div></section><section class="panel"><h3>پیشنهاد اقدامات مراقبتی</h3><ol class="stage7-list">${safeItems.map(x=>`<li>${esc(x)}</li>`).join('')}</ol><p class="micro-note">این موارد پیش‌نویس پشتیبان تصمیم هستند؛ انتخاب و اجرای اقدام به بررسی و تأیید درمانگر وابسته است.</p></section><section class="panel stage7-guidelines"><h3>مبنای علمی پیشنهادها</h3><p class="micro-note">منابع زیر با توجه به نوع زخم و موضوعات ارزیابی‌شده به‌عنوان مراجع راهنما معرفی می‌شوند؛ هر پیشنهاد باید با نسخه کامل راهنما، شرایط بیمار و پروتکل محل درمان تطبیق داده شود.</p><ul>${guidelineRefs.map(r=>`<li><a href="${esc(r.url)}" target="_blank" rel="noopener noreferrer">${esc(r.label)}</a></li>`).join('')}</ul></section>`;
 $('#stage7SourceStatus').textContent=`منبع: ارزیابی ${new Date(assessment.created).toLocaleString('fa-IR')} · ${items.length} اقدام پیشنهادی · ${domains.length} محور تخصصی`;
 $('#stage7Edits').value='';$('#stage7Approval').checked=false;stage7RenderHistory();
}
function stage7Save(status){
 if(!stage7Current){toast('ابتدا برنامه را از آخرین ارزیابی تولید کنید.');return}
 const clinician=$('#stage7Clinician').value.trim(),credential=$('#stage7Credential').value.trim(),edits=$('#stage7Edits').value.trim();
 if(status==='approved'&&(!clinician||!$('#stage7Approval').checked)){toast('برای تأیید نهایی، نام متخصص و پذیرش مسئولیت تأیید الزامی است.');return}
 const record={id:id(),patientId:stage7Current.patientId,woundId:stage7Current.woundId,created:new Date().toISOString(),kind:'care-plan-stage7',data:{...stage7Current,status,clinician,credential,clinicianEdits:edits,reviewedAt:status==='approved'?new Date().toISOString():null,disclaimer:'Clinical decision support draft; not a diagnosis or prescription. Clinician review required.'}};
 state.assessments.push(record);
 if(!persist()){state.assessments.pop();return}
 $('#stage7SaveStatus').textContent=status==='approved'?'برنامه با نام متخصص و وضعیت تأییدشده در پرونده ثبت شد.':'پیش‌نویس برنامه در پرونده ذخیره شد.';
 toast(status==='approved'?'تأیید متخصص ثبت شد.':'پیش‌نویس ذخیره شد.');
 stage7RenderHistory();
}
$('#stage7Patient')?.addEventListener('change',stage7PopulateWounds);
$('#stage7Wound')?.addEventListener('change',()=>{stage7Current=null;stage7RenderHistory();$('#stage7SourceStatus').textContent='برای تولید برنامه، دکمه تولید را بزنید.'});
$('#stage7Generate')?.addEventListener('click',stage7Generate);
$('#stage7SaveDraft')?.addEventListener('click',()=>stage7Save('draft'));
$('#stage7Approve')?.addEventListener('click',()=>stage7Save('approved'));

const oldGoto=goto;goto=function(page){oldGoto(page);if(page==='careplan'){stage7PopulatePatients()}if(page==='reports'){fillReportPatients()}if(page==='security'){stage9Identity()}if(page==='finaltest'){$('#pwaInstallStatus').textContent=('serviceWorker' in navigator)?'Service Worker API در دسترس است.':'Service Worker در این مرورگر پشتیبانی نمی‌شود.'}if(page==='clinical'){refreshAssessmentWounds();syncMeasurementToClinical($('#assessmentWound')?.value)}if(page==='ai'){refreshAssessmentWounds();fillAnnFromClinical()}};
$('#assessmentWound')?.addEventListener('change',e=>{selectedWoundId=e.target.value;syncMeasurementToClinical(selectedWoundId);fillAnnFromClinical()});
function sinbadCalc(){let ids=['sinSite','sinIsch','sinNeuro','sinInfect','sinArea','sinDepth'];let vals=ids.map(x=>$( '#'+x).value);let box=$('#sinbadResult');if(vals.some(v=>v==='')){box.textContent=lang==='fa'?'SINBAD: قابل محاسبه نیست — همه ۶ مؤلفه باید تکمیل شوند.':'SINBAD: Not calculable — all 6 components are required.';return null}let score=vals.reduce((a,v)=>a+Number(v),0);box.textContent=lang==='fa'?`SINBAD پیشنهادی بر اساس ورودی ارزیاب: ${score} از ۶ · مؤلفه‌ها: ${vals.join(' / ')} · نیازمند بازبینی متخصص`:`Clinician-entered SINBAD total: ${score}/6 · components: ${vals.join(' / ')} · clinician review required`;return {score,components:vals.map(Number),version:'SINBAD fields per project specification; verify against current licensed source'};}
['sinSite','sinIsch','sinNeuro','sinInfect','sinArea','sinDepth'].forEach(x=>$('#'+x)?.addEventListener('change',sinbadCalc));
['tGran','tSlough','tNecrosis','tEpi'].forEach(x=>$('#'+x)?.addEventListener('input',()=>{let n=['tGran','tSlough','tNecrosis','tEpi'].reduce((a,k)=>a+(Number($('#'+k).value)||0),0);$('#tissueTotal').textContent=(lang==='fa'?`مجموع: ${n}٪`:`Total: ${n}%`)+(n>100?(lang==='fa'?' — بیشتر از ۱۰۰٪؛ اصلاح کنید':' — over 100%; please correct'):'')}));
$('#saveClinical')?.addEventListener('click',()=>{let wid=$('#assessmentWound').value;if(!wid){toast(lang==='fa'?'ابتدا برای بیمار یک زخم ثبت کنید.':'Register a wound first.');return}let tissue=['tGran','tSlough','tNecrosis','tEpi'].map(k=>Number($('#'+k).value)||0),total=tissue.reduce((a,b)=>a+b,0);if(total>100){toast(lang==='fa'?'مجموع درصد بافت نباید بیشتر از ۱۰۰ باشد.':'Tissue percentages must not exceed 100%.');return}let sinbad=sinbadCalc();let computedScores=computeClinicalScores();buildCarePlan();const latestImage=latestImageForWound(wid);const annRecord=currentAnnPredictionForWound(wid);let data={computedScores,imageMeasurement:latestImage?{imageId:latestImage.id,patientId:latestImage.patientId,woundId:latestImage.woundId,created:latestImage.created,areaCm2:latestImage.areaCm2,lengthCm:latestImage.lengthCm,widthCm:latestImage.widthCm,calibrated:!!latestImage.calibration,calibration:latestImage.calibration||null}:null,annResearch:annRecord?{...annRecord.data,predictionId:annRecord.id,predictedAt:annRecord.created}:null,clinicalDomains:latestCarePlanDraft?.clinicalDomains||[],carePlanDraft:latestCarePlanDraft?{...latestCarePlanDraft,reviewed:!!$('#planReviewed')?.checked,clinicianEdits:$('#planEdits')?.value||''}:null,assessor:$('#assessorName').value,etiology:$('#aEtiology').value,pain:$('#aPain').value,temperature:$('#aTemp').value,heartRate:$('#aHR').value,bloodPressure:$('#aBP')?.value||'',respiratoryRate:$('#aRR')?.value||'',spo2:$('#aSpO2')?.value||'',probeToBone:$('#aPTB')?.value||'',labs:$('#aLabs')?.value||'',culture:$('#aCulture')?.value||'',interventions:$('#aTreatment')?.value||'',lengthCm:$('#aLength').value,widthCm:$('#aWidth').value,depthMm:$('#aDepth').value,depthMethod:$('#aDepthMethod').value,exudate:$('#aExudate').value,exudateType:$('#aExudateType').value,tissue:{granulation:tissue[0],slough:tissue[1],necrosis:tissue[2],epithelial:tissue[3]},localSigns:{redness:$('#sRed').checked,warmth:$('#sWarm').checked,swelling:$('#sSwelling').checked,newPain:$('#sPain').checked,pus:$('#sPus').checked,odor:$('#sOdor').checked},infectionSeverity:$('#aInfection').value,npiapStage:$('#aNpiap').value,wagner:$('#aWagner').value,vascular:{abi:$('#aABI')?.value||'',tbi:$('#aTBI')?.value||'',pedalPulse:$('#aPedalPulse')?.value||''},neuropathy:$('#aNeuropathy')?.value||'',plantarSite:$('#aPlantar')?.value||'',offloading:$('#aOffloading')?.value||'',pressureRisk:$('#aPressureRisk')?.value||'',mobility:$('#aMobility')?.value||'',nutrition:$('#aNutrition')?.value||'',universityOfTexas:{grade:$('#aUTGrade').value,stage:$('#aUTStage').value},wifi:{wound:$('#wWound').value,ischemia:$('#wIschemia').value,infection:$('#wInfection').value,stage:'not-calculated'},time:{tissue:$('#timeT').value,infection:$('#timeI').value,moisture:$('#timeM').value,edge:$('#timeE').value},notes:$('#aNotes').value,followup:$('#aFollowup').value,sinbad,push:{area:$('#pushArea')?.value||'',exudate:$('#pushExudate')?.value||'',tissue:$('#pushTissue')?.value||''},bwat:Object.fromEntries(Array.from({length:13},(_,i)=>['item'+(i+1),$('#bwat'+(i+1))?.value||'']))};const selectedWound=state.wounds.find(x=>x.id===wid);const savedAssessment={id:id(),patientId:selectedWound?.patientId||null,woundId:wid,created:new Date().toISOString(),kind:'clinical-assessment',data};state.assessments.push(savedAssessment);let w=state.wounds.find(x=>x.id===wid);const previousFollowup=w?.followup;if(w&&data.followup)w.followup=data.followup;if(!persist()){state.assessments.pop();if(w)w.followup=previousFollowup;return}toast(lang==='fa'?'ارزیابی بالینی و هفت محور تخصصی ذخیره شد.':'Clinical assessment and seven domains saved.');});
const oldAddWound=addWound;addWound=function(patientId){oldAddWound(patientId);refreshAssessmentWounds()};
const oldRenderPatients=renderPatients;renderPatients=function(){oldRenderPatients();refreshAssessmentWounds()};
const oldApplyLang=applyLang;applyLang=function(){oldApplyLang();if($('#assessmentWound'))refreshAssessmentWounds()};
// Removed legacy image reassignment handler: saved image ownership must never be changed implicitly.
// Additional etiology-specific classification inputs are recorded independently; composite WIfI stage is intentionally not inferred here.
// Structured wound registration dialog (replaces browser prompt workflow).
function addWound(patientId){$('#wPatientId').value=patientId;$('#woundModalBackdrop').hidden=false;selectWoundBodyRegion('','');$('#wSite').value='';$('#wSite').focus()}
function closeWoundModal(){$('#woundModalBackdrop').hidden=true;$('#woundForm').reset();selectWoundBodyRegion('','')}
$('#closeWoundModal').onclick=closeWoundModal;$('#cancelWound').onclick=closeWoundModal;$('#woundModalBackdrop').addEventListener('click',e=>{if(e.target.id==='woundModalBackdrop')closeWoundModal()});
$('#woundForm').onsubmit=e=>{e.preventDefault();let patientId=$('#wPatientId').value,site=$('#wSite').value.trim();if(!patientId||!site)return;const patient=state.patients.find(p=>p.id===patientId);if(!patient){toast('بیمار مرتبط با این زخم پیدا نشد.');return}const wound={id:id(),patientId,etiology:$('#wEtiology').value,site:site+' ('+$('#wSide').value+')',side:$('#wSide').value,onset:$('#wOnset').value,notes:$('#wNotes').value,status:'active',created:new Date().toISOString(),followup:''};state.wounds.push(wound);if(!persist()){state.wounds.pop();return}closeWoundModal();renderPatients();refreshAssessmentWounds();populateImagePatientSelect();toast(lang==='fa'?'زخم جدید ذخیره شد.':'New wound saved.')};
const optionEn={'دیابتی':'Diabetic foot','فشاری':'Pressure injury','وریدی':'Venous','شریانی':'Arterial','جراحی':'Surgical','تروماتیک':'Traumatic','سوختگی':'Burn','مختلط':'Mixed','نامشخص':'Unknown','بدون':'None','کم':'Low','متوسط':'Moderate','زیاد':'High','سروزی':'Serous','خونی':'Bloody','چرکی':'Purulent','مختلط':'Mixed','کاربرد ندارد / نامشخص':'N/A / Unknown','غیرعفونی':'Uninfected','خفیف':'Mild','شدید':'Severe','انتخاب نشده':'Not selected','Forefoot':'Forefoot','Midfoot / hindfoot':'Midfoot / hindfoot','نامشخص / کاربرد ندارد':'Unknown / N/A','راست':'Right','چپ':'Left','دوطرفه':'Bilateral','A — بدون عفونت/ایسکمی':'A — no infection/ischemia','B — عفونت':'B — infection','C — ایسکمی':'C — ischemia','D — عفونت و ایسکمی':'D — infection and ischemia','پای دیابتی':'Diabetic foot'};
const langApplyBase=applyLang;applyLang=function(){langApplyBase();$$('select option').forEach(o=>{if(!o.dataset.fa)o.dataset.fa=o.textContent;o.textContent=lang==='fa'?o.dataset.fa:(optionEn[o.dataset.fa]||o.dataset.fa)});};

Object.assign(tr.fa,{traceAddMode:'＋ افزودن نقاط',traceEditMode:'✥ اصلاح نقاط',finishTrace:'✓ بستن حاشیه',traceHelp:'برای تعیین حاشیه، روی لبه زخم نقطه بگذارید. برای اصلاح، «اصلاح نقاط» را انتخاب و نقطه را جابه‌جا کنید؛ سپس «بستن حاشیه» را بزنید.',traceClosed:'حاشیه بسته شد؛ نقاط را در صورت نیاز اصلاح کنید.',traceNeedPoints:'برای بستن حاشیه حداقل سه نقطه لازم است.',traceEditHelp:'یک نقطه را لمس کنید و بکشید تا جابه‌جا شود.',traceAddHelp:'روی لبه زخم نقاطی با فاصله مناسب قرار دهید؛ از نقاط کمتر و دقیق‌تر استفاده کنید.'});
Object.assign(tr.en,{traceAddMode:'＋ Add points',traceEditMode:'✥ Edit points',finishTrace:'✓ Close boundary',traceHelp:'Tap along the wound edge to add points. Choose Edit points to drag a point, then close the boundary.',traceClosed:'Boundary closed. You can still edit its points.',traceNeedPoints:'At least three points are required to close the boundary.',traceEditHelp:'Touch and drag a vertex to move it.',traceAddHelp:'Place accurate points along the wound edge; fewer well-placed points are easier to edit.'});


// v6: transparent calculations for complete, entered data only.
function selectedText(id){const el=$('#'+id);return el&&el.selectedIndex>=0?el.options[el.selectedIndex].text:''}
function computeClinicalScores(){
 const out=$('#computedScores'); if(!out)return;
 const rows=[];
 const vals=['sinSite','sinIsch','sinNeuro','sinInfect','sinArea','sinDepth'].map(k=>$('#'+k)?.value??'');
 if(vals.every(v=>v!=='')){const n=vals.reduce((a,v)=>a+Number(v),0);rows.push(['SINBAD',`${n}/6`,'مجموع ۶ مؤلفه واردشده؛ شدت/پیش‌آگهی را به‌تنهایی تفسیر نکنید.']);}
 else rows.push(['SINBAD','ناقص','برای محاسبه، هر ۶ مؤلفه باید تکمیل شود.']);
 const pushA=$('#pushArea')?.value??'', pushE=$('#pushExudate')?.selectedIndex??0, pushT=$('#pushTissue')?.selectedIndex??0;
 if(pushA!=='' && $('#pushExudate').value!=='' && $('#pushTissue').value!==''){
   // PUSH 3.0 component scores: area 0-10, exudate 0-3, tissue 0-4.
   const eMap={'بدون':0,'None':0,'کم':1,'Low':1,'متوسط':2,'Moderate':2,'زیاد':3,'High':3};
   const tMap={'بسته':0,'اپی‌تلیال':1,'گرانوله':2,'اسلاف':3,'نکروتیک':4,'Closed':0,'Epithelial':1,'Granulating':2,'Slough':3,'Necrotic':4};
   const exText=selectedText('pushExudate'), tiText=selectedText('pushTissue');
   const e=Object.keys(eMap).find(k=>exText.includes(k)); const t=Object.keys(tMap).find(k=>tiText.includes(k));
   if(e!==undefined&&t!==undefined) rows.push(['PUSH 3.0',`${Number(pushA)+eMap[e]+tMap[t]}/17`,'امتیاز کمتر در پیگیری‌های متوالی معمولاً با بهبود سازگار است؛ تفسیر با روند و معاینه انجام شود.']);
   else rows.push(['PUSH 3.0','ناقص','مقدار ترشح و نوع بافت را تکمیل کنید.']);
 } else rows.push(['PUSH 3.0','ناقص','مساحت، ترشح و بافت را تکمیل کنید.']);
 const bw=Array.from({length:13},(_,i)=>$('#bwat'+(i+1))?.value??'');
 if(bw.every(v=>v!=='')){const n=bw.reduce((a,v)=>a+Number(v),0);rows.push(['BWAT',`${n}/65`,'مجموع ۱۳ آیتم ثبت‌شده؛ هر آیتم ۱ تا ۵. روند سریالی مهم است.']);}
 else rows.push(['BWAT','ناقص',`${bw.filter(Boolean).length}/13 آیتم تکمیل شده؛ برای مجموع همه ۱۳ آیتم لازم است.`]);
 const w=[$('#wWound')?.value,$('#wIschemia')?.value,$('#wInfection')?.value];
 rows.push(['WIfI',w.every(v=>v!=='')?`W${w[0]} · I${w[1]} · fI${w[2]}`:'ناقص', 'اجزای زخم، ایسکمی و عفونت ثبت شده‌اند؛ مرحله بالینی WIfI از این سه عدد به‌تنهایی استنتاج نمی‌شود و به جدول رسمی و داده‌های پرفیوژن نیاز دارد.']);
 const wg=$('#aWagner')?.value; rows.push(['Wagner',wg!==''?`Grade ${wg}`:'ثبت نشده','گرید باید توسط ارزیاب و بر اساس عمق و ساختارهای درگیر انتخاب شود؛ برنامه آن را خودکار تشخیص نمی‌دهد.']);
 const utg=$('#aUTGrade')?.value, uts=$('#aUTStage')?.value; rows.push(['University of Texas',utg!==''&&uts!==''?`Grade ${utg} · Stage ${uts}`:'ناقص','درجه و مرحله بر اساس ارزیابی بالینی انتخاب می‌شوند؛ این ترکیب به‌تنهایی تشخیص خودکار نیست.']);
 const np=$('#aNpiap')?.value; rows.push(['NPIAP',np&&np!=='na'?np:'ثبت نشده','مرحله‌بندی فقط برای آسیب فشاری و بر اساس تعریف رسمی NPIAP توسط فرد آموزش‌دیده انجام شود.']);
 out.innerHTML=rows.map(([a,b,c])=>`<article class="score-row"><b>${a}</b><strong>${b}</strong><small>${c}</small></article>`).join('');
 return rows;
}
let latestCarePlanDraft=null;
function buildCarePlan(){
 const get=id=>$('#'+id)?.value??'', checked=id=>!!$('#'+id)?.checked;
 const temp=Number(get('aTemp')), hr=Number(get('aHR')), pain=Number(get('aPain'));
 const infection=get('aInfection'), signs=['sRed','sWarm','sSwelling','sPain','sPus','sOdor'].filter(checked).length;
 const tissue=[Number(get('tGran'))||0,Number(get('tSlough'))||0,Number(get('tNecrosis'))||0,Number(get('tEpi'))||0];
 const plan=[];
 let urgency='روال ارزیابی'; let urgent=false;
 if(infection==='severe'||(temp>=39&&temp<50)||hr>=120||(checked('sPus')&&signs>=3)||(get('aBP').trim().split('/').length===2&&Number(get('aBP').trim().split('/')[0])>0&&Number(get('aBP').trim().split('/')[0])<90)||(get('aRR')!==''&&Number(get('aRR'))>=30)||(get('aSpO2')!==''&&Number(get('aSpO2'))<90)||(get('aTemp')!==''&&temp<35.5)){
   urgency='نیازمند ارزیابی فوری حضوری'; urgent=true;
   plan.push('ارزیابی فوری توسط پزشک/تیم زخم؛ در صورت بدحالی عمومی، تب، گیجی، افت فشار یا گسترش سریع قرمزی، مراجعه اورژانسی لازم است.');
 } else if(infection==='moderate'||signs>=2){urgency='ارزیابی زودهنگام توسط درمانگر';plan.push('بازبینی زودهنگام علائم عفونت/التهاب، گسترش اریتم، گرمی، تورم، درد و ترشح؛ شدت عفونت فقط با معاینه و معیارهای بالینی تعیین شود.');}
 else plan.push('ادامه پایش منظم و ثبت عینی وضعیت زخم در هر مراجعه؛ نبود علائم ثبت‌شده، عفونت را به‌طور قطعی رد نمی‌کند.');
 plan.push('ارزیابی علت زمینه‌ای و عوامل مؤثر بر ترمیم متناسب با اتیولوژی: خون‌رسانی، کنترل بیماری‌های همراه، تغذیه، فشار/اصطکاک و وضعیت پوست اطراف.');
 if(get('aEtiology')==='diabetic') plan.push('برای زخم پای دیابتی: ارزیابی عروقی و نوروپاتی، کفش/کاهش فشار (offloading) و ارزیابی عفونت/استئومیلیت توسط تیم تخصصی را مستند کنید.');
 if(get('aEtiology')==='pressure') plan.push('برای آسیب فشاری: ارزیابی مرحله توسط فرد آموزش‌دیده، برنامه تغییر وضعیت و کاهش فشار متناسب با وضعیت بیمار و سطح حمایتی را تنظیم و ثبت کنید.');
 if(get('aEtiology')==='venous') plan.push('برای زخم وریدی: وضعیت عروقی و ABI/فشار انگشت پا پیش از تصمیم درباره فشرده‌سازی بررسی شود؛ فشرده‌سازی بدون ارزیابی شریانی توصیه نمی‌شود.');
 if(get('aEtiology')==='arterial'||(get('wIschemia')!==''&&Number(get('wIschemia'))>=2)) plan.push('احتمال اختلال خون‌رسانی: ارزیابی عروقی سریع و بررسی شاخص‌های پرفیوژن توسط تیم مربوط؛ از توصیه فشرده‌سازی یا دبریدمان بدون تصمیم متخصص خودداری شود.');
 // Guideline-informed branches. These are prompts for clinician review, not autonomous orders.
 const abi=get('aABI')!==''?Number(get('aABI')):null,tbi=get('aTBI')!==''?Number(get('aTBI')):null;
 const pulses=get('aPedalPulse'),neuropathy=get('aNeuropathy'),plantar=get('aPlantar'),offloading=get('aOffloading');
 if(get('aEtiology')==='diabetic'){
  if(plantar==='plantar-forefoot'||plantar==='plantar-midfoot'){
   if(neuropathy==='impaired'&&offloading!=='non-removable-knee'){
    plan.push('راهنمای IWGDF 2023: در زخم نوروپاتیک کف‌پایی جلوی پا/میانه پا، وسیله کاهش فشار غیرقابل‌برداشت تا زیر زانو گزینه اول راهنماست؛ مناسب‌بودن، تحمل بیمار، خطر سقوط، ایسکمی/عفونت و امکان پایش را متخصص ارزیابی کند. اگر منع یا عدم تحمل وجود دارد، گزینه قابل‌برداشت و پایبندی بیمار بررسی شود.');
   }else{
    plan.push('زخم پای دیابتی کف‌پایی ثبت شده است: کفایت کاهش فشار و پایبندی بیمار در تمام فعالیت‌های تحمل وزن بررسی و در هر مراجعه مستند شود؛ انتخاب وسیله باید با محل زخم، عفونت، ایسکمی، تعادل و توانایی بیمار تطبیق داده شود.');
   }
  }else{
   plan.push('برای زخم پای دیابتی غیرکف‌پایی/محل نامشخص، وسیله کاهش فشار باید متناسب با محل زخم و ارزیابی تخصصی انتخاب شود؛ توصیه وسیله غیرقابل‌برداشت زیر زانو را نمی‌توان به همه زخم‌های پا تعمیم داد.');
  }
  if(pulses==='absent'||pulses==='reduced'||(abi!==null&&abi<0.9)||(tbi!==null&&tbi<0.7)||Number(get('wIschemia'))>=2){
   plan.push('یافته‌های ثبت‌شده احتمال بیماری شریانی محیطی/کاهش پرفیوژن را مطرح می‌کند؛ ارزیابی عروقی و تفسیر ABI/TBI با توجه به محدودیت ABI در دیابت و احتمال کلسیفیکاسیون عروق لازم است. تصمیم درباره کاهش فشار، فشرده‌سازی و دبریدمان به تیم تخصصی واگذار شود.');
  }else if(abi===null&&tbi===null&&pulses===''){
   plan.push('برای زخم پای دیابتی، وضعیت پرفیوژن هنوز ثبت نشده است؛ نبض‌های پا و آزمون عروقی مناسب (ABI و در صورت نیاز فشار انگشت/TBI یا داپلر) باید طبق پروتکل محلی ارزیابی شود.');
  }
 }
 if(get('aEtiology')==='venous'){
  if(abi===null&&tbi===null){
   plan.push('زخم وریدی: پیش از تصمیم درباره فشرده‌سازی، ارزیابی شریانی (ABI و در صورت نامعتبر/نامتناسب بودن، فشار انگشت/TBI یا داپلر) ثبت نشده است؛ تا روشن‌شدن وضعیت شریانی، سامانه فشرده‌سازی را توصیه نمی‌کند.');
  }else if((abi!==null&&abi<0.8)||(tbi!==null&&tbi<0.5)||pulses==='absent'){
   plan.push('زخم وریدی همراه با شاخص/یافته مشکوک به اختلال شریانی: از توصیه خودکار فشرده‌سازی پرهیز و ارزیابی عروقی/متخصص زخم درخواست شود؛ تفسیر آستانه‌ها با پروتکل محلی و وضعیت بالینی انجام شود.');
  }else{
   plan.push('زخم وریدی: در صورت تأیید کفایت خون‌رسانی و نبود منع، درمان فشاری می‌تواند توسط فرد آموزش‌دیده و مطابق پروتکل محلی بررسی شود؛ وضعیت قلبی، تحمل بیمار و پایش پوست/درد نیز لحاظ شود.');
  }
 }
 if(get('aEtiology')==='pressure'){
  if(get('aPressureRisk')==='high'||get('aMobility')==='bedbound'||get('aMobility')==='chairbound'||get('aMobility')==='limited'){
   plan.push('راهنمای بین‌المللی NPIAP/EPUAP/PPPIA ویرایش چهارم ۲۰۲6: خطر فشاری و وضعیت پوست را به‌صورت فردمحور بازبینی کنید؛ برنامه تغییر وضعیت/تحرک، سطح حمایتی مناسب، محافظت پوست، تغذیه و کاهش فشار پاشنه/نقاط اتکا را با توجه به تحمل و اهداف بیمار تنظیم و مستند کنید.');
  }else{
   plan.push('آسیب فشاری: ارزیابی خطر، پوست و بافت، تحرک، سطح حمایتی و نیاز به تغییر وضعیت متناسب با بیمار در هر مراجعه بازبینی شود؛ برنامه ثابت و یکسان برای همه بیماران اعمال نشود.');
  }
 }
 if(abi!==null&&abi>1.3){
  plan.push('ABI بالاتر از ۱٫۳ ثبت شده است؛ عروق غیرقابل‌فشردن/کلسیفیه ممکن است عدد را گمراه‌کننده کند. از تفسیر ABI به‌تنهایی خودداری و آزمون تکمیلی مانند فشار انگشت/TBI یا داپلر را طبق نظر تیم عروقی بررسی کنید.');
 }
 if(checked('sPus')||infection==='mild'||infection==='moderate'||infection==='severe'||signs>=2){
  plan.push('راهنمای IWII ویرایش چهارم ۲۰۲۶ و راهنمای اختصاصی اتیولوژی: عفونت را بر اساس ارزیابی بالینی و مجموعه نشانه‌ها بررسی کنید؛ کلونیزاسیون به‌تنهایی معادل عفونت بالینی نیست. از تجویز خودکار آنتی‌بیوتیک یا پانسمان ضدمیکروبی توسط سامانه پرهیز شود.');
 }else if(infection==='uninfected'){
  plan.push('در صورت تأیید بالینی غیرعفونی‌بودن زخم، آنتی‌بیوتیک سیستمیک یا موضعی صرفاً برای تسریع ترمیم/پیشگیری از عفونت پیشنهاد نمی‌شود؛ پایش تغییر علائم ادامه یابد.');
 }
 if(get('aNutrition')==='risk'||get('aNutrition')==='malnutrition'){
  plan.push('خطر تغذیه‌ای ثبت شده است: ارزیابی تغذیه جامع و ارجاع به متخصص تغذیه/تیم درمان برای برنامه متناسب با نیاز، بیماری‌های همراه و اهداف مراقبت بررسی شود.');
 }

 if(tissue[2]>0) plan.push('وجود بافت نکروتیک ثبت شده است: علت، پرفیوژن و نیاز/ایمنی دبریدمان باید توسط متخصص ارزیابی شود؛ این سامانه نوع دبریدمان را تعیین نمی‌کند.');
 if(tissue[1]>0) plan.push('اسلاف ثبت شده است: بستر زخم، ترشح و نیاز به پاک‌سازی/دبریدمان را طبق ارزیابی درمانگر بازبینی کنید.');
 if(pain>=7) plan.push('درد شدید ثبت شده: علت درد، ایسکمی، عفونت و کفایت کنترل درد باید جداگانه ارزیابی شود.');
 if(get('aDepth')==='') plan.push('عمق زخم ثبت نشده است؛ در صورت امکان و توسط فرد مجاز با روش بالینی اندازه‌گیری و مستند شود. از عکس دوبعدی عمق استنتاج نشود.');
 plan.push('در مراجعه بعدی، تصویر با زاویه و مقیاس مشابه ثبت و مساحت، طول/عرض، بافت بستر، ترشح، درد و علائم عفونت با مقادیر قبلی مقایسه شود.');
 const follow=get('aFollowup');
 if(follow) plan.push(`تاریخ پیگیری واردشده توسط ارزیاب: ${follow}؛ فاصله پیگیری باید با شدت و وضعیت بیمار توسط درمانگر تأیید شود.`);

 // Seven explicit clinical domains: classification, tissue, exudate, infection, risk, dressing considerations, follow-up.
 const etiologyLabels={diabetic:'پای دیابتی',pressure:'آسیب فشاری',venous:'وریدی',arterial:'شریانی',surgical:'جراحی',traumatic:'تروماتیک',burn:'سوختگی',mixed:'مختلط',unknown:'نامشخص'};
 const grades=[];
 if(get('aNpiap')&&get('aNpiap')!=='na')grades.push('NPIAP: '+get('aNpiap'));
 if(get('aWagner')!=='')grades.push('Wagner: گرید '+get('aWagner'));
 if(get('aUTGrade')!==''||get('aUTStage')!=='')grades.push('University of Texas: Grade '+(get('aUTGrade')||'—')+' / Stage '+(get('aUTStage')||'—'));
 if(get('wWound')!==''||get('wIschemia')!==''||get('wInfection')!=='')grades.push('WIfI: W'+(get('wWound')||'—')+' / I'+(get('wIschemia')||'—')+' / fI'+(get('wInfection')||'—'));
 const exudate=get('aExudate'), exType=get('aExudateType'), et=get('aEtiology');
 let dressing='ابتدا نوع زخم، بستر، پوست اطراف، عمق و هدف درمان را بررسی کنید؛ با داده فعلی انتخاب قطعی پانسمان ممکن نیست.';
 if(exudate==='high') dressing='با توجه به ترشح زیاد، خانواده‌های جاذب مانند فوم یا هیدروفایبر/آلژینات می‌توانند برای بررسی درمانگر مطرح باشند؛ علت ترشح و عفونت را نیز ارزیابی کنید و از خیساندن پوست اطراف پیشگیری شود.';
 else if(exudate==='moderate') dressing='برای ترشح متوسط، پانسمان‌های جاذب مانند فوم یا هیدروفایبر بر اساس عمق و حفره زخم قابل بررسی‌اند؛ تناوب تعویض طبق دستور سازنده و وضعیت زخم تعیین شود.';
 else if(exudate==='low') dressing='برای ترشح کم، لایه تماس غیرچسبنده و پانسمان با حفظ رطوبت متعادل قابل بررسی است؛ اگر بستر خشک یا اسلاف‌دار است، نیاز به رطوبت‌رسانی فقط پس از ارزیابی علت و پرفیوژن بررسی شود.';
 else if(exudate==='none') dressing='خشکی بستر و علت نبود ترشح بررسی شود؛ انتخاب پانسمان محافظ و حفظ رطوبت متعادل بر اساس اتیولوژی و معاینه درمانگر انجام شود.';
 if(exType==='چرکی'||checked('sPus')) dressing+=' ترشح چرکی/مشکوک به عفونت نیازمند ارزیابی بالینی است؛ پانسمان ضدمیکروبی جایگزین تشخیص و درمان عفونت نیست.';
 const riskFlags=[];
 const bpMatch=get('aBP').match(/^(\s*\d{2,3})\s*\/\s*(\d{2,3})\s*$/);
 const systolic=bpMatch?Number(bpMatch[1]):null, rr=Number(get('aRR')), spo2=Number(get('aSpO2'));
 if(systolic!==null&&systolic<90)riskFlags.push('فشار سیستولیک کمتر از ۹۰ ثبت شده: ارزیابی فوری حضوری و بررسی وضعیت همودینامیک لازم است.');
 if(get('aRR')!==''&&rr>=22)riskFlags.push('تعداد تنفس ۲۲ یا بیشتر ثبت شده: وضعیت عمومی و علائم سیستمیک باید فوراً توسط درمانگر بررسی شود.');
 if(get('aSpO2')!==''&&spo2<92)riskFlags.push('اشباع اکسیژن کمتر از ۹۲٪ ثبت شده: ارزیابی فوری بالینی لازم است؛ صحت اندازه‌گیری و شرایط بیمار بررسی شود.');
 if(get('aTemp')!==''&&temp<36)riskFlags.push('دمای کمتر از ۳۶ درجه ثبت شده: هیپوترمی/بیماری سیستمیک باید بررسی شود.');
 if(get('aPTB')==='positive')riskFlags.push('Probe-to-bone مثبت ثبت شده: ارزیابی تخصصی احتمال درگیری استخوان و بررسی‌های لازم ضروری است.');
 if(et==='arterial'||(get('wIschemia')!==''&&Number(get('wIschemia'))>=2))riskFlags.push('احتمال ایسکمی/اختلال پرفیوژن: ارزیابی عروقی سریع؛ فشرده‌سازی و دبریدمان بدون ارزیابی تخصصی انجام نشود.');
 if(infection==='severe'||(temp>=38&&temp<50)||hr>=120)riskFlags.push('علائم سیستمیک یا عفونت شدید ثبت شده: ارزیابی فوری حضوری؛ در بدحالی عمومی، اورژانس.');
 if(checked('sPus')||checked('sOdor')||signs>=2)riskFlags.push('علائم موضعی مشکوک به عفونت/التهاب ثبت شده؛ گسترش قرمزی، گرمی، تورم، درد و ترشح پایش و معاینه شود.');
 if(tissue[2]>0)riskFlags.push('نکروز ثبت شده: خون‌رسانی و ایمنی دبریدمان باید توسط متخصص بررسی شود.');
 if(pain>=7)riskFlags.push('درد شدید: ارزیابی علت، از جمله ایسکمی یا عفونت، لازم است.');
 if(!riskFlags.length)riskFlags.push('عامل خطر مشخصی از ورودی‌های فعلی استخراج نشد؛ این موضوع خطر را رد نمی‌کند و ارزیابی کامل بیمار ضروری است.');
 const tissueSummary=`گرانولاسیون ${tissue[0]}٪، اسلاف ${tissue[1]}٪، نکروز ${tissue[2]}٪، اپی‌تلیال ${tissue[3]}٪`;
 const exSummary=`مقدار: ${exudate||'ثبت نشده'}؛ نوع: ${exType||'ثبت نشده'}`;
 const gradeSummary=grades.length?grades.join(' | '):'گریدی انتخاب نشده است. ابزار مناسب باید با توجه به اتیولوژی انتخاب و توسط فرد آموزش‌دیده ثبت شود.';
 const domains=[
  ['۱. طبقه‌بندی و گریدبندی',`اتیولوژی ثبت‌شده: ${etiologyLabels[et]||et}. ${gradeSummary}`],
  ['۲. بستر و بافت زخم',tissueSummary+'؛ مجموع درصدها باید حداکثر ۱۰۰ باشد.'],
  ['۳. ترشحات',exSummary+'؛ رنگ، بو، قوام و تغییر نسبت به ویزیت قبل نیز ثبت شود.'],
  ['۴. عفونت و التهاب',`شدت ثبت‌شده: ${infection||'نامشخص'}؛ ${signs} علامت موضعی انتخاب شده است. تشخیص عفونت نیازمند معاینه است.`],
  ['۵. خطرها و هشدارها',riskFlags.join(' ')],
  ['۶. ملاحظات انتخاب پانسمان',dressing],
  ['۷. پلن و پیگیری','پاک‌سازی طبق پروتکل مرکز، محافظت پوست اطراف، کنترل علت زمینه‌ای، کاهش فشار در صورت اندیکاسیون و ثبت تصویر/ابعاد استاندارد در پیگیری؛ زمان‌بندی با شدت و نظر درمانگر تعیین شود.']
 ];
 const seven=$('#clinicalSevenOutput');
 if(seven) seven.innerHTML=domains.map((d,i)=>`<article class="clinical-domain"><b>${d[0]}</b><p>${d[1]}</p></article>`).join('');
 // Append specific exudate/dressing considerations to the editable plan, without prescribing a product.
 plan.push('ارزیابی ترشح: '+exSummary+'. '+dressing);
 plan.push('مرور خطرها: '+riskFlags.join(' '));
 if(grades.length)plan.push('طبقه‌بندی‌های ثبت‌شده توسط ارزیاب: '+grades.join('؛ ')+'.');

 const guidelineRefs=[
  {label:'IWII — Wound infection in clinical practice, 4th edition (2026)',url:'https://woundsinternational.com/consensus-documents/wound-infection-in-clinical-practice-principles-of-best-practice-fourth-edition/'}
 ];
 if(et==='diabetic'){
  guidelineRefs.push({label:'IWGDF/IDSA — Diabetes-related foot infection guideline (2023)',url:'https://www.idsociety.org/practice-guideline/diabetic-foot-infections/'});
  guidelineRefs.push({label:'IWGDF — Offloading guideline (2023)',url:'https://iwgdfguidelines.org/offloading-guideline-2023/'});
 }
 if(et==='pressure') guidelineRefs.push({label:'NPIAP/EPUAP/PPPIA — International Pressure Injury Guideline, 4th edition (2026)',url:'https://www.internationalguideline.com/the-international-guideline'});
 if(et==='venous') guidelineRefs.push({label:'NICE NG152 — Leg ulcer infection: antimicrobial prescribing (infection/antimicrobial stewardship only)',url:'https://www.nice.org.uk/guidance/ng152/chapter/recommendations'});
 latestCarePlanDraft={urgency,items:[...plan],clinicalDomains:domains.map(([title,summary])=>({title,summary})),gradeSummary,riskFlags:[...riskFlags],dressingConsiderations:dressing,guidelineRefs,generatedAt:new Date().toISOString(),reviewed:false,clinicianEdits:''};
 const title=`پیش‌نویس پلن مراقبت — ${urgency}`;
 const box=$('#carePlanOutput');
 box.innerHTML=`<div class="plan-banner ${urgent?'urgent':''}"><b>${title}</b><small>پیشنهاد پشتیبان تصمیم؛ نه دستور درمان یا نسخه</small></div><ol>${plan.map(x=>`<li>${x}</li>`).join('')}</ol><label class="plan-review"><input type="checkbox" id="planReviewed"> این پیش‌نویس توسط درمانگر بازبینی و اصلاح شده است.</label><textarea id="planEdits" rows="3" placeholder="اصلاحات، مسئول اقدام و جزئیات برنامه مورد تأیید درمانگر..."></textarea><button class="secondary-btn" id="savePlanToAssessment" type="button">ذخیره پیش‌نویس پلن در ارزیابی</button>`;
 $('#savePlanToAssessment').onclick=()=>{
   const wid=get('assessmentWound'); if(!wid){toast('ابتدا زخم را انتخاب کنید.');return}
   const draftRecord={id:id(),woundId:wid,created:new Date().toISOString(),kind:'care-plan-draft',data:{urgency,items:plan,clinicalDomains:domains,gradeSummary,riskFlags,dressingConsiderations:dressing,reviewed:$('#planReviewed').checked,clinicianEdits:$('#planEdits').value,disclaimer:'Draft decision support only; clinician approval required.'}};
   state.assessments.push(draftRecord);
   if(!persist()){state.assessments.pop();return;}
   toast('پیش‌نویس پلن مراقبت ذخیره شد.');
 };
}
$('#calculateScores')?.addEventListener('click',()=>{computeClinicalScores();buildCarePlan()});
$('#generateCarePlan')?.addEventListener('click',()=>{computeClinicalScores();buildCarePlan()});

const clinicalRefreshIds=['aEtiology','aPain','aTemp','aHR','aBP','aRR','aSpO2','aPTB','aExudate','aExudateType','aInfection','aNpiap','aWagner','aUTGrade','aUTStage','wWound','wIschemia','wInfection','tGran','tSlough','tNecrosis','tEpi','sRed','sWarm','sSwelling','sPain','sPus','sOdor','sinSite','sinIsch','sinNeuro','sinInfect','sinArea','sinDepth','pushArea','pushExudate','pushTissue',...Array.from({length:13},(_,i)=>'bwat'+(i+1))];
clinicalRefreshIds.forEach(id=>{const el=$('#'+id); if(el)el.addEventListener('change',()=>{computeClinicalScores();buildCarePlan()})});
// Initial render: the seven clinical domains are present on opening the assessment page, not hidden behind a button.
computeClinicalScores();
buildCarePlan();

['sinSite','sinIsch','sinNeuro','sinInfect','sinArea','sinDepth','pushArea','pushExudate','pushTissue','aWagner','aUTGrade','aUTStage','aNpiap','wWound','wIschemia','wInfection',...Array.from({length:13},(_,i)=>'bwat'+(i+1))].forEach(k=>$('#'+k)?.addEventListener('change',()=>{if($('#computedScores')?.dataset.auto==='1')computeClinicalScores()}));


// v7: downloadable one-page wound assessment report (PNG + print-to-PDF).
function reportEsc(s){return String(s??'ثبت نشده').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function fillReportPatients(){
 const sel=$('#reportPatient'); if(!sel)return;
 const prev=sel.value; sel.innerHTML='<option value="">انتخاب بیمار</option>'+state.patients.map(p=>`<option value="${p.id}">${reportEsc(p.name)} — ${reportEsc(p.code)}</option>`).join('');
 if(state.patients.some(p=>p.id===prev))sel.value=prev;
 fillReportWounds();
}
function fillReportWounds(){
 const ps=$('#reportPatient'), ws=$('#reportWound'); if(!ps||!ws)return;
 const prev=ws.value; const arr=state.wounds.filter(w=>w.patientId===ps.value);
 ws.innerHTML='<option value="">انتخاب زخم</option>'+arr.map(w=>`<option value="${w.id}">${reportEsc(w.site)} — ${reportEsc(w.etiology)}</option>`).join('');
 if(arr.some(w=>w.id===prev))ws.value=prev;
 renderWoundReportPreview();
}
function latestForWound(wid,kind){return state.assessments.filter(a=>a.woundId===wid&&(!kind||a.kind===kind)).sort((a,b)=>new Date(b.created)-new Date(a.created))[0]}
function latestImageForWound(wid){return state.images.filter(x=>x.woundId===wid).sort((a,b)=>new Date(b.created)-new Date(a.created))[0]}
function reportRows(p,w,a,img){
 const d=a?.data||{},t=d.tissue||{},signs=d.localSigns||{},wifi=d.wifi||{},ut=d.universityOfTexas||{};
 const rows=[
 ['شناسه بیمار',p.code],['سن / تاریخ تولد',p.dob||'ثبت نشده'],['نوع و محل زخم',`${w.etiology||'ثبت نشده'} — ${w.site||'ثبت نشده'}`],
 ['تاریخ ارزیابی',a?new Date(a.created).toLocaleString('fa-IR'):'ارزیابی بالینی ثبت نشده'],
 ['ارزیاب',d.assessor],['طول × عرض',d.lengthCm&&d.widthCm?`${d.lengthCm} × ${d.widthCm} سانتی‌متر`:'ثبت نشده'],
 ['عمق',d.depthMm?`${d.depthMm} میلی‌متر (${d.depthMethod||'روش ثبت نشده'})`:'ثبت نشده'],
 ['مساحت تصویر',img?.areaCm2!=null?`${Number(img.areaCm2).toFixed(2)} سانتی‌متر مربع`:'قابل محاسبه/ثبت نشده'],
 ['بافت بستر',`گرانولاسیون ${t.granulation??'—'}٪ | اسلاف ${t.slough??'—'}٪ | نکروز ${t.necrosis??'—'}٪ | اپی‌تلیال ${t.epithelial??'—'}٪`],
 ['ترشح و درد',`${d.exudate||'ترشح ثبت نشده'} | درد: ${d.pain||'ثبت نشده'}/10`],
 ['علائم موضعی',Object.entries(signs).filter(x=>x[1]).map(x=>({redness:'قرمزی',warmth:'گرمی',swelling:'تورم',newPain:'درد جدید',pus:'چرک',odor:'بو'}[x[0]])).join('، ')||'علامت موضعی انتخاب نشده'],
 ['TIME',`T: ${d.time?.tissue||'—'} | I: ${d.time?.infection||'—'} | M: ${d.time?.moisture||'—'} | E: ${d.time?.edge||'—'}`],
 ['SINBAD',d.computedScores?.find?.(x=>x[0]==='SINBAD')?.[1]||'ثبت/محاسبه نشده'],
 ['PUSH 3.0',d.computedScores?.find?.(x=>x[0]==='PUSH 3.0')?.[1]||'ثبت/محاسبه نشده'],
 ['BWAT',d.computedScores?.find?.(x=>x[0]==='BWAT')?.[1]||'ثبت/محاسبه نشده'],
 ['Wagner / UT / NPIAP',`${d.wagner||'—'} / ${ut.grade||'—'}-${ut.stage||'—'} / ${d.npiapStage||'—'}`],
 ['WIfI',`W${wifi.wound??'—'} · I${wifi.ischemia??'—'} · fI${wifi.infection??'—'} (مرحله نهایی محاسبه نشده)`],
 ['علائم حیاتی',`دما ${d.temperature||'—'} | نبض ${d.heartRate||'—'} | فشار ${d.bloodPressure||'—'} | SpO₂ ${d.spo2||'—'}`],
 ['یادداشت / مداخلات',`${d.notes||'—'} ${d.interventions||''}`],
 ['پیگیری',d.followup||w.followup||'ثبت نشده']
 ];
 return rows;
}
async function makeWoundReportCanvas(){
 const pid=$('#reportPatient')?.value,wid=$('#reportWound')?.value;
 const p=state.patients.find(x=>x.id===pid),w=state.wounds.find(x=>x.id===wid);
 if(!p||!w){toast('ابتدا بیمار و زخم را انتخاب کنید.');return null}
 const a=latestForWound(wid,'clinical-assessment'),img=latestImageForWound(wid),plan=latestForWound(wid,'care-plan-stage7');
 const c=document.createElement('canvas');c.width=1500;c.height=2700;
 const ctx=c.getContext('2d');ctx.fillStyle='#EAF8F7';ctx.fillRect(0,0,c.width,c.height);
 ctx.fillStyle='#092C4C';ctx.fillRect(0,0,c.width,190);
 ctx.direction='ltr';ctx.textAlign='left';ctx.fillStyle='#fff';ctx.font='bold 62px Arial';ctx.fillText('WoundAI',70,95);try{const logo=new Image();logo.src='assets/woundai-logo-horizontal.png';await new Promise((res,rej)=>{logo.onload=res;logo.onerror=rej});ctx.drawImage(logo,990,18,440,145)}catch(e){}
 ctx.font='26px Arial';ctx.fillStyle='#a8fff1';ctx.fillText('WOUND ASSESSMENT REPORT',72,145);
 ctx.direction='rtl';ctx.textAlign='right';ctx.fillStyle='#092C4C';ctx.font='bold 36px Arial';ctx.fillText('گزارش ارزیابی زخم',1420,255);
 ctx.font='25px Arial';ctx.fillStyle='#426176';ctx.fillText(`بیمار: ${p.name}   |   کد پرونده: ${p.code}`,1420,310);
 let y=365;
 if(img?.image){
  try{const im=new Image();await new Promise((res,rej)=>{im.onload=res;im.onerror=rej;im.src=img.image});const maxW=590,maxH=430,scale=Math.min(maxW/im.width,maxH/im.height);const iw=im.width*scale,ih=im.height*scale;ctx.fillStyle='#fff';ctx.fillRect(70,y,630,470);ctx.drawImage(im,85,y+15,iw,ih);ctx.fillStyle='#557080';ctx.font='20px Arial';ctx.fillText('تصویر ثبت‌شده زخم',680,y+450);}catch(e){}
 }
 const rows=reportRows(p,w,a,img);let startY=y+500;
 ctx.fillStyle='#fff';ctx.fillRect(70,startY,1360,rows.length*57+25);
 rows.forEach((r,i)=>{let yy=startY+42+i*57;if(i%2===0){ctx.fillStyle='#f0f6f8';ctx.fillRect(80,startY+ i*57,1340,57)}ctx.direction='rtl';ctx.textAlign='right';ctx.fillStyle='#087f82';ctx.font='bold 21px Arial';ctx.fillText(String(r[0]),1390,yy);ctx.fillStyle='#183b52';ctx.font='20px Arial';ctx.fillText(String(r[1]??'ثبت نشده').slice(0,92),900,yy);});
 let py=startY+rows.length*57+55;
 ctx.fillStyle='#092C4C';ctx.font='bold 27px Arial';ctx.fillText('پیش‌نویس پلن مراقبت',1420,py);
 ctx.fillStyle='#183b52';ctx.font='19px Arial';
 const planItems=plan?.data?.items||[];
 (planItems.length?planItems:['پلن مراقبت ثبت نشده است.']).slice(0,4).forEach((x,i)=>ctx.fillText('• '+String(x).slice(0,105),1400,py+42+i*34));
 const history=state.assessments.filter(x=>x.woundId===wid&&x.kind==='clinical-assessment').sort((x,y)=>new Date(x.created)-new Date(y.created));
 const trendPoints=history.map(x=>({area:Number(x.data?.imageMeasurement?.areaCm2),date:new Date(x.created).toLocaleDateString('fa-IR')})).filter(x=>Number.isFinite(x.area)&&x.area>=0);
 const chartY=py+210;
 if(trendPoints.length>=2){
  ctx.fillStyle='#12364a';ctx.font='bold 25px Arial';ctx.direction='rtl';ctx.textAlign='right';ctx.fillText('روند مساحت ثبت‌شده در مراجعات',1420,chartY);
  const left=130,top=chartY+35,width=1190,height=230,max=Math.max(...trendPoints.map(x=>x.area),.01),min=Math.min(0,...trendPoints.map(x=>x.area)),range=Math.max(max-min,.01);
  ctx.strokeStyle='#d9e5e9';ctx.lineWidth=2;
  for(let k=0;k<4;k++){let yy=top+k*height/3;ctx.beginPath();ctx.moveTo(left,yy);ctx.lineTo(left+width,yy);ctx.stroke()}
  const coords=trendPoints.map((p,i)=>({x:left+(trendPoints.length===1?width/2:i*width/(trendPoints.length-1)),y:top+(max-p.area)/range*height}));
  ctx.strokeStyle='#087f82';ctx.lineWidth=5;ctx.beginPath();coords.forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));ctx.stroke();
  coords.forEach((p,i)=>{ctx.fillStyle='#087f82';ctx.beginPath();ctx.arc(p.x,p.y,7,0,Math.PI*2);ctx.fill();ctx.fillStyle='#12364a';ctx.font='16px Arial';ctx.textAlign='center';ctx.fillText(trendPoints[i].area.toFixed(2),p.x,p.y-14);ctx.fillText(trendPoints[i].date,p.x,top+height+25)});
 }else{
  ctx.fillStyle='#7894A8';ctx.font='18px Arial';ctx.direction='rtl';ctx.textAlign='right';ctx.fillText('برای نمودار روند، حداقل دو مراجعه با مساحت معتبر لازم است.',1420,chartY+45);
 }
 ctx.fillStyle='#647d8c';ctx.font='17px Arial';ctx.textAlign='right';ctx.direction='rtl';ctx.fillText('این گزارش از داده‌های ذخیره‌شده تولید شده و جایگزین تشخیص یا دستور درمان نیست. بازبینی و تأیید درمانگر الزامی است.',1420,2635);
 ctx.direction='ltr';ctx.textAlign='left';ctx.fillText(`Generated: ${new Date().toISOString()}`,70,2635);
 return c;
}
async function renderWoundReportPreview(){
 const box=$('#reportPreview');if(!box)return;
 const p=state.patients.find(x=>x.id===$('#reportPatient')?.value),w=state.wounds.find(x=>x.id===$('#reportWound')?.value);
 if(!p||!w){box.innerHTML='<span>پس از انتخاب بیمار و زخم، پیش‌نمایش گزارش نمایش داده می‌شود.</span>';return}
 const a=latestForWound(w.id,'clinical-assessment'),img=latestImageForWound(w.id);
 const history=state.assessments.filter(x=>x.woundId===w.id&&x.kind==='clinical-assessment').sort((x,y)=>new Date(x.created)-new Date(y.created));
 const trend=historyTrendSummary(history);
 box.innerHTML=`<b>${reportEsc(p.name)} — ${reportEsc(w.site)}</b><small>آخرین ارزیابی: ${a?new Date(a.created).toLocaleString('fa-IR'):'ثبت نشده'} | عکس: ${img?'موجود':'ثبت نشده'}</small><small>تعداد ارزیابی‌های ثبت‌شده: ${history.length}</small><small>${reportEsc(trend)}</small><small>گزارش PDF شامل نمودار روند و صفحه مستقل برای هر مراجعه است.</small>`;
}
$('#reportPatient')?.addEventListener('change',fillReportWounds);
$('#reportWound')?.addEventListener('change',renderWoundReportPreview);
$('#downloadWoundReportPng')?.addEventListener('click',async()=>{
 const c=await makeWoundReportCanvas();if(!c)return;
 const a=document.createElement('a');a.href=c.toDataURL('image/png');a.download=`WoundAI-Report-${Date.now()}.png`;a.click();
});
$('#downloadWoundReportPdf')?.addEventListener('click',async()=>{
 const c=await makeWoundReportCanvas();if(!c)return;
 const data=c.toDataURL('image/png'),win=window.open('','_blank');
 if(!win){toast('اجازه بازشدن پنجره چاپ را در مرورگر فعال کنید.');return}
 win.document.write(`<html lang="fa" dir="rtl"><head><meta charset="utf-8"><title>WoundAI report</title><style>@page{size:A4;margin:8mm}body{margin:0}img{width:100%;height:auto;display:block} </style></head><body><img src="${data}"><script>window.onload=()=>setTimeout(()=>window.print(),300)<\/script></body></html>`);win.document.close();
});


const _persistReportRefresh=persist;persist=function(){_persistReportRefresh();if($('#reportPatient'))fillReportPatients()};

setTimeout(()=>{if($('#reportPatient'))fillReportPatients()},250);



// ===== Stage 8: longitudinal report, assessment history and visit comparison =====
function renderReportHistoryComparison(){
 const box=$('#reportHistoryComparison'),compare=$('#visitCompareContent'),download=$('#downloadVisitComparePng');
 if(!box)return;
 const wid=$('#reportWound')?.value;
 if(!wid){
  box.innerHTML='<p>برای مشاهده تاریخچه، بیمار و زخم را انتخاب کنید.</p>';
  if(compare)compare.innerHTML='<p class="muted">برای مشاهده مقایسه، بیمار و زخم را انتخاب کنید.</p>';
  if(download)download.disabled=true;
  return;
 }
 const records=state.assessments.filter(a=>a.woundId===wid&&a.kind==='clinical-assessment').sort((a,b)=>new Date(a.created)-new Date(b.created));
 if(!records.length)box.innerHTML='<p>برای این زخم ارزیابی بالینی ثبت‌شده‌ای وجود ندارد.</p>';
 else {
  const rows=records.map((a,i)=>{
   const d=a.data||{},im=d.imageMeasurement||{};
   const prev=i?records[i-1].data?.imageMeasurement:null;
   const delta=prev&&Number(prev.areaCm2)>0&&Number.isFinite(Number(im.areaCm2))?((Number(im.areaCm2)-Number(prev.areaCm2))/Number(prev.areaCm2))*100:null;
   const tissue=d.tissue||{},tissueText=[`گرانولاسیون ${tissue.granulation??'—'}٪`,`اسلاف ${tissue.slough??'—'}٪`,`نکروز ${tissue.necrosis??'—'}٪`].join(' · ');
   return `<tr><td>${new Date(a.created).toLocaleString('fa-IR')}</td><td>${reportEsc(im.areaCm2??'ثبت نشده')}</td><td>${reportEsc(d.lengthCm??im.lengthCm??'—')} × ${reportEsc(d.widthCm??im.widthCm??'—')}</td><td>${delta===null?'—':(delta>0?'+':'')+delta.toFixed(1)+'٪'}</td><td>${reportEsc(tissueText)}</td><td>${reportEsc(d.exudate||'—')} / ${reportEsc(d.exudateType||'—')}</td><td>${reportEsc(d.infectionSeverity||'—')}</td><td>${reportEsc(d.assessor||'—')}</td></tr>`;
  });
  box.innerHTML=`<h3>تاریخچه ارزیابی‌های بالینی</h3><p class="micro-note">ترکیب بافت و شدت عفونت در این جدول ورودی ثبت‌شده ارزیاب است، نه تشخیص خودکار از عکس.</p><div class="table-scroll"><table><thead><tr><th>تاریخ</th><th>مساحت (cm²)</th><th>طول × عرض</th><th>تغییر مساحت</th><th>بافت ثبت‌شده</th><th>ترشح</th><th>شدت عفونت ثبت‌شده</th><th>ارزیاب</th></tr></thead><tbody>${rows.join('')}</tbody></table></div>`;
 }
 const imgs=state.images.filter(x=>x.woundId===wid&&x.image).sort((a,b)=>new Date(a.created)-new Date(b.created));
 if(imgs.length<2){
  if(compare)compare.innerHTML='<div class="compare-empty"><span>◎</span><b>برای مقایسه تصویری، حداقل دو تصویر لازم است.</b><small>یک تصویر پایه و یک تصویر پیگیری از همین زخم ثبت کنید.</small></div>';
  if(download)download.disabled=true;
  window.woundaiVisitCompare=null;
  return;
 }
 const pair=imgs.slice(-2),[before,after]=pair;
 const delta=Number.isFinite(Number(before.areaCm2))&&Number(before.areaCm2)>0&&Number.isFinite(Number(after.areaCm2))?((Number(after.areaCm2)-Number(before.areaCm2))/Number(before.areaCm2))*100:null;
 const metric=(x)=>x.areaCm2!==null&&x.areaCm2!==undefined?`${Number(x.areaCm2).toFixed(2)} cm²`:'ثبت نشده';
 const label=(x)=>new Date(x.created).toLocaleString('fa-IR');
 const trend=delta===null?'تغییر مساحت قابل محاسبه نیست':`${delta>0?'افزایش':'کاهش'} ${Math.abs(delta).toFixed(1)}٪ در مساحت ثبت‌شده`;
 compare.innerHTML=`<div class="compare-images">
  <article class="compare-visit"><div class="compare-visit-top"><span>مراجعه قبلی</span><time>${label(before)}</time></div><img src="${before.thumbnail||before.image}" alt="تصویر مراجعه قبلی"><div class="compare-metric"><small>مساحت ترسیم‌شده</small><b>${metric(before)}</b></div></article>
  <article class="compare-visit current"><div class="compare-visit-top"><span>مراجعه جدیدتر</span><time>${label(after)}</time></div><img src="${after.thumbnail||after.image}" alt="تصویر مراجعه جدیدتر"><div class="compare-metric"><small>مساحت ترسیم‌شده</small><b>${metric(after)}</b></div></article>
 </div><div class="compare-delta"><span class="delta-icon">↔</span><div><b>${trend}</b><small>مقایسه صرفاً بر اساس مساحت ذخیره‌شده و تصاویر انتخاب‌شده است؛ تفسیر بالینی با متخصص.</small></div></div>`;
 if(download)download.disabled=false;
 window.woundaiVisitCompare={before,after,delta,woundId:wid};
}
async function downloadVisitComparePng(){
 const pair=window.woundaiVisitCompare;
 if(!pair){toast('برای مقایسه، حداقل دو تصویر ثبت‌شده لازم است.');return}
 const load=src=>new Promise((resolve,reject)=>{const im=new Image();im.onload=()=>resolve(im);im.onerror=reject;im.src=src});
 try{
  const [a,b]=await Promise.all([load(pair.before.image),load(pair.after.image)]);
  const c=document.createElement('canvas');c.width=1800;c.height=1240;
  const x=c.getContext('2d');x.fillStyle='#EAF8F7';x.fillRect(0,0,c.width,c.height);
  x.fillStyle='#12364a';x.font='bold 48px Tahoma,Arial';x.textAlign='right';x.direction='rtl';x.fillText('WoundAI | مقایسه تصویری روند زخم',1700,85);
  x.fillStyle='#5d7480';x.font='26px Tahoma,Arial';x.fillText('مقایسه دو مراجعه ثبت‌شده برای یک زخم',1700,132);
  const draw=(im,left,title,rec)=>{
   x.fillStyle='#fff';x.strokeStyle='#d6e3e7';x.lineWidth=2;x.beginPath();x.roundRect(left,180,800,900,24);x.fill();x.stroke();
   x.fillStyle='#087f82';x.font='bold 32px Tahoma,Arial';x.textAlign='right';x.fillText(title,left+750,240);
   x.fillStyle='#536d79';x.font='22px Tahoma,Arial';x.fillText(new Date(rec.created).toLocaleString('fa-IR'),left+750,282);
   const maxW=720,maxH=630,scale=Math.min(maxW/im.width,maxH/im.height),w=im.width*scale,h=im.height*scale;
   x.drawImage(im,left+(800-w)/2,320+(630-h)/2,w,h);
   x.fillStyle='#12364a';x.font='bold 30px Tahoma,Arial';x.fillText(`مساحت: ${rec.areaCm2==null?'ثبت نشده':Number(rec.areaCm2).toFixed(2)+' cm²'}`,left+750,1015);
  };
  draw(a,80,'مراجعه قبلی',pair.before);draw(b,920,'مراجعه جدیدتر',pair.after);
  x.fillStyle='#5d7480';x.font='20px Tahoma,Arial';x.textAlign='center';x.fillText('تصاویر باید با زاویه، فاصله، نور و مقیاس مشابه ثبت شوند. این برگه جایگزین ارزیابی بالینی نیست.',900,1165);
  const link=document.createElement('a');link.href=c.toDataURL('image/png');link.download=`WoundAI-Visit-Comparison-${Date.now()}.png`;link.click();
 }catch(e){console.error(e);toast('ساخت تصویر مقایسه انجام نشد؛ تصویرها را دوباره بررسی کنید.')}
}
$('#downloadVisitComparePng')?.addEventListener('click',downloadVisitComparePng);

function buildHistoryTrendSvg(records){
 const points=records.map((r,i)=>({i,area:Number(r.data?.imageMeasurement?.areaCm2),date:new Date(r.created).toLocaleDateString('fa-IR')})).filter(p=>Number.isFinite(p.area)&&p.area>=0);
 if(points.length<2)return '<p class="trend-empty">برای رسم روند مساحت، حداقل دو مراجعه با اندازه‌گیری معتبر لازم است.</p>';
 const W=920,H=300,L=70,R=30,T=35,B=65,plotW=W-L-R,plotH=H-T-B;
 const max=Math.max(...points.map(p=>p.area),0.01),min=Math.min(0,...points.map(p=>p.area)),range=Math.max(max-min,0.01);
 const coords=points.map((p,i)=>({ ...p,x:L+(points.length===1?plotW/2:i*plotW/(points.length-1)),y:T+(max-p.area)/range*plotH}));
 const path=coords.map((p,i)=>(i?'L':'M')+p.x.toFixed(1)+','+p.y.toFixed(1)).join(' ');
 const circles=coords.map(p=>`<circle cx="${p.x}" cy="${p.y}" r="6" fill="#087f82"/><text x="${p.x}" y="${Math.max(18,p.y-13)}" text-anchor="middle" font-size="13" fill="#12364a">${p.area.toFixed(2)}</text><text x="${p.x}" y="${H-24}" text-anchor="middle" font-size="12" fill="#7894A8">${reportEsc(p.date)}</text>`).join('');
 const grid=[0,.25,.5,.75,1].map(q=>{const y=T+q*plotH,v=max-q*range;return `<line x1="${L}" y1="${y}" x2="${W-R}" y2="${y}" stroke="#dce7ea"/><text x="${L-12}" y="${y+4}" text-anchor="end" font-size="12" fill="#7894A8">${v.toFixed(1)}</text>`}).join('');
 return `<svg class="trend-svg" viewBox="0 0 ${W} ${H}" role="img" aria-label="روند مساحت زخم بر حسب سانتی‌متر مربع">${grid}<path d="${path}" fill="none" stroke="#087f82" stroke-width="4" stroke-linejoin="round" stroke-linecap="round"/>${circles}<text x="${L}" y="18" font-size="13" fill="#7894A8">مساحت (cm²)</text></svg>`;
}
function historyTrendSummary(records){
 const measured=records.map(r=>Number(r.data?.imageMeasurement?.areaCm2)).filter(v=>Number.isFinite(v)&&v>=0);
 if(measured.length<2)return 'برای مقایسه روند، حداقل دو مساحت معتبر لازم است.';
 const first=measured[0],last=measured[measured.length-1],delta=first>0?(last-first)/first*100:null;
 return `مساحت نخست: ${first.toFixed(2)} cm² · آخرین مساحت: ${last.toFixed(2)} cm² · ${delta===null?'درصد تغییر قابل محاسبه نیست':`${delta>0?'افزایش':'کاهش'} ${Math.abs(delta).toFixed(1)}٪`}. تغییر مساحت به‌تنهایی معیار قطعی ترمیم نیست.`;
}

async function downloadFullHistoryPdf(){
 const wid=$('#reportWound')?.value,p=state.patients.find(x=>x.id===$('#reportPatient')?.value),w=state.wounds.find(x=>x.id===wid);
 if(!p||!w){toast('ابتدا بیمار و زخم را انتخاب کنید.');return}
 const records=state.assessments.filter(a=>a.woundId===wid&&a.kind==='clinical-assessment').sort((a,b)=>new Date(a.created)-new Date(b.created));
 if(!records.length){toast('برای این زخم ارزیابی ثبت‌شده‌ای وجود ندارد.');return}
 const esc=reportEsc;
 const trendSvg=buildHistoryTrendSvg(records);
 const overview=`<section class="print-page overview-page"><header><h1>WoundAI — خلاصه روند زخم</h1><h2>${esc(p.name)} | ${esc(w.site)}</h2><p>شناسه پرونده: ${esc(p.code||'—')} · اتیولوژی: ${esc(w.etiology||'ثبت نشده')} · تعداد مراجعات: ${records.length}</p></header><h3>روند تغییر مساحت ثبت‌شده</h3>${trendSvg}<p class="trend-summary">${esc(historyTrendSummary(records))}</p><h3>خلاصه تغییرات بالینی</h3><table><thead><tr><th>تاریخ</th><th>مساحت cm²</th><th>گرانولاسیون</th><th>اسلاف</th><th>نکروز</th><th>ترشح</th><th>عفونت ثبت‌شده</th></tr></thead><tbody>${records.map(r=>{const d=r.data||{},im=d.imageMeasurement||{},t=d.tissue||{};return `<tr><td>${esc(new Date(r.created).toLocaleDateString('fa-IR'))}</td><td>${esc(im.areaCm2??'—')}</td><td>${esc(t.granulation??'—')}٪</td><td>${esc(t.slough??'—')}٪</td><td>${esc(t.necrosis??'—')}٪</td><td>${esc((d.exudate||'—')+' / '+(d.exudateType||'—'))}</td><td>${esc(d.infectionSeverity||'—')}</td></tr>`}).join('')}</tbody></table><p class="report-caveat">این گزارش خلاصه داده‌های ثبت‌شده است. درصدهای بافت و شدت عفونت، ورودی درمانگر هستند و از تصویر استنتاج نشده‌اند.</p><footer>گزارش مستندات؛ جایگزین تشخیص یا دستور درمان نیست.</footer></section>`;
 const pages=records.map((a,i)=>{
  const d=a.data||{},im=d.imageMeasurement||{},img=state.images.find(x=>x.id===im.imageId)||state.images.filter(x=>x.woundId===wid&&new Date(x.created)<=new Date(a.created)).sort((x,y)=>new Date(y.created)-new Date(x.created))[0];
  const prev=i?records[i-1].data?.imageMeasurement:null;
  const delta=prev&&Number(prev.areaCm2)>0&&Number.isFinite(Number(im.areaCm2))?((Number(im.areaCm2)-Number(prev.areaCm2))/Number(prev.areaCm2))*100:null;
  const fields=reportRows(p,w,a,img);
  const imageHtml=img?.image?`<img class="visit-image" src="${img.image}" alt="تصویر زخم در مراجعه ${i+1}">`:'<p>تصویر متصل به این ارزیابی در دسترس نیست.</p>';
  return `<section class="print-page"><header><h1>WoundAI — گزارش تاریخچه زخم</h1><h2>${esc(p.name)} | ${esc(w.site)}</h2><p>مراجعه ${i+1} از ${records.length} · ${esc(new Date(a.created).toLocaleString('fa-IR'))}</p></header>${imageHtml}<table>${fields.map(([k,v])=>`<tr><th>${esc(k)}</th><td>${esc(v)}</td></tr>`).join('')}</table><h3>تغییر مساحت نسبت به مراجعه قبل</h3><p>${delta===null?'قابل محاسبه نیست':(delta>0?'افزایش ':'کاهش ')+Math.abs(delta).toFixed(1)+'٪'}</p><h3>اطلاعات عروقی و عوامل زمینه‌ای</h3><p>ABI: ${esc(d.vascular?.abi||'ثبت نشده')} · TBI: ${esc(d.vascular?.tbi||'ثبت نشده')} · نبض پا: ${esc(d.vascular?.pedalPulse||'ثبت نشده')} · نوروپاتی: ${esc(d.neuropathy||'ثبت نشده')} · کاهش فشار: ${esc(d.offloading||'ثبت نشده')}</p><h3>مداخلات ثبت‌شده</h3><p>${esc(d.interventions||'ثبت نشده')}</p><h3>یادداشت درمانگر</h3><p>${esc(d.notes||'ثبت نشده')}</p><footer>ارزیاب: ${esc(d.assessor||'—')} · گزارش مستندات؛ جایگزین تشخیص یا دستور درمان نیست.</footer></section>`;
 });
 const win=window.open('','_blank');if(!win){toast('اجازه بازشدن پنجره چاپ را فعال کنید.');return}
 win.document.write(`<!doctype html><html lang="fa" dir="rtl"><head><meta charset="utf-8"><title>WoundAI History</title><style>@page{size:A4;margin:12mm}body{font-family:Tahoma,Arial,sans-serif;color:#183b52}.print-page{page-break-after:always;break-after:page}.print-page:last-child{page-break-after:auto;break-after:auto}h1{color:#087f82}header{border-bottom:2px solid #087f82;margin-bottom:12px}.visit-image{max-width:100%;max-height:220px;object-fit:contain;display:block;margin:12px auto}.trend-svg{width:100%;height:auto;display:block;margin:12px auto}.trend-summary{background:#eef6f7;border-right:4px solid #087f82;padding:10px;line-height:2}.trend-empty{padding:18px;background:#EAF8F7}.overview-page table{margin-top:12px}.report-caveat{font-size:10px;color:#7894A8;line-height:1.8}table{width:100%;border-collapse:collapse;font-size:11px}td,th{border:1px solid #d7e3e8;padding:6px;text-align:right}th{background:#eef5f7;width:28%}footer{margin-top:24px;font-size:10px;color:#7894A8}@media screen{body{max-width:850px;margin:25px auto}.print-page{padding:25px;border:1px solid #ddd;margin-bottom:20px}}</style></head><body>${overview}${pages.join('')}<script>window.onload=()=>setTimeout(()=>window.print(),500)<\/script></body></html>`);
 win.document.close();
}
$('#reportWound')?.addEventListener('change',renderReportHistoryComparison);
$('#downloadFullHistoryPdf')?.addEventListener('click',downloadFullHistoryPdf);
const _stage8Preview=renderWoundReportPreview;
renderWoundReportPreview=async function(){await _stage8Preview();renderReportHistoryComparison()};

// ===== Stage 9: local identity + encrypted portable backup (not cloud authentication) =====
const LOCAL_ID_KEY='woundai.local.identity.v1';
function stage9Identity(){
 let x=null;try{x=JSON.parse(localStorage.getItem(LOCAL_ID_KEY)||'null')}catch(e){}
 if(!x||!x.id){x={id:'WAI-'+(crypto.randomUUID?crypto.randomUUID().slice(0,8).toUpperCase():Date.now().toString(36).toUpperCase()),name:''};localStorage.setItem(LOCAL_ID_KEY,JSON.stringify(x))}
 $('#localUserId').value=x.id;$('#localUserName').value=x.name||'';
}
$('#saveLocalIdentity')?.addEventListener('click',()=>{
 const name=$('#localUserName').value.trim();if(!name){toast('نام کاربر را وارد کنید.');return}
 const old=JSON.parse(localStorage.getItem(LOCAL_ID_KEY)||'{}');localStorage.setItem(LOCAL_ID_KEY,JSON.stringify({...old,name}));
 $('#stage9Status').textContent='شناسه محلی کاربر ذخیره شد؛ این شناسه حساب آنلاین یا احراز هویت نیست.';
});
async function stage9Key(pass,salt){
 const material=await crypto.subtle.importKey('raw',new TextEncoder().encode(pass),'PBKDF2',false,['deriveKey']);
 return crypto.subtle.deriveKey({name:'PBKDF2',salt,iterations:250000,hash:'SHA-256'},material,{name:'AES-GCM',length:256},false,['encrypt','decrypt']);
}
$('#exportEncryptedBackup')?.addEventListener('click',async()=>{
 const pass=$('#vaultPassphrase').value;if(pass.length<12){toast('عبارت عبور باید حداقل ۱۲ نویسه باشد.');return}
 try{
  if(!crypto?.subtle)throw Error('مرورگر باید HTTPS و Web Crypto را پشتیبانی کند.');
  const salt=crypto.getRandomValues(new Uint8Array(16)),iv=crypto.getRandomValues(new Uint8Array(12)),key=await stage9Key(pass,salt);
  const payload=new TextEncoder().encode(JSON.stringify({app:'WoundAI',version:3,exportedAt:new Date().toISOString(),state,identity:JSON.parse(localStorage.getItem(LOCAL_ID_KEY)||'null')}));
  const cipher=await crypto.subtle.encrypt({name:'AES-GCM',iv},key,payload);
  const pack={format:'WoundAI-Encrypted-Backup-v1',kdf:'PBKDF2-SHA256-250000',cipher:'AES-256-GCM',salt:Array.from(salt),iv:Array.from(iv),data:Array.from(new Uint8Array(cipher))};
  download(`WoundAI-encrypted-backup-${new Date().toISOString().slice(0,10)}.woundai`,JSON.stringify(pack),'application/json');
  $('#stage9Status').textContent='فایل پشتیبان رمزنگاری‌شده ساخته شد. عبارت عبور را امن نگه دارید؛ بدون آن بازیابی ممکن نیست.';
 }catch(e){$('#stage9Status').textContent='ساخت پشتیبان ناموفق بود: '+e.message}
});
$('#importEncryptedBackup')?.addEventListener('change',async e=>{
 const f=e.target.files?.[0];if(!f)return;const pass=$('#vaultPassphrase').value;
 if(pass.length<12){toast('ابتدا عبارت عبور حداقل ۱۲ نویسه‌ای را وارد کنید.');e.target.value='';return}
 try{
  const pack=JSON.parse(await f.text());if(pack.format!=='WoundAI-Encrypted-Backup-v1')throw Error('قالب فایل معتبر نیست.');
  const key=await stage9Key(pass,new Uint8Array(pack.salt));
  const plain=await crypto.subtle.decrypt({name:'AES-GCM',iv:new Uint8Array(pack.iv)},key,new Uint8Array(pack.data));
  const obj=JSON.parse(new TextDecoder().decode(plain)),s=obj.state;
  if(obj.app!=='WoundAI'||!s||!Array.isArray(s.patients)||!Array.isArray(s.wounds)||!Array.isArray(s.assessments)||!Array.isArray(s.images))throw Error('ساختار اطلاعات پشتیبان معتبر نیست.');
  if(!confirm('بازیابی، اطلاعات فعلی را با اطلاعات فایل جایگزین می‌کند. ادامه می‌دهید؟'))return;
  state.patients=s.patients;state.wounds=s.wounds;state.assessments=s.assessments;state.images=s.images;state.aiModel=s.aiModel||null;
  if(!persist())throw Error('ذخیره‌سازی اطلاعات بازیابی‌شده ناموفق بود.');
  if(obj.identity)localStorage.setItem(LOCAL_ID_KEY,JSON.stringify(obj.identity));
  load();renderPatients();fillReportPatients();stage9Identity();
  $('#stage9Status').textContent='بازیابی فایل رمزنگاری‌شده با موفقیت انجام شد.';
 }catch(err){$('#stage9Status').textContent='بازیابی ناموفق بود؛ عبارت عبور یا سلامت فایل را بررسی کنید.'}
 finally{e.target.value=''}
});
try{stage9Identity()}catch(e){}

// ===== Stage 10: runtime self-test and PWA install affordance =====
let stage10InstallPrompt=null;
window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();stage10InstallPrompt=e;$('#installPwaBtn').disabled=false;$('#pwaInstallStatus').textContent='این مرورگر امکان نصب برنامه را فراهم کرده است.'});
$('#installPwaBtn')?.addEventListener('click',async()=>{
 if(!stage10InstallPrompt){$('#pwaInstallStatus').textContent='از منوی مرورگر گزینه Add to Home Screen / Install app را انتخاب کنید.';return}
 stage10InstallPrompt.prompt();const result=await stage10InstallPrompt.userChoice;$('#pwaInstallStatus').textContent=result.outcome==='accepted'?'درخواست نصب پذیرفته شد.':'نصب لغو شد.';stage10InstallPrompt=null;$('#installPwaBtn').disabled=true;
});
$('#runFinalTests')?.addEventListener('click',async()=>{
 const checks=[];
 const add=(name,ok,detail='')=>checks.push({name,ok,detail});
 add('ساختار صفحات اصلی', ['dashboard','patients','imaging','ai','clinical','careplan','reports','security','finaltest'].every(p=>document.querySelector(`#page-${p}`)));
 add('فرم ثبت بیمار',!!$('#patientForm')&&!!$('#pName')&&!!$('#pCode'));
 add('فرم ثبت زخم',!!$('#woundForm')&&!!$('#wSite'));
 add('کنترل تصویربرداری',!!$('#capturePhoto')&&!!$('#saveImageRecord')&&!!$('#drawCanvas'));
 add('فرم ارزیابی بالینی',!!$('#saveClinical')&&!!$('#assessmentWound'));
 add('ماژول ANN',!!$('#trainAnnBtn')&&!!$('#runAnnBtn')&&typeof trainANN==='function');
 add('تولید برنامه مراقبتی',!!$('#stage7Generate')&&typeof stage7Generate==='function');
 add('گزارش PNG و PDF',!!$('#downloadWoundReportPng')&&!!$('#downloadWoundReportPdf')&&!!$('#downloadFullHistoryPdf'));
 add('ذخیره‌سازی محلی',(()=>{try{const k='woundai.selftest';localStorage.setItem(k,'1');localStorage.removeItem(k);return true}catch(e){return false}})());
 add('Web Crypto',!!(window.crypto&&crypto.subtle));
 add('Service Worker',('serviceWorker' in navigator));
 add('دوربین / API',!!(navigator.mediaDevices&&navigator.mediaDevices.getUserMedia),'برای تأیید واقعی، مجوز دوربین و محیط HTTPS لازم است.');
 add('نصب PWA',!!document.querySelector('link[rel="manifest"]')&&'serviceWorker' in navigator,'قابلیت نصب نهایی به HTTPS و manifest معتبر وابسته است.');
 $('#finalTestResults').innerHTML=checks.map(x=>`<div class="final-test-row"><b>${x.ok?'✓':'!'}</b><span>${reportEsc(x.name)}${x.detail?`<small>${reportEsc(x.detail)}</small>`:''}</span><em class="${x.ok?'pass':'warn'}">${x.ok?'موجود':'بررسی لازم'}</em></div>`).join('')+`<p class="micro-note">این آزمون وجود API و اتصال اجزا را بررسی می‌کند؛ جایگزین تست واقعی دوربین، لمس، نصب، بازیابی یا آزمون امنیتی نیست.</p>`;
});

// ===== Stage 2: Patient record lifecycle =====
let editingPatientId=null;
function openPatientEditor(patientId=null){
 editingPatientId=patientId;
 const p=patientId?state.patients.find(x=>x.id===patientId):null;
 if(patientId&&!p){toast('پرونده بیمار پیدا نشد.');return;}
 $('#patientForm').reset();
 pendingPatientPhoto=p?.photo||'';
 $('#pPhoto').value='';
 showPatientPhoto(p?.photo||'');
 for(const [id,key] of Object.entries({pName:'name',pCode:'code',pDob:'dob',pSex:'sex',pDiabetes:'diabetes',pVascular:'vascular',pPhone:'phone',pEmergency:'emergencyContact',pAllergies:'allergies',pMedications:'medications',pHistory:'history'})){
  const el=$('#'+id);if(el)el.value=p?.[key]|| (id==='pSex'||id==='pDiabetes'||id==='pVascular'?'unknown':'');
 }
 $('#pConsent').checked=!!p?.consent;
 $('#modalTitle').textContent=p?'ویرایش پرونده بیمار':'ثبت بیمار جدید';
 $('#modalBackdrop').hidden=false;
 $('#pName').focus();
}
$('#newPatientBtn').onclick=()=>openPatientEditor();
$('#addPatientBtn').onclick=()=>openPatientEditor();
$('#quickPatient').onclick=()=>openPatientEditor();
$('#patientForm').onsubmit=e=>{
 e.preventDefault();
 const name=$('#pName').value.trim();
 if(!name){toast('نام بیمار الزامی است.');$('#pName').focus();return;}
 const existing=editingPatientId?state.patients.find(x=>x.id===editingPatientId):null;
 const code=$('#pCode').value.trim()||existing?.code||'WA-'+Date.now().toString().slice(-7);
 if(state.patients.some(x=>String(x.code).toLowerCase()===code.toLowerCase()&&x.id!==editingPatientId)){toast('این کد پرونده قبلاً ثبت شده است.');$('#pCode').focus();return;}
 const fields={name,code,dob:$('#pDob').value,sex:$('#pSex').value,diabetes:$('#pDiabetes').value,vascular:$('#pVascular').value,phone:$('#pPhone').value.trim(),emergencyContact:$('#pEmergency').value.trim(),allergies:$('#pAllergies').value.trim(),medications:$('#pMedications').value.trim(),history:$('#pHistory').value.trim(),photo:pendingPatientPhoto||'',consent:$('#pConsent').checked,updated:new Date().toISOString()};
 if(existing){Object.assign(existing,fields);}
 else state.patients.push({id:id(),...fields,created:new Date().toISOString(),status:'active'});
 if(!persist()){if(!existing)state.patients.pop();return;}
 closeModal();renderPatients();renderStats();populateImagePatientSelect();goto('patients');
 toast(existing?'اطلاعات پرونده به‌روزرسانی شد.':'پرونده بیمار ذخیره شد.');
 editingPatientId=null;
};

// ===== v18.1: guided patient-to-follow-up workflow =====
// Successful saves advance to the next relevant page and carry the selected
// patient/wound forward. Users never need to dismiss a dialog to continue.
const woundaiFlow={patientId:null,woundId:null,enabled:false};
function woundaiSelectPatientAndWound(){
 const pid=woundaiFlow.patientId,wid=woundaiFlow.woundId;
 if(!pid)return;
 populateImagePatientSelect();
 if($('#imagePatientSelect')){$('#imagePatientSelect').value=pid;populateImageWoundSelect();}
 if($('#imageWoundSelect')&&wid)$('#imageWoundSelect').value=wid;
 if($('#assessmentWound')){refreshAssessmentWounds();$('#assessmentWound').value=wid||'';selectedWoundId=wid||null;syncMeasurementToClinical(wid);}
 if($('#stage7Patient')){$('#stage7Patient').value=pid;stage7PopulateWounds();if($('#stage7Wound'))$('#stage7Wound').value=wid||'';}
 if($('#reportPatient')){fillReportPatients();$('#reportPatient').value=pid;$('#reportWound')?.dispatchEvent(new Event('change'));}
}
function woundaiAdvance(page,message){
 woundaiSelectPatientAndWound();
 goto(page);
 woundaiSelectPatientAndWound();
 if(message)toast(message);
}
const woundaiPatientSubmitOriginal=$('#patientForm')?.onsubmit;
if(woundaiPatientSubmitOriginal){
 $('#patientForm').onsubmit=function(e){
  const count=state.patients.length;
  woundaiPatientSubmitOriginal.call(this,e);
  if(state.patients.length>count){
   const p=state.patients[state.patients.length-1];
   woundaiFlow.patientId=p.id;woundaiFlow.woundId=null;woundaiFlow.enabled=true;
   // The patient form closes itself after a successful save; immediately
   // continue to wound registration instead of returning to the dashboard.
   goto('patients');
   setTimeout(()=>addWound(p.id),80);
  }
 };
}
const woundaiWoundSubmitOriginal=$('#woundForm')?.onsubmit;
if(woundaiWoundSubmitOriginal){
 $('#woundForm').onsubmit=function(e){
  const count=state.wounds.length;
  woundaiWoundSubmitOriginal.call(this,e);
  if(state.wounds.length>count){
   const w=state.wounds[state.wounds.length-1];
   woundaiFlow.patientId=w.patientId;woundaiFlow.woundId=w.id;woundaiFlow.enabled=true;
   woundaiAdvance('imaging','زخم ثبت شد؛ مرحله تصویربرداری باز شد.');
  }
 };
}
// Image save is async. Advance only if a new image record was actually persisted.
$('#saveImageRecord')?.addEventListener('click',()=>{
 const before=state.images.length;
 setTimeout(()=>{
  if(state.images.length>before&&woundaiFlow.enabled){
   woundaiAdvance('clinical','تصویر ذخیره شد؛ اکنون ارزیابی بالینی را تکمیل کنید.');
  }
 },250);
});
// Advance after a successful clinical assessment save (not on validation errors).
$('#saveClinical')?.addEventListener('click',()=>{
 const before=state.assessments.length;
 setTimeout(()=>{
  const added=state.assessments.slice(before).some(a=>a.kind==='clinical-assessment'&&a.woundId===woundaiFlow.woundId);
  if(added&&woundaiFlow.enabled){
   woundaiAdvance('careplan','ارزیابی ذخیره شد؛ مرحله برنامه مراقبتی باز شد.');
  }
 },80);
});
// Once a draft or clinician-approved care plan is saved, continue to reports.
['stage7SaveDraft','stage7Approve'].forEach(id=>{
 $('#'+id)?.addEventListener('click',()=>{
  const before=state.assessments.length;
  setTimeout(()=>{
   const added=state.assessments.length>before;
   if(added&&woundaiFlow.enabled)woundaiAdvance('reports','برنامه مراقبتی ذخیره شد؛ گزارش پرونده آماده است.');
  },100);
 });
});

function viewPatientRecord(patientId){
 const p=state.patients.find(x=>x.id===patientId);if(!p)return;
 const wounds=state.wounds.filter(w=>w.patientId===p.id);
 const safe=v=>esc(v||'ثبت نشده');
 const panel=`<div class="patient-detail-overlay" id="patientDetailOverlay"><section class="patient-detail-panel"><div class="panel-head"><div><p class="eyebrow teal">PATIENT RECORD</p><h2>${esc(p.name)}</h2><small>کد پرونده: ${esc(p.code)}</small></div><button class="icon-btn" id="closePatientDetail" type="button">×</button></div>
 ${p.photo?`<img class="patient-detail-photo" src="${p.photo}" alt="عکس بیمار">`:''}
 <div class="patient-detail-grid">
 <div><small>تاریخ تولد</small><b>${safe(p.dob)}</b></div><div><small>جنس</small><b>${safe(p.sex)}</b></div>
 <div><small>دیابت</small><b>${safe(p.diabetes)}</b></div><div><small>بیماری عروقی / PAD</small><b>${safe(p.vascular)}</b></div>
 <div><small>شماره تماس</small><b>${safe(p.phone)}</b></div><div><small>تماس ضروری</small><b>${safe(p.emergencyContact)}</b></div>
 <div class="wide"><small>آلرژی‌ها و واکنش</small><b>${safe(p.allergies)}</b></div>
 <div class="wide"><small>داروهای مصرفی</small><b>${safe(p.medications)}</b></div>
 <div class="wide"><small>سوابق پزشکی و جراحی</small><b>${safe(p.history)}</b></div></div>
 <h3>زخم‌های ثبت‌شده (${wounds.length})</h3>
 ${wounds.length?wounds.map(w=>`<div class="patient-detail-wound"><b>${esc(w.site||'محل ثبت نشده')}</b><span>${esc(w.etiology||'اتیولوژی نامشخص')}</span><small>ارزیابی‌ها: ${state.assessments.filter(a=>a.woundId===w.id).length}</small></div>`).join(''):'<p class="muted">هنوز زخمی برای این پرونده ثبت نشده است.</p>'}
 <div class="modal-actions"><button class="secondary-btn" id="detailDeletePatient" type="button" ${lang==='fa'?'':'hidden'}>حذف بیمار</button><button class="secondary-btn" id="detailEditPatient" type="button">ویرایش پرونده</button><button class="primary-btn" id="detailAddWound" type="button">افزودن زخم</button></div>
 <small class="security-warning">نسخه توسعه‌ای: داده‌ها فقط در همین مرورگر ذخیره می‌شوند. برای اطلاعات واقعی بیمار از این نسخه استفاده نکنید.</small></section></div>`;
 document.querySelector('#patientDetailOverlay')?.remove();
 document.body.insertAdjacentHTML('beforeend',panel);
 $('#closePatientDetail').onclick=()=>$('#patientDetailOverlay').remove();
 $('#patientDetailOverlay').addEventListener('click',e=>{if(e.target.id==='patientDetailOverlay')e.currentTarget.remove()});
 $('#detailEditPatient').onclick=()=>{$('#patientDetailOverlay').remove();openPatientEditor(patientId)};
 $('#detailAddWound').onclick=()=>{$('#patientDetailOverlay').remove();addWound(patientId)};
 $('#detailDeletePatient').onclick=()=>deletePatientRecord(patientId);
}
function deletePatientRecord(patientId){
 if(lang!=='fa')return;
 const patient=state.patients.find(p=>p.id===patientId);if(!patient)return;
 const relatedWounds=state.wounds.filter(w=>w.patientId===patientId);
 const message=`آیا از حذف دائمی پرونده «${patient.name}» و ${relatedWounds.length} زخم مرتبط و همه ارزیابی‌ها و تصاویر آن مطمئن هستید؟\nاین کار قابل بازگشت نیست. پیش از حذف، پشتیبان JSON بگیرید.`;
 if(!window.confirm(message))return;
 const previous={patients:state.patients,wounds:state.wounds,assessments:state.assessments,images:state.images};
 const woundIds=new Set(relatedWounds.map(w=>w.id));
 state.patients=state.patients.filter(p=>p.id!==patientId);
 state.wounds=state.wounds.filter(w=>w.patientId!==patientId);
 state.assessments=state.assessments.filter(x=>x.patientId!==patientId&&!woundIds.has(x.woundId));
 state.images=state.images.filter(x=>x.patientId!==patientId&&!woundIds.has(x.woundId));
 if(!persist()){Object.assign(state,previous);renderStats();toast('حذف انجام نشد؛ ذخیره‌سازی ناموفق بود.');return;}
 document.querySelector('#patientDetailOverlay')?.remove();
 renderPatients();toast('پرونده بیمار و سوابق وابسته حذف شد.');
}
document.addEventListener('click',e=>{
 const del=e.target.closest('[data-delete-patient]');if(del){deletePatientRecord(del.dataset.deletePatient);return;}
});
document.addEventListener('click',e=>{
 const edit=e.target.closest('[data-edit-patient]');if(edit){openPatientEditor(edit.dataset.editPatient);return;}
 const view=e.target.closest('[data-view-patient]');if(view){viewPatientRecord(view.dataset.viewPatient);return;}
});

// Stage 3: refresh patient/wound selectors whenever imaging page is opened.
document.addEventListener('click',e=>{const nav=e.target.closest('[data-page="imaging"],[data-goto="imaging"]');if(nav)setTimeout(populateImagePatientSelect,0)});
window.addEventListener('load',()=>{populateImagePatientSelect();});
