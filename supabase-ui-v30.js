/* WoundAI v30.7 cloud connection, member, backup and offline-image UI. */
(function () {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const client = window.WoundAISupabase;
  if (!client) return;
  let factorId = null;
  let challengeId = null;
  let enrollMode = false;
  let clinicMemberships = [];
  const fa = {
    supabaseConfigSaved: 'تنظیمات عمومی اتصال ذخیره شد؛ کلید service_role استفاده نشده است.',
    notConfigured: 'اتصال پیکربندی نشده است.', signedOut: 'وارد نشده‌اید.',
    signedIn: 'ورود انجام شد.', mfaRequired: 'برای عملیات نوشتن، MFA سطح AAL2 را تأیید کنید.',
    mfaReady: 'نشست MFA سطح AAL2 تأیید شد.', mfaEnroll: 'عامل TOTP ایجاد شد. QR را اسکن و سپس کد را تأیید کنید.',
    mfaChallenge: 'کد تأیید ارسال شد؛ کد Authenticator را وارد کنید.',
    clinicsLoaded: 'فهرست مرکزها بارگذاری شد.', noClinics: 'عضویتی برای این حساب ثبت نشده است.',
    clinicCreated: 'مرکز ایجاد شد و حساب فعلی مالک آن است.',
    patientsLoaded: 'پرونده‌های ابری بارگذاری شدند.',
    noPatients: 'برای این مرکز پرونده ابری ثبت نشده است.',
    connectionError: 'خطا: ',
  };
  const en = {
    supabaseConfigSaved: 'Public connection settings saved; no service_role key is used.',
    notConfigured: 'Cloud connection is not configured.', signedOut: 'Signed out.',
    signedIn: 'Signed in.', mfaRequired: 'Verify MFA AAL2 before write operations.',
    mfaReady: 'MFA AAL2 session verified.', mfaEnroll: 'TOTP factor created. Scan the QR and verify the code.',
    mfaChallenge: 'Verification code sent; enter your authenticator code.',
    clinicsLoaded: 'Clinic memberships loaded.', noClinics: 'No clinic memberships found for this account.',
    clinicCreated: 'Clinic created; this account is its owner.',
    patientsLoaded: 'Cloud patient records loaded.', noPatients: 'No cloud patient records for this clinic.',
    connectionError: 'Error: '
  };
  const staticFa = {
    cloudBackendTitle:'اتصال امن به فضای ابری مرکز', cloudDescription:'زیرساخت احراز هویت، عضویت مرکز و پایگاه داده مرکزی. اطلاعات محلی در این نسخه خودکار منتقل یا همگام نمی‌شوند.',
    projectUrl:'نشانی پروژه Supabase', publicKey:'کلید عمومی Publishable / Anon', saveConfig:'ذخیره تنظیمات اتصال', email:'ایمیل حساب', password:'گذرواژه',
    signIn:'ورود امن', signOut:'خروج', mfaTitle:'تأیید دومرحله‌ای (MFA)', enrollMfa:'فعال‌سازی Authenticator', challengeMfa:'ارسال کد تأیید',
    mfaCode:'کد شش‌رقمی', verifyMfa:'تأیید کد', clinicTitle:'مرکز درمانی و عضویت', clinicSelect:'مرکزهای قابل دسترس', newClinic:'ایجاد مرکز جدید',
    refreshClinics:'بارگذاری مرکزها', createClinic:'ایجاد مرکز و مالکیت', loadCloudPatients:'آزمایش خواندن پرونده‌های ابری',
    cloudAuthConfigurable:'زیرساخت ورود ابری (نیازمند تنظیم پروژه)', cloudDataNotReady:'مهاجرت داده محلی و رمزنگاری برنامه‌ای'
  };
  const staticEn = {
    cloudBackendTitle:'Secure clinic cloud connection', cloudDescription:'Authentication, clinic membership and central database foundation. Local records are not automatically migrated or synchronized in this release.',
    projectUrl:'Supabase project URL', publicKey:'Public Publishable / Anon key', saveConfig:'Save connection settings', email:'Account email', password:'Password',
    signIn:'Sign in securely', signOut:'Sign out', mfaTitle:'Multi-factor authentication (MFA)', enrollMfa:'Set up Authenticator', challengeMfa:'Send verification code',
    mfaCode:'Six-digit code', verifyMfa:'Verify code', clinicTitle:'Clinic and membership', clinicSelect:'Available clinics', newClinic:'Create a new clinic',
    refreshClinics:'Load clinics', createClinic:'Create clinic and become owner', loadCloudPatients:'Test reading cloud patient records',
    cloudAuthConfigurable:'Cloud sign-in foundation (project setup required)', cloudDataNotReady:'Local data migration and application-level encryption'
  };
  function translateStatic() {
    const dictionary = document.documentElement.lang === 'en' ? staticEn : staticFa;
    document.querySelectorAll('[data-cloud-i18n]').forEach(el => {
      const value = dictionary[el.dataset.cloudI18n]; if (value) el.textContent = value;
    });
  }
  function t(key) { return (document.documentElement.lang === 'en' ? en : fa)[key] || fa[key] || key; }
  function status(id, message, bad = false) {
    const el = $(id); if (!el) return;
    el.textContent = message; el.classList.toggle('status-error', !!bad);
  }
  function busy(button, value) { if (button) button.disabled = value; }
  function sessionUI() {
    const signed = client.authenticated();
    window.dispatchEvent(new CustomEvent('woundai:cloud-session-changed',{detail:{signed,aal2:client.getAal()==='aal2'}}));
    $('cloudSignOut').disabled = !signed;
    $('cloudEnrollMfa').disabled = !signed;
    $('cloudChallengeMfa').disabled = !signed;
    $('cloudRefreshClinics').disabled = !signed;
    $('cloudCreateClinic').disabled = !signed;
    $('cloudLoadPatients').disabled = !signed || !$('cloudClinicSelect').value;
    $('cloudVerifyMfa').disabled = !signed || !challengeId;
    const clinicId=$('cloudClinicSelect')?.value;
    const selectedMembership=clinicMemberships.find(x=>x.clinic_id===clinicId);
    const role=selectedMembership?.role||null;
    const aal2=client.getAal()==='aal2';
    if($('cloudMembersLoad'))$('cloudMembersLoad').disabled=!signed||!clinicId;
    if($('cloudMemberApply'))$('cloudMemberApply').disabled=!signed||!clinicId||!aal2||!['owner','admin'].includes(role);
    if($('cloudMemberRemove'))$('cloudMemberRemove').disabled=!signed||!clinicId||!aal2||!['owner','admin'].includes(role);
    if($('cloudCreateBackup'))$('cloudCreateBackup').disabled=!signed||!clinicId||!aal2||!['owner','admin'].includes(role);
    if($('cloudRefreshBackups'))$('cloudRefreshBackups').disabled=!signed||!clinicId;
    if($('cloudRestoreBackup'))$('cloudRestoreBackup').disabled=!signed||!clinicId||!aal2||role!=='owner';
    if($('cloudSyncFlushImages'))$('cloudSyncFlushImages').disabled=!signed||!clinicId||!aal2;
    if (signed) {
      const info = client.getSessionInfo();
      status('cloudAuthStatus', `${t('signedIn')} ${info?.user?.email || ''} · ${info?.aal || 'aal1'}`);
      status('cloudMfaStatus', info?.aal === 'aal2' ? t('mfaReady') : t('mfaRequired'), info?.aal !== 'aal2');
    } else {
      status('cloudAuthStatus', t('signedOut'));
      status('cloudMfaStatus', '');
    }
  }
  async function refreshClinics() {
    const rows = await client.listClinicMemberships();
    clinicMemberships = rows;
    const select = $('cloudClinicSelect');
    select.replaceChildren(new Option('— انتخاب مرکز —', ''));
    for (const row of rows) {
      const clinic = row.clinics;
      if (clinic?.id) select.add(new Option(`${clinic.name} · ${row.role}`, clinic.id));
    }
    select.disabled = !rows.length;
    $('cloudLoadPatients').disabled = !rows.length;
    status('cloudClinicStatus', rows.length ? `${t('clinicsLoaded')} (${rows.length})` : t('noClinics'), !rows.length);
    return rows;
  }
  $('saveSupabaseConfig')?.addEventListener('click', () => {
    try {
      const config = client.configure({ url: $('supabaseProjectUrl').value.trim(), publishableKey: $('supabasePublishableKey').value.trim() });
      status('supabaseConfigStatus', t('supabaseConfigSaved'));
      $('supabaseProjectUrl').value = config.url;
    } catch (error) { status('supabaseConfigStatus', error.message, true); }
  });
  $('cloudSignIn')?.addEventListener('click', async () => {
    const button = $('cloudSignIn'); busy(button, true);
    try {
      const result = await client.signIn($('cloudEmail').value, $('cloudPassword').value);
      if (result?.mfaRequired) status('cloudMfaStatus', t('mfaRequired'), true);
      sessionUI();
      if (client.authenticated()) await refreshClinics();
    } catch (error) { status('cloudAuthStatus', t('connectionError') + error.message, true); }
    finally { busy(button, false); }
  });
  $('cloudSignOut')?.addEventListener('click', async () => {
    await client.signOut(); factorId = challengeId = null; clinicMemberships=[]; sessionUI();
    $('cloudClinicSelect').replaceChildren(new Option('ابتدا وارد شوید', ''));
    $('cloudPatientPreview').replaceChildren();
    status('cloudClinicStatus', '');
  });
  $('cloudEnrollMfa')?.addEventListener('click', async () => {
    try {
      const result = await client.enrollTotp();
      factorId = result.id; enrollMode = true; challengeId = null;
      $('cloudMfaEnrollment').hidden = false;
      $('cloudMfaQr').src = result.totp?.qr_code || '';
      $('cloudMfaSecret').textContent = result.totp?.secret ? `Secret: ${result.totp.secret}` : '';
      const challenge = await client.challengeFactor(factorId);
      challengeId = challenge.id;
      $('cloudVerifyMfa').disabled = false;
      status('cloudMfaStatus', t('mfaEnroll'));
    } catch (error) { status('cloudMfaStatus', t('connectionError') + error.message, true); }
  });
  $('cloudChallengeMfa')?.addEventListener('click', async () => {
    try {
      const factors = await client.listFactors();
      const totp = (factors?.all || factors?.totp || []).filter(x => x.factor_type === 'totp' && x.status === 'verified');
      if (!totp.length) { status('cloudMfaStatus', 'ابتدا عامل TOTP را فعال کنید.', true); return; }
      factorId = totp[0].id; enrollMode = false;
      const challenge = await client.challengeFactor(factorId); challengeId = challenge.id;
      $('cloudVerifyMfa').disabled = false;
      status('cloudMfaStatus', t('mfaChallenge'));
    } catch (error) { status('cloudMfaStatus', t('connectionError') + error.message, true); }
  });
  $('cloudVerifyMfa')?.addEventListener('click', async () => {
    try {
      const code = $('cloudMfaCode').value.trim();
      if (!/^\d{6,8}$/.test(code) || !factorId || !challengeId) throw new Error('کد معتبر و درخواست تأیید لازم است.');
      await client.verifyFactor(factorId, challengeId, code);
      challengeId = null; $('cloudMfaCode').value = '';
      sessionUI(); await refreshClinics();
      status('cloudMfaStatus', client.getAal() === 'aal2' ? t('mfaReady') : 'نشست هنوز به سطح AAL2 نرسیده است.', client.getAal() !== 'aal2');
    } catch (error) { status('cloudMfaStatus', t('connectionError') + error.message, true); }
  });
  $('cloudRefreshClinics')?.addEventListener('click', async () => {
    try { await refreshClinics(); } catch (error) { status('cloudClinicStatus', t('connectionError') + error.message, true); }
  });
  $('cloudCreateClinic')?.addEventListener('click', async () => {
    try {
      if (client.getAal() !== 'aal2') throw new Error('برای ایجاد مرکز، ابتدا MFA را تأیید کنید.');
      await client.createClinic($('cloudClinicName').value);
      $('cloudClinicName').value = ''; await refreshClinics();
      status('cloudClinicStatus', t('clinicCreated'));
    } catch (error) { status('cloudClinicStatus', t('connectionError') + error.message, true); }
  });
  $('cloudClinicSelect')?.addEventListener('change', () => { $('cloudLoadPatients').disabled = !client.authenticated() || !$('cloudClinicSelect').value; });
  $('cloudLoadPatients')?.addEventListener('click', async () => {
    const button = $('cloudLoadPatients'); busy(button, true);
    try {
      const rows = await client.listPatients($('cloudClinicSelect').value);
      const host = $('cloudPatientPreview'); host.replaceChildren();
      if (!rows.length) host.textContent = t('noPatients');
      else {
        const list = document.createElement('ul');
        for (const row of rows) {
          const item = document.createElement('li');
          item.textContent = `${row.record_code} · ${row.full_name} · ${row.status}`;
          list.append(item);
        }
        host.append(list);
      }
      status('cloudClinicStatus', `${t('patientsLoaded')} (${rows.length})`);
    } catch (error) { status('cloudClinicStatus', t('connectionError') + error.message, true); }
    finally { busy(button, false); }
  });
  async function loadMembers() {
    const clinicId=$('cloudClinicSelect').value;
    const rows=await client.listClinicMembers(clinicId);
    const host=$('cloudMembersList'); host.replaceChildren();
    if(!rows.length){host.textContent='عضوی برای این مرکز ثبت نشده است.';return rows;}
    const list=document.createElement('ul');
    for(const row of rows){
      const item=document.createElement('li');
      item.textContent=`${row.user_id} · ${row.role} · ${row.created_at?new Date(row.created_at).toLocaleDateString():''}`;
      list.append(item);
    }
    host.append(list);
    status('cloudMembersStatus',`اعضا بارگذاری شدند: ${rows.length}`);
    return rows;
  }
  $('cloudMembersLoad')?.addEventListener('click',async()=>{
    try{busy($('cloudMembersLoad'),true);await loadMembers();}
    catch(error){status('cloudMembersStatus',t('connectionError')+error.message,true);}
    finally{busy($('cloudMembersLoad'),false);sessionUI();}
  });
  $('cloudMemberApply')?.addEventListener('click',async()=>{
    try{
      const userId=$('cloudMemberUserId').value.trim(),role=$('cloudMemberRole').value;
      await client.manageClinicMember($('cloudClinicSelect').value,userId,role,false);
      await loadMembers();status('cloudMembersStatus','نقش عضو با موفقیت ثبت شد.');
    }catch(error){status('cloudMembersStatus',t('connectionError')+error.message,true);}
  });
  $('cloudMemberRemove')?.addEventListener('click',async()=>{
    try{
      const userId=$('cloudMemberUserId').value.trim();
      if(!confirm('عضویت این کاربر از مرکز حذف شود؟'))return;
      await client.manageClinicMember($('cloudClinicSelect').value,userId,null,true);
      await loadMembers();status('cloudMembersStatus','عضویت حذف شد.');
    }catch(error){status('cloudMembersStatus',t('connectionError')+error.message,true);}
  });
  async function loadBackups(){
    const rows=await client.listClinicBackups($('cloudClinicSelect').value);
    const select=$('cloudBackupSelect');select.replaceChildren(new Option('— انتخاب پشتیبان —',''));
    for(const row of rows){
      const counts=row.record_counts||{};
      const total=Object.values(counts).reduce((a,b)=>a+(Number(b)||0),0);
      const date=row.created_at?new Date(row.created_at).toLocaleString():'';
      select.add(new Option(`${date} · ${total} رکورد · ${row.id}`,row.id));
    }
    status('cloudBackupStatus',`نسخه‌های پشتیبان: ${rows.length}`);
    return rows;
  }
  $('cloudCreateBackup')?.addEventListener('click',async()=>{
    try{
      if(!confirm('یک Snapshot منطقی از اطلاعات این مرکز ساخته شود؟'))return;
      busy($('cloudCreateBackup'),true);
      const result=await client.createClinicBackup($('cloudClinicSelect').value);
      status('cloudBackupStatus',`پشتیبان ساخته شد: ${result.id}`);
      await loadBackups();
      $('cloudBackupSelect').value=result.id;
    }catch(error){status('cloudBackupStatus',t('connectionError')+error.message,true);}
    finally{busy($('cloudCreateBackup'),false);sessionUI();}
  });
  $('cloudRefreshBackups')?.addEventListener('click',async()=>{
    try{busy($('cloudRefreshBackups'),true);await loadBackups();}
    catch(error){status('cloudBackupStatus',t('connectionError')+error.message,true);}
    finally{busy($('cloudRefreshBackups'),false);sessionUI();}
  });
  $('cloudRestoreBackup')?.addEventListener('click',async()=>{
    try{
      const backupId=$('cloudBackupSelect').value,confirmation=$('cloudBackupConfirm').value.trim();
      if(!backupId)throw new Error('ابتدا نسخه پشتیبان را انتخاب کنید.');
      if(!confirm('بازیابی فقط رکوردهای مفقود را درج می‌کند. ادامه می‌دهید؟'))return;
      busy($('cloudRestoreBackup'),true);
      const result=await client.restoreClinicBackup($('cloudClinicSelect').value,backupId,confirmation);
      status('cloudBackupStatus',`بازیابی انجام شد. حالت: ${result.mode||'insert-missing-only'}`);
      $('cloudBackupConfirm').value='';
    }catch(error){status('cloudBackupStatus',t('connectionError')+error.message,true);}
    finally{busy($('cloudRestoreBackup'),false);sessionUI();}
  });
  $('cloudSyncFlushImages')?.addEventListener('click',async()=>{
    try{
      const store=window.WoundAIOfflineImages;
      if(!store)throw new Error('فضای ذخیره‌سازی آفلاین بارگذاری نشده است.');
      busy($('cloudSyncFlushImages'),true);
      const result=await store.flush(client);
      status('cloudOfflineQueueStatus',`تصاویر ارسال‌شده: ${result.uploaded} · باقی‌مانده در صف: ${result.remaining}`);
    }catch(error){status('cloudOfflineQueueStatus',t('connectionError')+error.message,true);}
    finally{busy($('cloudSyncFlushImages'),false);sessionUI();}
  });
  $('cloudClinicSelect')?.addEventListener('change',()=>{sessionUI();});
  $('cloudBackupSelect')?.addEventListener('change',()=>{
    const id=$('cloudBackupSelect').value;
    $('cloudBackupConfirm').placeholder=id?`RESTORE-${id}`:'RESTORE-شناسه پشتیبان';
  });
  if(window.WoundAIOfflineImages){
    window.WoundAIOfflineImages.pendingCount().then(n=>{
      status('cloudOfflineQueueStatus',`تصاویر در صف ارسال: ${n}`);
    }).catch(error=>status('cloudOfflineQueueStatus',error.message,true));
  }

  // Restore public config fields only; auth tokens remain in sessionStorage, never localStorage.
  if (client.config) {
    $('supabaseProjectUrl').value = client.config.url;
    $('supabasePublishableKey').value = client.config.publishableKey;
    status('supabaseConfigStatus', 'تنظیمات اتصال بارگذاری شد.');
  }
  translateStatic();
  new MutationObserver(translateStatic).observe(document.documentElement, { attributes: true, attributeFilter: ['lang'] });
  sessionUI();
  if (client.authenticated()) refreshClinics().catch(error => status('cloudClinicStatus', t('connectionError') + error.message, true));
})();
