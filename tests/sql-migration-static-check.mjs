import fs from 'node:fs';
import assert from 'node:assert/strict';
const root=new URL('../',import.meta.url);
const sync=fs.readFileSync(new URL('../supabase/migrations/202611170006_woundai_v30_8_clinical_sync.sql',import.meta.url),'utf8');
const backup=fs.readFileSync(new URL('../supabase/migrations/202611170007_woundai_v30_8_offsite_backups.sql',import.meta.url),'utf8');
for(const [name,sql] of [['clinical sync',sync],['offsite backup',backup]]){
  assert.equal((sql.match(/\$\$/g)||[]).length%2,0,`${name}: unmatched dollar-quote delimiter`);
  assert.ok(/begin;/i.test(sql)&&/commit;/i.test(sql),`${name}: transaction wrapper missing`);
  assert.equal(sql.includes('\\n'),false,`${name}: literal escaped newline found`);
}
assert.match(sync,/create table if not exists public\.clinic_sync_records/i);
assert.match(sync,/create or replace function public\.sync_clinic_records/i);
assert.match(sync,/create or replace function public\.woundai_mirror_sync_record/i);
assert.match(sync,/expected_revision/i);
assert.match(sync,/duplicate_key/i);
assert.match(sync,/consent_record->>'consent'='true'/i);
assert.match(sync,/clinical roles delete wound images v30\.8/i);
assert.match(sync,/delete from public\.patients/i);
assert.match(sync,/delete from public\.wound_images/i);
assert.match(backup,/create table if not exists public\.clinic_offsite_backups/i);
assert.match(backup,/service_role/i);
console.log('sql-migration-static-check: transaction delimiters, RPCs, revision/conflict controls, consent-scoped backfill, normalized-table mirror/delete and offsite metadata policies passed');
