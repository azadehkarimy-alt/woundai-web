import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const source = fs.readFileSync(new URL('../supabase-client-v30.js', import.meta.url), 'utf8');
const store = () => {
  const map = new Map();
  return { getItem: k => map.has(k) ? map.get(k) : null, setItem: (k,v) => map.set(k,String(v)), removeItem: k => map.delete(k), _map: map };
};
const localStorage = store(), sessionStorage = store();
const calls = [];
const fakeFetch = async (url, options = {}) => {
  calls.push({url, options});
  if (String(url).includes('/auth/v1/token?grant_type=password')) {
    return new Response(JSON.stringify({access_token:'header.eyJhbGciOiJub25lIn0.signature',refresh_token:'refresh-test',expires_in:3600,user:{id:'u-1',email:'test@example.org'}}), {status:200,headers:{'Content-Type':'application/json'}});
  }
  if (String(url).includes('/auth/v1/user')) {
    return new Response(JSON.stringify({id:'u-1',email:'test@example.org'}), {status:200,headers:{'Content-Type':'application/json'}});
  }
  if (String(url).includes('/rest/v1/clinic_members')) {
    return new Response(JSON.stringify([{clinic_id:'c-1',role:'owner',clinics:{id:'c-1',name:'Test clinic'}}]), {status:200,headers:{'Content-Type':'application/json'}});
  }
  if (String(url).includes('/rest/v1/patients') && options.method === 'PATCH') {
    return new Response(JSON.stringify([{id:'p-1',revision:2,full_name:'Updated'}]), {status:200,headers:{'Content-Type':'application/json'}});
  }
  if (String(url).includes('/rest/v1/patients')) {
    return new Response(JSON.stringify([{id:'p-1',record_code:'R-1',full_name:'Test',revision:1}]), {status:200,headers:{'Content-Type':'application/json'}});
  }
  if (String(url).includes('/rest/v1/clinic_backups')) {
    return new Response(JSON.stringify([{id:'b-1',status:'completed'}]), {status:200,headers:{'Content-Type':'application/json'}});
  }
  if (String(url).includes('/rest/v1/clinic_sync_records')) {
    return new Response(JSON.stringify([]), {status:200,headers:{'Content-Type':'application/json'}});
  }
  if (String(url).includes('/rest/v1/rpc/sync_clinic_records')) {
    return new Response(JSON.stringify({applied:[],conflicts:[],submitted:0}), {status:200,headers:{'Content-Type':'application/json'}});
  }
  return new Response('{}', {status:200,headers:{'Content-Type':'application/json'}});
};
const context = {
  window: {}, localStorage, sessionStorage, URL, Headers, Response, Blob, AbortController, setTimeout, clearTimeout, fetch: fakeFetch,
  atob: s => Buffer.from(s, 'base64').toString('binary'), Date, JSON, Math, encodeURIComponent,
  console
};
vm.runInNewContext(source, context, {filename:'supabase-client-v30.js'});
const client = context.window.WoundAISupabase;
assert.ok(client, 'client should be exposed');
assert.throws(() => client.configure({url:'http://example.org',publishableKey:'anon'}), /HTTPS/);
assert.throws(() => client.configure({url:'https://example.org',publishableKey:'sb_secret_do_not_use'}), /Secret/);
const servicePayload = Buffer.from(JSON.stringify({role:'service_role'})).toString('base64url');
assert.throws(() => client.configure({url:'https://example.org',publishableKey:`a.${servicePayload}.c`}), /anon|Publishable/);
client.configure({url:'https://project.supabase.co',publishableKey:'sb_publishable_public-test'});
assert.ok(localStorage.getItem('woundai.supabase.config.v1'), 'public config should persist');
await client.signIn('test@example.org','example-password');
assert.equal(client.authenticated(), true);
assert.equal(await client.getAccessToken(), client.session.access_token, 'short-lived access token accessor should return the active token');
assert.ok(sessionStorage.getItem('woundai.supabase.session.v1'), 'session should be session-scoped');
assert.equal(localStorage._map.size, 1, 'auth token must not be stored in localStorage');
const memberships = await client.listClinicMemberships();
assert.equal(memberships[0].clinics.name, 'Test clinic');
const patients = await client.listPatients('c-1');
assert.equal(patients.length, 1);
const aal2Payload = Buffer.from(JSON.stringify({aal:'aal2'})).toString('base64url');
client.session.access_token = `header.${aal2Payload}.signature`;
client.session.expires_at = Math.floor(Date.now()/1000)+3600;
await client.upsertRows('patients',[{id:'00000000-0000-4000-8000-000000000001'}]);
const upsertCall = calls.find(x => String(x.url).includes('/rest/v1/patients?on_conflict=id'));
assert.ok(upsertCall, 'authenticated upsert method should call PostgREST');
assert.equal(upsertCall.options.headers.get('Prefer'), 'resolution=merge-duplicates,return=representation');
await assert.rejects(client.upsertRows('audit_events',[{}]), /مجاز نیست/);
await assert.rejects(client.uploadWoundImage('invalid-path',new Blob(['x'],{type:'image/png'}),'image/png'), /مسیر فایل/);
const clinicUuid='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const userUuid='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
await client.manageClinicMember(clinicUuid,userUuid,'reviewer');
assert.ok(calls.some(x=>String(x.url).includes('/rest/v1/rpc/manage_clinic_member')));
await client.createClinicBackup(clinicUuid);
assert.ok(calls.some(x=>String(x.url).includes('/rest/v1/rpc/create_clinic_backup')));
const backupRows=await client.listClinicBackups(clinicUuid);
assert.equal(backupRows.length,1);
await client.restoreClinicBackup(clinicUuid,'cccccccc-cccc-4ccc-8ccc-cccccccccccc','RESTORE-cccccccc-cccc-4ccc-8ccc-cccccccccccc');
assert.ok(calls.some(x=>String(x.url).includes('/rest/v1/rpc/restore_clinic_backup')));
const syncRows=await client.listClinicalSyncRecords(clinicUuid);
assert.equal(syncRows.length,0);
await client.syncClinicalRecords(clinicUuid,[{entity_type:'patient',local_id:userUuid,dedupe_key:'r-1',expected_revision:0,payload:{id:userUuid},deleted:false}]);
assert.ok(calls.some(x=>String(x.url).includes('/rest/v1/rpc/sync_clinic_records')));
await client.deleteWoundImage(`${clinicUuid}/${userUuid}/${userUuid}/${userUuid}.png`);
assert.ok(calls.some(x=>String(x.url).includes('/storage/v1/object/wound-images/')&&x.options.method==='DELETE'));
await client.invokeFunction('woundai-offsite-backup',{action:'list',clinic_id:clinicUuid});
assert.ok(calls.some(x=>String(x.url).includes('/functions/v1/woundai-offsite-backup')));
const versioned=await client.updateRowsVersioned('patients',clinicUuid,'p-1',1,{full_name:'Updated'});
assert.equal(versioned.row.revision,2);
await assert.rejects(client.updateRowsVersioned('patients',clinicUuid,'p-1',1,{revision:3}), /فیلدهای کنترلی/);
const patchCall=calls.find(x=>String(x.url).includes('/rest/v1/patients?')&&x.options.method==='PATCH');
assert.ok(patchCall);
assert.match(String(patchCall.url),/revision=eq\.1/);
const patientCall = calls.find(x => String(x.url).includes('/rest/v1/patients'));
assert.equal(patientCall.options.headers.get('Authorization'), 'Bearer header.eyJhbGciOiJub25lIn0.signature');
await client.signOut();
assert.equal(client.authenticated(), false);
assert.equal(sessionStorage.getItem('woundai.supabase.session.v1'), null);
console.log('Supabase client checks passed (config validation, secret-key rejection, session storage, access-token accessor, AAL2-gated writes, role/backup RPCs, optimistic concurrency, storage path validation, authenticated REST, sign-out).');
