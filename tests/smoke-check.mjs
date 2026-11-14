import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import vm from 'node:vm';

const root = process.cwd();
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const js = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
const sw = fs.readFileSync(path.join(root, 'sw.js'), 'utf8');
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'manifest.webmanifest'), 'utf8'));
const guidelineRegistry = JSON.parse(fs.readFileSync(path.join(root, 'clinical-guidelines/guideline-registry.json'), 'utf8'));

const ids = [...html.matchAll(/\bid=["']([^"']+)["']/g)].map(m => m[1]);
const duplicates = ids.filter((id, i) => ids.indexOf(id) !== i);
assert.deepEqual([...new Set(duplicates)], [], 'HTML contains duplicate IDs');

for (const page of ['dashboard','patients','imaging','ai','clinical','careplan','clinicalalerts','appointments','reports','security','finaltest','crm','trm','tissueapi']) {
  assert.match(html, new RegExp(`id=["']page-${page}["']`), `Missing page ${page}`);
}
for (const id of ['patientForm','woundForm','saveImageRecord','saveClinical','stage7Generate','stage7Approve','runFinalTests','exportEncryptedBackup','importEncryptedBackup','visitComparePanel','visitCompareContent','downloadVisitComparePng','startSegmentationSeed','clearSegmentation','segmentationThreshold','segmentationStatus','aABI','aTBI','aPedalPulse','aNeuropathy','aPlantar','aOffloading','aPressureRisk','aMobility','aNutrition','aAssessmentLocation','aErythemaExtent','clinicalRedFlagStatus','clinicalValidationWarnings','tissueImageFile','tissueResearchConsent','tissueAnalyzeButton','tissueAnalyzeStatus','tissueAnalyzeResult','tissueClassResults','tissueMaskPreview','tissueResultWarning','redFlagSepsis','redFlagNecrotizing','redFlagGas','redFlagDeepAbscess','redFlagGangrene','redFlagAcuteIschemia','redFlagDisproportionatePain','redFlagRapidProgression','redFlagSystemicDeterioration']) {
  assert.match(html, new RegExp(`id=["']${id}["']`), `Missing required control ${id}`);
}
for (const file of ['styles.css','clinical-validation-v30.js','app.js','api-config.js','supabase-config.js','supabase-client-v30.js','supabase-ui-v30.js','manifest.webmanifest','sw.js','assets/woundai-icon-192.png','assets/woundai-icon-512.png','assets/woundai-logo-horizontal.png','assets/woundai-logo-square.png','clinical-guidelines/guideline-registry.json','clinical-guidelines/instrument-implementation-status.json','clinical-guidelines/README-FA.md','tests/tissue-api-client-check.mjs','research-tissue-api/INFERENCE-PLUGIN-CONTRACT-FA.md','research-tissue-api/MODEL-VALIDATION-PROTOCOL-FA.md','supabase/migrations/202611140003_woundai_v30_5_security_audit.sql','supabase/migrations/202611150004_woundai_v30_6_cloud_records.sql','supabase/migrations/202611160005_woundai_v30_7_concurrency_roles_backups.sql','cloud-sync-v30.js','offline-image-store-v307.js']) {
  assert.ok(fs.existsSync(path.join(root,file)), `Missing required file ${file}`);
}
assert.ok(manifest.name && manifest.start_url && manifest.display, 'PWA manifest incomplete');
assert.match(html, /clinical-validation-v30\.js/, 'Clinical validation module not loaded');
assert.match(html, /clinicalRedFlagStatus/, 'Clinical red-flag status panel missing');
assert.match(html, /tissueAnalyzeButton/, 'Research image analysis control missing');
assert.match(html, /tissue-api-v30\.js/, 'Research API client script missing');
assert.match(html, /فاقد اطلاعات شناسایی‌کننده/, 'De-identification warning missing');
assert.match(html, /استفاده تشخیصی و درمانی غیرفعال است/, 'Research-only safety boundary missing');
assert.match(js, /woundai-clinical-assessment-1\.1/, 'Clinical assessment schema version missing');
assert.ok(manifest.icons?.some(x => x.sizes === '192x192'), '192px PWA icon missing');
assert.ok(manifest.icons?.some(x => x.sizes === '512x512'), '512px PWA icon missing');
const appVersion = js.match(/const APP_VERSION='([^']+)'/)?.[1];
assert.ok(appVersion, 'APP_VERSION must be declared');
assert.ok(manifest.name.includes(`V${appVersion}`), 'Manifest version must match APP_VERSION');
assert.ok(html.includes(`WoundAI • Pro Web v${appVersion}`), 'Sidebar version must match APP_VERSION');
assert.match(sw, new RegExp(`woundai-release-v${appVersion.replace('.', '-')}`), 'Service worker cache must match APP_VERSION');
assert.match(sw, /request\.method !== 'GET'/, 'Service worker should ignore non-GET requests');
assert.match(sw, /woundai-release-v30-8/, 'v30.8 cache name missing');
assert.match(js, /WoundAI-Encrypted-Backup-v1/, 'Encrypted backup import/export missing');
assert.match(js, /function trainANN/, 'ANN training implementation missing');
assert.match(js, /function stage7Generate/, 'Care-plan generation missing');
assert.match(js, /function stage7Save/, 'Care-plan review workflow missing');
assert.match(js, /clinicalValidation\.valid/, 'Clinical save must validate input');
assert.match(js, /encounterId:data\.encounterId/, 'Clinical assessment must retain encounter identity');
assert.match(js, /function reportRows/, 'Clinical report rows missing');
assert.match(js, /ارزیابی نسخه قبلی؛ امتیاز پیشین نیازمند بازبینی است/, 'Legacy unverified clinical scores must be flagged in reports');
assert.doesNotMatch(js.slice(js.indexOf('function buildCarePlan'), js.indexOf('// v7: downloadable one-page wound assessment report')), /temp>=39|hr>=120|systolic<90|rr>=22|spo2<92/, 'Care plan must not use unapproved hard-coded vital cutoffs for triage');

assert.match(js, /function downloadVisitComparePng/, 'Visit comparison PNG export missing');
assert.match(js, /window\.woundaiVisitCompare/, 'Longitudinal image comparison state missing');
assert.match(js, /function segmentFromSeed/, 'Assisted segmentation helper missing');
assert.match(js, /function getSegmentationMetrics/, 'Assisted segmentation measurement missing');
assert.match(js, /assisted-color-region-growing-research/, 'Segmentation provenance missing');
assert.match(js, /IWII — Wound infection in clinical practice, 4th edition \(2026\)/, 'IWII 2026 reference missing');
assert.match(js, /IWGDF 2023/, 'IWGDF recommendation missing');
assert.match(js, /guidelineRefs/, 'Guideline references not attached to care plan');
assert.match(js, /function buildHistoryTrendSvg/, 'Longitudinal area trend chart helper missing');
assert.match(js, /historyTrendSummary/, 'Longitudinal report summary missing');
assert.match((await fs.promises.readFile(path.join(root, 'styles.css'), 'utf8')), /--wound-navy:#092C4C/, 'Official WoundAI palette missing');
assert.match(js, /خلاصه روند زخم/, 'Longitudinal report overview page missing');
assert.match(js, /aABI/, 'ABI input missing from saved assessment');
assert.match(js, /plantar-forefoot/, 'Diabetic foot offloading condition missing');
assert.match(js, /aPressureRisk/, 'Pressure injury assessment input missing');
assert.ok(guidelineRegistry.guidelines.some(g => g.id === 'IWII-2026-4E'), 'IWII 2026 registry entry missing');
assert.ok(guidelineRegistry.guidelines.some(g => g.id === 'NPIAP-EPUAP-PPPIA-2026-4E'), '2026 pressure injury guideline registry entry missing');

assert.match(html, /Content-Security-Policy/, 'CSP baseline missing');
assert.match(html, /id=["']sidebarScrim["']/, 'Mobile sidebar scrim missing');
assert.match(js, /function safeImageSrc/, 'Imported image sources must be validated');
assert.match(js, /function validateImportedRecords/, 'Backup import data validation missing');
assert.match(js, /statAssessments.*clinical-assessment/, 'Dashboard should count clinical assessments, not drafts/orphans');
assert.equal((js.match(/function addWound\(/g)||[]).length, 1, 'Only one addWound implementation should remain');
assert.equal((js.match(/function latestImageForWound\(/g)||[]).length, 1, 'Only one latestImageForWound implementation should remain');
assert.match(js, /state.appointments=Array.isArray\(s.appointments\)\?s.appointments:\[\]/, 'Encrypted backup must restore appointments');
assert.match(js, /state.appointments=state.appointments.filter/, 'Patient deletion must remove linked appointments');
assert.match(js, /priorEdits/, 'Care plan edits must survive automatic recalculation');
assert.match(js, /thumbnail===image.image/, 'Duplicate thumbnail migration missing');
assert.match(fs.readFileSync(path.join(root,'api-config.js'),'utf8'), /WOUNDAI_API_ALLOWED_ORIGINS/, 'Explicit API origin allowlist missing');
assert.ok(fs.existsSync(path.join(root,'tissue-api-v30.js')), 'Shared API health module missing');
assert.ok(html.includes('api-config.js'), 'API allowlist configuration must load');
assert.match(html, /tissue-api-v30\.js/, 'Main app must use shared API module');
assert.match(sw, /app\.js|styles\.css|tissue-api-v30/, 'Service worker must refresh app shell assets');
assert.match(sw, /supabase-client-v30\.js/, 'Service worker must precache cloud auth client');
assert.ok(sw.includes('supabase-ui-v30\\.js'), 'Service worker must network-refresh cloud UI assets');
assert.match(html, /id=["']cloudSignIn["']/, 'Cloud sign-in control missing');
assert.match(html, /id=["']cloudEnrollMfa["']/, 'MFA enrollment control missing');
assert.match(html, /id=["']cloudClinicSelect["']/, 'Clinic membership selector missing');
assert.match(fs.readFileSync(path.join(root,'supabase-client-v30.js'),'utf8'), /sessionStorage/, 'Cloud tokens must use sessionStorage');
assert.match(fs.readFileSync(path.join(root,'supabase-client-v30.js'),'utf8'), /claims\?\.role && claims\.role !== 'anon'/, 'Non-anon JWT keys must be rejected in browser');
assert.match(fs.readFileSync(path.join(root,'supabase-client-v30.js'),'utf8'), /sb_secret_/, 'Secret-format keys must be rejected in browser');
const migration = fs.readFileSync(path.join(root,'supabase/migrations/202611140002_woundai_v30_2_backend.sql'),'utf8');
assert.match(migration, /create table if not exists public\.encounters/i, 'Encounter table migration missing');
assert.match(migration, /create table if not exists public\.appointments/i, 'Appointment table migration missing');
assert.match(migration, /auth\.jwt\(\) ->> 'aal'\) = 'aal2'/i, 'MFA AAL2 gate missing');
assert.match(migration, /woundai_audit_row/i, 'Server-side audit trigger missing');
assert.match(migration, /create policy \"members read appointments\"/i, 'Appointment RLS missing');
assert.doesNotMatch(fs.readFileSync(path.join(root,'styles.css'),'utf8'), /fonts\.googleapis\.com/, 'External Google Fonts dependency must be removed');

// Parse app code without executing browser DOM dependencies.
new vm.Script(js, { filename: 'app.js' });
new vm.Script(sw, { filename: 'sw.js' });
new vm.Script(fs.readFileSync(path.join(root,'tissue-api-v30.js'),'utf8'), { filename: 'tissue-api-v30.js' });
new vm.Script(fs.readFileSync(path.join(root,'supabase-client-v30.js'),'utf8'), { filename: 'supabase-client-v30.js' });
new vm.Script(fs.readFileSync(path.join(root,'supabase-ui-v30.js'),'utf8'), { filename: 'supabase-ui-v30.js' });
console.log(`WoundAI v${appVersion} smoke checks passed (${ids.length} unique DOM ids, 14 core pages).`);

assert.match(html, /id=["']startupScreen["']/, 'Branded startup screen missing');
assert.match(html, /woundai-logo-horizontal\.png/, 'Approved horizontal logo missing from startup');
assert.match(html, /تهیه و تنظیم: دکتر آزاده کریمی/, 'Persian author credit missing');
assert.match(html, /Azadeh karimy/, 'English author credit missing');

assert.ok(manifest.icons.every(x => x.src.includes('woundai-icon-')), 'PWA icons must use the approved derived icon files');

assert.match(html, /src=["']assets\/woundai-logo-square\.png["']/, 'Topbar must use approved square logo');
assert.match(sw, /assets\/icon\.svg/, 'Official SVG icon must be precached');

assert.match(js, /guided patient-to-follow-up workflow/, 'Guided workflow coordinator missing');
assert.match(js, /woundaiAdvance\('imaging'/, 'Wound save must advance to imaging');
assert.match(js, /woundaiAdvance\('clinical'/, 'Image save must advance to clinical assessment');
assert.match(js, /woundaiAdvance\('careplan'/, 'Clinical save must advance to care plan');
assert.match(js, /woundaiAdvance\('reports'/, 'Care plan save must advance to reports');
assert.match(html, /workflowRibbon/, 'Workflow progress ribbon missing');

assert.match(html, /body-front-v20\.png/, 'Front anatomical image missing');
assert.match(html, /body-back-v20\.png/, 'Back anatomical image missing');
assert.match(html, /class="bodymap-point"/, 'Interactive anatomical points missing');
assert.match(js, /v20: interactive anatomical body map/, 'Anatomical map event handlers missing');


const supabaseClient = fs.readFileSync(path.join(root, 'supabase-client-v30.js'), 'utf8');
assert.match(supabaseClient, /async getAccessToken\(\)/, 'Supabase short-lived access token accessor missing');
const tissueClient = fs.readFileSync(path.join(root, 'tissue-api-v30.js'), 'utf8');
assert.match(tissueClient, /Authorization: `Bearer \$\{accessToken\}`/, 'Research API must send authenticated bearer token');
const apiServer = fs.readFileSync(path.join(root, 'research-tissue-api/app.py'), 'utf8');
assert.match(apiServer, /require_authenticated_user/, 'API authentication dependency missing');
assert.match(apiServer, /status_code=429/, 'API rate limiting missing');
assert.match(apiServer, /ImageOps\.exif_transpose/, 'Image metadata sanitization missing');
const auditSql = fs.readFileSync(path.join(root, 'supabase/migrations/202611140003_woundai_v30_5_security_audit.sql'), 'utf8');
assert.match(auditSql, /security definer/i, 'Database audit trigger must be SECURITY DEFINER');
assert.match(auditSql, /revoke insert, update, delete on public\.audit_events from anon, authenticated/i, 'Clients must not forge audit events');
assert.match(auditSql, /woundai_audit_assessments/, 'Assessment audit trigger missing');


const cloudSync = fs.readFileSync(path.join(root, 'cloud-sync-v30.js'), 'utf8');
assert.match(cloudSync, /p\.consent === true/, 'Cloud migration must require recorded consent');
assert.match(cloudSync, /client\.uploadWoundImage/, 'Cloud migration must upload image binaries to private storage');
assert.match(cloudSync, /client\.insertRowsIgnoreDuplicates\('care_plans'/, 'Approved care plans must use immutable insert path');
assert.match(cloudSync, /رکوردهای محلی همسان بازنویسی نمی‌شود|رکوردهای موجود ابری بازنویسی نشدند/, 'Cloud migration must not destructively overwrite records');
assert.match(html, /id=["']cloudSyncPreview["']/, 'Cloud migration preview control missing');
assert.match(html, /id=["']cloudSyncUpload["']/, 'Cloud migration transfer control missing');
assert.match(html, /id=["']cloudSyncDownload["']/, 'Cloud merge download control missing');
assert.match(html, /cloud-sync-v30\.js/, 'Cloud sync module is not loaded');
assert.match(sw, /cloud-sync-v30\.js/, 'Cloud sync module missing from offline precache');
const v305Sql = fs.readFileSync(path.join(root, 'supabase/migrations/202611140003_woundai_v30_5_security_audit.sql'), 'utf8');
assert.doesNotMatch(v305Sql, /on public\.(encounters|appointments)/, 'v30.5 migration must not trigger on tables created only in v30.6');

const cloudMigration = fs.readFileSync(path.join(root, 'supabase/migrations/202611150004_woundai_v30_6_cloud_records.sql'), 'utf8');
assert.match(cloudMigration, /create table if not exists public\.encounters/i, 'Encounter table migration missing');
assert.match(cloudMigration, /create table if not exists public\.appointments/i, 'Appointment table migration missing');
assert.match(cloudMigration, /alter table public\.encounters enable row level security/i, 'Encounter RLS missing');
assert.match(cloudMigration, /alter table public\.appointments enable row level security/i, 'Appointment RLS missing');
assert.match(cloudMigration, /woundai_audit_encounters/, 'Encounter audit trigger missing');
assert.match(cloudMigration, /woundai_audit_appointments/, 'Appointment audit trigger missing');
assert.match(cloudMigration, /public=false/, 'Wound image bucket must be private');
assert.match(cloudMigration, /file_size_limit=12582912/, 'Wound image bucket size limit missing');

const v307Sql = fs.readFileSync(path.join(root, 'supabase/migrations/202611160005_woundai_v30_7_concurrency_roles_backups.sql'), 'utf8');
assert.match(v307Sql, /woundai_revision_stamp/, 'Optimistic concurrency trigger missing');
assert.match(v307Sql, /manage_clinic_member/, 'Clinic role management RPC missing');
assert.match(v307Sql, /آخرین مالک/, 'Last-owner guard missing');
assert.match(v307Sql, /create_clinic_backup/, 'Server backup RPC missing');
assert.match(v307Sql, /restore_clinic_backup/, 'Server restore RPC missing');
assert.match(v307Sql, /run_scheduled_clinic_backups/, 'Scheduled backup function missing');
assert.match(html, /cloudMembersLoad/, 'Member management UI missing');
assert.match(html, /cloudCreateBackup/, 'Server backup UI missing');
assert.match(html, /cloudSyncFlushImages/, 'Offline image queue UI missing');
assert.match(html, /offline-image-store-v307\.js/, 'IndexedDB offline image store not loaded');
assert.match(sw, /offline-image-store-v307\.js/, 'Offline image store missing from PWA precache');

const offlineStore = fs.readFileSync(path.join(root, 'offline-image-store-v307.js'), 'utf8');
assert.match(offlineStore, /indexedDB\.open/, 'IndexedDB offline image store missing');
assert.match(offlineStore, /pendingUploads/, 'Offline image retry queue missing');
assert.match(offlineStore, /client\.getAal\?\.\(\)!=='aal2'/, 'Offline queue flush must require AAL2');
const cronSql = fs.readFileSync(path.join(root, 'supabase/optional/enable_daily_backups_pg_cron.sql'), 'utf8');
assert.match(cronSql, /cron\.schedule/, 'Optional daily backup scheduler missing');

const v308Sync = fs.readFileSync(path.join(root, 'clinical-sync-v308.js'), 'utf8');
const v308Backup = fs.readFileSync(path.join(root, 'offsite-backup-v308.js'), 'utf8');
const v308Sql = fs.readFileSync(path.join(root, 'supabase/migrations/202611170006_woundai_v30_8_clinical_sync.sql'), 'utf8');
const v308OffsiteSql = fs.readFileSync(path.join(root, 'supabase/migrations/202611170007_woundai_v30_8_offsite_backups.sql'), 'utf8');
assert.match(html, /clinicalSyncEnable/, 'Automatic clinical sync control missing');
assert.match(html, /clinicalSyncConflicts/, 'Conflict review UI missing');
assert.match(html, /offsiteBackupCreate/, 'Off-site backup control missing');
assert.match(html, /clinical-sync-v308\.js/, 'Clinical sync engine not loaded');
assert.match(html, /offsite-backup-v308\.js/, 'Off-site backup engine not loaded');
assert.match(sw, /clinical-sync-v308\.js/, 'Clinical sync engine missing from PWA precache');
assert.match(sw, /offsite-backup-v308\.js/, 'Off-site backup engine missing from PWA precache');
assert.match(v308Sync, /syncClinicalRecords/, 'Record-level sync client method missing');
assert.match(v308Sync, /both_changed/, 'Two-way conflict detection missing');
assert.match(v308Sync, /__deleted__/, 'Soft delete tombstones missing');
assert.match(v308Backup, /AES-GCM/, 'Encrypted off-site backup missing');
assert.match(v308Backup, /sha256/, 'Backup checksum verification missing');
assert.match(v308Sql, /sync_clinic_records/, 'Clinical sync RPC missing');
assert.match(v308Sql, /consent_record->>'consent'='true'/, 'Consent-scoped legacy backfill missing');
assert.match(v308Sql, /clinic_sync_records/, 'Generic sync envelope table missing');
assert.match(v308OffsiteSql, /clinic_offsite_backups/, 'Off-site backup metadata table missing');

const localDb = fs.readFileSync(path.join(root, 'local-db-v308.js'), 'utf8');
assert.match(html, /local-db-v308\.js/, 'IndexedDB clinical state store not loaded');
assert.match(sw, /local-db-v308\.js/, 'IndexedDB clinical state store missing from PWA precache');
assert.match(localDb, /woundai-local-clinical-v308/, 'Versioned local IndexedDB database missing');
assert.match(localDb, /_imageInIndexedDB/, 'Media-light localStorage fallback missing');
assert.match(html, /localDbBootStatus/, 'Local database startup status missing');
assert.match(v308Sql, /woundai_mirror_sync_record/, 'Normalized clinical table mirror missing');
assert.match(v308Sql, /clinical roles delete wound images v30\.8/, 'Clinic-scoped image deletion policy missing');
assert.match(v308Backup, /sign-get/, 'Off-site backup download flow missing');
assert.match(v308Backup, /sha256/, 'Off-site backup checksum metadata missing');

const localDbScriptIndex = html.indexOf('<script src="local-db-v308.js"></script>');
const appScriptIndex = html.indexOf('<script src="app.js"></script>');
assert.ok(localDbScriptIndex >= 0 && appScriptIndex > localDbScriptIndex,
  'IndexedDB bootstrap must load before app.js so startup restore is not skipped');
