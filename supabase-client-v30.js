/* WoundAI v30.7 — Supabase Auth + PostgREST client.
 * Adds version-aware updates, member administration and logical backup RPCs.
 * Clinical form sync remains explicit; no background clinical sync is claimed.
 */
(function (global) {
  'use strict';
  const CONFIG_KEY = 'woundai.supabase.config.v1';
  const SESSION_KEY = 'woundai.supabase.session.v1';
  const MAX_RESPONSE_BYTES = 5 * 1024 * 1024;

  function decodeJwtPayload(token) {
    try {
      const part = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
      return JSON.parse(atob(part.padEnd(Math.ceil(part.length / 4) * 4, '=')));
    } catch { return null; }
  }
  function validateConfig(config) {
    if (!config || typeof config.url !== 'string' || typeof config.publishableKey !== 'string') {
      throw new Error('پیکربندی Supabase ناقص است.');
    }
    const url = new URL(config.url);
    if (url.username || url.password || url.search || url.hash || (url.pathname !== '/' && url.pathname !== '')) throw new Error('نشانی پروژه نامعتبر است؛ فقط ریشه Project URL را وارد کنید.');
    const local = ['localhost', '127.0.0.1'].includes(url.hostname);
    if (url.protocol !== 'https:' && !(local && url.protocol === 'http:')) {
      throw new Error('برای سرور غیرمحلی، HTTPS الزامی است.');
    }
    if (!config.publishableKey.trim()) throw new Error('کلید Publishable/Anon را وارد کنید.');
    const claims = config.publishableKey.split('.').length === 3 ? decodeJwtPayload(config.publishableKey) : null;
    if (claims?.role && claims.role !== 'anon') throw new Error('فقط کلید عمومی anon یا Publishable مجاز است.');
    if (config.publishableKey.startsWith('sb_secret_')) throw new Error('کلید Secret در مرورگر ممنوع است.');
    return { url: url.origin, publishableKey: config.publishableKey.trim() };
  }
  class WoundAISupabaseClient {
    constructor() {
      this.config = null;
      this.session = null;
      try { this.session = JSON.parse(sessionStorage.getItem(SESSION_KEY) || 'null'); } catch { this.session = null; }
      try {
        const stored = JSON.parse(localStorage.getItem(CONFIG_KEY) || 'null') || global.WOUNDAI_SUPABASE_CONFIG;
        if (stored?.url && stored?.publishableKey) this.config = validateConfig(stored);
      } catch { this.config = null; }
    }
    configure(config, persist = true) {
      this.config = validateConfig(config);
      if (persist) localStorage.setItem(CONFIG_KEY, JSON.stringify(this.config));
      return this.config;
    }
    configured() { return !!(this.config?.url && this.config?.publishableKey); }
    authenticated() { return !!this.session?.access_token; }
    async getAccessToken() { await this.ensureFreshSession(); return this.session.access_token; }
    getSessionInfo() {
      if (!this.session) return null;
      return { user: this.session.user || null, expiresAt: this.session.expires_at || null, aal: this.getAal() };
    }
    getAal() { return decodeJwtPayload(this.session?.access_token || '')?.aal || 'aal1'; }
    _requireConfig() { if (!this.configured()) throw new Error('ابتدا نشانی پروژه و کلید عمومی Supabase را ذخیره کنید.'); }
    _storeSession(data) {
      if (!data?.access_token || !data?.refresh_token) throw new Error('پاسخ احراز هویت ناقص است.');
      const expiresIn = Number(data.expires_in || 3600);
      this.session = { ...data, expires_at: Math.floor(Date.now() / 1000) + expiresIn };
      sessionStorage.setItem(SESSION_KEY, JSON.stringify(this.session));
      return this.session;
    }
    async _fetch(path, options = {}, auth = false) {
      this._requireConfig();
      const headers = new Headers(options.headers || {});
      headers.set('apikey', this.config.publishableKey);
      headers.set('Accept', 'application/json');
      if (auth && this.session?.access_token) headers.set('Authorization', `Bearer ${this.session.access_token}`);
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 15000);
      let response;
      try {
        response = await fetch(`${this.config.url}${path}`, { ...options, headers, credentials: 'omit', cache: 'no-store', signal: options.signal || controller.signal });
      } finally { clearTimeout(timeout); }
      const raw = await response.text();
      if (raw.length > MAX_RESPONSE_BYTES) throw new Error('پاسخ سرور بیش از حد مجاز است.');
      let body = null;
      if (raw) { try { body = JSON.parse(raw); } catch { body = { message: raw.slice(0, 500) }; } }
      if (!response.ok) {
        const message = body?.msg || body?.message || body?.error_description || body?.error || `HTTP ${response.status}`;
        const error = new Error(String(message).slice(0, 500)); error.status = response.status; error.details = body; throw error;
      }
      return body;
    }
    async signIn(email, password) {
      if (!email?.trim() || !password) throw new Error('ایمیل و گذرواژه را وارد کنید.');
      const data = await this._fetch('/auth/v1/token?grant_type=password', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), password })
      });
      if (data?.access_token) this._storeSession(data);
      else if (data?.mfa) return { mfaRequired: true, factors: data.mfa?.totp || [] };
      else throw new Error('ورود کامل نشد؛ وضعیت MFA حساب را بررسی کنید.');
      return this.getSessionInfo();
    }
    async refreshSession() {
      if (!this.session?.refresh_token) throw new Error('نشست فعالی برای تمدید وجود ندارد.');
      const data = await this._fetch('/auth/v1/token?grant_type=refresh_token', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh_token: this.session.refresh_token })
      });
      this._storeSession(data); return this.getSessionInfo();
    }
    async ensureFreshSession() {
      if (!this.session?.access_token) throw new Error('ابتدا وارد حساب شوید.');
      if (Number(this.session.expires_at || 0) < Math.floor(Date.now() / 1000) + 60) await this.refreshSession();
    }
    async signOut() {
      if (this.session?.access_token && this.configured()) {
        try { await this._fetch('/auth/v1/logout', { method: 'POST' }, true); } catch { /* local session is still cleared */ }
      }
      this.session = null; sessionStorage.removeItem(SESSION_KEY);
    }
    async listFactors() {
      await this.ensureFreshSession();
      return this._fetch('/auth/v1/factors', { method: 'GET' }, true);
    }
    async enrollTotp(friendlyName = 'WoundAI Authenticator') {
      await this.ensureFreshSession();
      return this._fetch('/auth/v1/factors', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ factor_type: 'totp', friendly_name: friendlyName }) }, true);
    }
    async challengeFactor(factorId) {
      await this.ensureFreshSession();
      return this._fetch(`/auth/v1/factors/${encodeURIComponent(factorId)}/challenge`, { method: 'POST' }, true);
    }
    async verifyFactor(factorId, challengeId, code) {
      await this.ensureFreshSession();
      const data = await this._fetch(`/auth/v1/factors/${encodeURIComponent(factorId)}/verify`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ challenge_id: challengeId, code: String(code).trim() })
      }, true);
      if (data?.access_token) this._storeSession(data);
      return this.getSessionInfo();
    }
    async listClinicMemberships() {
      await this.ensureFreshSession();
      const user = await this._fetch('/auth/v1/user', { method: 'GET' }, true);
      const rows = await this._fetch(`/rest/v1/clinic_members?select=clinic_id,role,clinics(id,name)&user_id=eq.${encodeURIComponent(user.id)}&order=created_at.asc`, { method: 'GET' }, true);
      return Array.isArray(rows) ? rows : [];
    }
    async createClinic(name) {
      await this.ensureFreshSession();
      if (String(name || '').trim().length < 2) throw new Error('نام مرکز باید حداقل دو نویسه باشد.');
      return this._fetch('/rest/v1/rpc/create_clinic_and_owner', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clinic_name: String(name).trim() })
      }, true);
    }
    async _assertWriteSession() {
      await this.ensureFreshSession();
      if (this.getAal() !== 'aal2') throw new Error('برای انتقال یا تغییر اطلاعات، ابتدا MFA را تأیید کنید تا نشست به سطح AAL2 برسد.');
    }
    async listRows(table, clinicId) {
      const allowed = ['patients','wounds','wound_images','assessments','care_plans','encounters','appointments'];
      if (!allowed.includes(table)) throw new Error('جدول در فهرست مجاز نیست.');
      await this.ensureFreshSession();
      if (!clinicId) throw new Error('مرکز درمانی انتخاب نشده است.');
      const order = table === 'wound_images' ? 'captured_at.asc' :
        table === 'assessments' ? 'assessed_at.asc' :
        table === 'appointments' ? 'due_at.asc' :
        table === 'encounters' ? 'occurred_at.asc' : 'created_at.asc';
      const all = [];
      const pageSize = 50;
      for (let offset = 0; offset < 10000; offset += pageSize) {
        const page = await this._fetch(`/rest/v1/${table}?select=*&clinic_id=eq.${encodeURIComponent(clinicId)}&order=${order}&limit=${pageSize}&offset=${offset}`, { method: 'GET' }, true);
        if (!Array.isArray(page)) throw new Error('ساختار پاسخ جدول ابری معتبر نیست.');
        all.push(...page);
        if (page.length < pageSize) return all;
      }
      throw new Error('تعداد رکوردهای ابری از سقف ۱۰٬۰۰۰ بیشتر است؛ انتقال را در بازه‌های کوچک‌تر انجام دهید.');
    }
    async upsertRows(table, rows) {
      const allowed = ['patients','wounds','wound_images','assessments','encounters','appointments'];
      if (!allowed.includes(table)) throw new Error('جدول برای upsert مجاز نیست.');
      if (!Array.isArray(rows) || !rows.length) return [];
      await this._assertWriteSession();
      return this._fetch(`/rest/v1/${table}?on_conflict=id`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Prefer': 'resolution=merge-duplicates,return=representation' },
        body: JSON.stringify(rows)
      }, true);
    }
    async insertRowsIgnoreDuplicates(table, rows) {
      if (table !== 'care_plans') throw new Error('این عملیات فقط برای برنامه‌های مراقبتی مجاز است.');
      if (!Array.isArray(rows) || !rows.length) return [];
      await this._assertWriteSession();
      return this._fetch(`/rest/v1/${table}?on_conflict=id`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Prefer': 'resolution=ignore-duplicates,return=representation' },
        body: JSON.stringify(rows)
      }, true);
    }
    async uploadWoundImage(path, blob, contentType) {
      await this._assertWriteSession();
      const parts = String(path || '').split('/');
      const uuidPart = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
      if (parts.length !== 4 || !parts.slice(0,3).every(x => uuidPart.test(x)) ||
        !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|jpeg|png|webp)$/i.test(parts[3])) {
        throw new Error('مسیر فایل تصویر معتبر نیست.');
      }
      if (!(blob instanceof Blob) || blob.size > 12 * 1024 * 1024) throw new Error('حجم تصویر از حد مجاز بیشتر است یا فایل معتبر نیست.');
      if (!['image/jpeg','image/png','image/webp'].includes(contentType)) throw new Error('قالب تصویر مجاز نیست.');
      return this._fetch(`/storage/v1/object/wound-images/${path.split('/').map(encodeURIComponent).join('/')}`, {
        method: 'POST',
        headers: { 'Content-Type': contentType, 'x-upsert': 'true' },
        body: blob
      }, true);
    }
    async downloadWoundImage(path) {
      await this.ensureFreshSession();
      const parts = String(path || '').split('/');
      const uuidPart = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
      if (parts.length !== 4 || !parts.slice(0,3).every(x => uuidPart.test(x)) ||
        !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|jpeg|png|webp)$/i.test(parts[3])) {
        throw new Error('مسیر دریافت تصویر معتبر نیست.');
      }
      const response = await fetch(`${this.config.url}/storage/v1/object/authenticated/wound-images/${path.split('/').map(encodeURIComponent).join('/')}`, {
        method: 'GET',
        headers: { apikey: this.config.publishableKey, Authorization: `Bearer ${this.session.access_token}` },
        credentials: 'omit', cache: 'no-store'
      });
      if (!response.ok) throw new Error(`دریافت تصویر ناموفق بود (HTTP ${response.status}).`);
      const blob = await response.blob();
      if (blob.size > 12 * 1024 * 1024) throw new Error('تصویر دریافتی از حد مجاز بزرگ‌تر است.');
      return blob;
    }
    async invokeFunction(name, payload) {
      await this._assertWriteSession();
      if (!/^[a-z0-9-]{2,80}$/.test(name || '')) throw new Error('نام تابع سرور معتبر نیست.');
      return this._fetch(`/functions/v1/${name}`, {
        method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(payload || {})
      }, true);
    }
    async listClinicalSyncRecords(clinicId) {
      await this.ensureFreshSession();
      if (!clinicId) throw new Error('مرکز درمانی انتخاب نشده است.');
      const all = [], pageSize = 500;
      for (let offset=0; offset<100000; offset+=pageSize) {
        const page = await this._fetch(`/rest/v1/clinic_sync_records?select=clinic_id,entity_type,local_id,dedupe_key,payload,revision,updated_at,updated_by,deleted_at&clinic_id=eq.${encodeURIComponent(clinicId)}&order=updated_at.asc&limit=${pageSize}&offset=${offset}`, {method:'GET'}, true);
        if (!Array.isArray(page)) throw new Error('پاسخ سوابق همگام‌سازی معتبر نیست.');
        all.push(...page);
        if (page.length<pageSize) return all;
      }
      throw new Error('تعداد رکوردهای همگام‌سازی از سقف ۱۰۰٬۰۰۰ بیشتر است.');
    }
    async syncClinicalRecords(clinicId, changes) {
      await this._assertWriteSession();
      if (!clinicId) throw new Error('مرکز درمانی انتخاب نشده است.');
      if (!Array.isArray(changes) || changes.length>100) throw new Error('هر بسته همگام‌سازی حداکثر ۱۰۰ رکورد دارد.');
      if (!changes.length) return {applied:[],conflicts:[],submitted:0};
      return this._fetch('/rest/v1/rpc/sync_clinic_records', {
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body:JSON.stringify({target_clinic:clinicId,changes})
      }, true);
    }
    async deleteWoundImage(path) {
      await this._assertWriteSession();
      const parts=String(path||'').split('/');
      const uuidPart=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if(parts.length!==4||!parts.slice(0,3).every(x=>uuidPart.test(x))||
        !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|jpeg|png|webp)$/i.test(parts[3])) {
        throw new Error('مسیر حذف تصویر معتبر نیست.');
      }
      try {
        return await this._fetch(`/storage/v1/object/wound-images/${parts.map(encodeURIComponent).join('/')}`,{method:'DELETE'},true);
      } catch(error) {
        if(error?.status===404)return {alreadyDeleted:true};
        throw error;
      }
    }
    async listClinicMembers(clinicId) {
      await this.ensureFreshSession();
      if (!clinicId) throw new Error('مرکز درمانی انتخاب نشده است.');
      const rows = await this._fetch(`/rest/v1/clinic_members?select=clinic_id,user_id,role,created_at,updated_at&clinic_id=eq.${encodeURIComponent(clinicId)}&order=created_at.asc&limit=500`, { method: 'GET' }, true);
      return Array.isArray(rows) ? rows : [];
    }
    async manageClinicMember(clinicId, userId, role, remove = false) {
      await this._assertWriteSession();
      if (!clinicId || !/^[0-9a-f-]{36}$/i.test(userId || '')) throw new Error('شناسه مرکز و شناسه کاربر معتبر لازم است.');
      const allowed = ['owner','admin','clinician','reviewer','viewer'];
      if (!remove && !allowed.includes(role)) throw new Error('نقش انتخاب‌شده معتبر نیست.');
      return this._fetch('/rest/v1/rpc/manage_clinic_member', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ target_clinic: clinicId, target_user: userId, target_role: remove ? null : role, remove_member: !!remove })
      }, true);
    }
    async createClinicBackup(clinicId) {
      await this._assertWriteSession();
      if (!clinicId) throw new Error('مرکز درمانی انتخاب نشده است.');
      return this._fetch('/rest/v1/rpc/create_clinic_backup', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ target_clinic: clinicId })
      }, true);
    }
    async listClinicBackups(clinicId) {
      await this.ensureFreshSession();
      if (!clinicId) throw new Error('مرکز درمانی انتخاب نشده است.');
      const rows = await this._fetch(`/rest/v1/clinic_backups?select=id,clinic_id,backup_version,created_by,created_at,status,record_counts,storage_paths&clinic_id=eq.${encodeURIComponent(clinicId)}&order=created_at.desc&limit=30`, { method: 'GET' }, true);
      return Array.isArray(rows) ? rows : [];
    }
    async restoreClinicBackup(clinicId, backupId, confirmationCode) {
      await this._assertWriteSession();
      if (!clinicId || !/^[0-9a-f-]{36}$/i.test(backupId || '')) throw new Error('شناسه مرکز یا پشتیبان معتبر نیست.');
      return this._fetch('/rest/v1/rpc/restore_clinic_backup', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ target_clinic: clinicId, target_backup: backupId, confirmation_code: confirmationCode })
      }, true);
    }
    async updateRowsVersioned(table, clinicId, rowId, expectedRevision, patch) {
      const allowed = ['patients','wounds','wound_images','assessments','care_plans','encounters','appointments'];
      if (!allowed.includes(table)) throw new Error('جدول برای به‌روزرسانی نسخه‌دار مجاز نیست.');
      if (!Number.isInteger(expectedRevision) || expectedRevision < 1) throw new Error('شماره نسخه رکورد معتبر نیست.');
      if (!patch || typeof patch !== 'object' || Array.isArray(patch)) throw new Error('تغییرات رکورد معتبر نیست.');
      const forbidden = ['id','clinic_id','created_at','created_by','revision','updated_at','updated_by'];
      if (Object.keys(patch).some(key => forbidden.includes(key))) throw new Error('شناسه‌ها و فیلدهای کنترلی را نمی‌توان در ویرایش نسخه‌دار تغییر داد.');
      await this._assertWriteSession();
      const query = `id=eq.${encodeURIComponent(rowId)}&clinic_id=eq.${encodeURIComponent(clinicId)}&revision=eq.${expectedRevision}`;
      const rows = await this._fetch(`/rest/v1/${table}?${query}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'Prefer': 'return=representation' },
        body: JSON.stringify(patch)
      }, true);
      if (Array.isArray(rows) && rows.length === 1) return { ok: true, row: rows[0] };
      const current = await this._fetch(`/rest/v1/${table}?select=*&id=eq.${encodeURIComponent(rowId)}&clinic_id=eq.${encodeURIComponent(clinicId)}&limit=1`, { method: 'GET' }, true);
      const error = new Error(current?.[0] ? 'این پرونده در دستگاه دیگری تغییر کرده است؛ نسخه جدید را دریافت و تغییرات را دوباره بررسی کنید.' : 'رکورد پیدا نشد یا دسترسی کافی وجود ندارد.');
      error.code = current?.[0] ? 'WOUNDAI_CONFLICT' : 'WOUNDAI_NOT_FOUND';
      error.current = current?.[0] || null;
      throw error;
    }
    async listPatients(clinicId) {
      const rows = await this.listRows('patients', clinicId);
      return rows.slice(0, 100);
    }
  }
  global.WoundAISupabase = new WoundAISupabaseClient();
  global.WoundAISupabaseClient = WoundAISupabaseClient;
})(window);
