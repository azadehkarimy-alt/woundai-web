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

for (const page of ['dashboard','patients','imaging','ai','clinical','careplan','reports','security','finaltest']) {
  assert.match(html, new RegExp(`id=["']page-${page}["']`), `Missing page ${page}`);
}
for (const id of ['patientForm','woundForm','saveImageRecord','saveClinical','stage7Generate','stage7Approve','runFinalTests','exportEncryptedBackup','importEncryptedBackup','visitComparePanel','visitCompareContent','downloadVisitComparePng','startSegmentationSeed','clearSegmentation','segmentationThreshold','segmentationStatus','aABI','aTBI','aPedalPulse','aNeuropathy','aPlantar','aOffloading','aPressureRisk','aMobility','aNutrition']) {
  assert.match(html, new RegExp(`id=["']${id}["']`), `Missing required control ${id}`);
}
for (const file of ['styles.css','app.js','manifest.webmanifest','sw.js','assets/woundai-icon-192.png','assets/woundai-icon-512.png','assets/woundai-logo-horizontal.png','assets/woundai-logo-square.png','clinical-guidelines/guideline-registry.json','clinical-guidelines/README-FA.md']) {
  assert.ok(fs.existsSync(path.join(root,file)), `Missing required file ${file}`);
}
assert.ok(manifest.name && manifest.start_url && manifest.display, 'PWA manifest incomplete');
assert.ok(manifest.icons?.some(x => x.sizes === '192x192'), '192px PWA icon missing');
assert.ok(manifest.icons?.some(x => x.sizes === '512x512'), '512px PWA icon missing');
assert.match(sw, /woundai-release-v25/, 'Service worker cache version not bumped');
assert.match(sw, /request\.method !== 'GET'/, 'Service worker should ignore non-GET requests');
assert.match(js, /WoundAI-Encrypted-Backup-v1/, 'Encrypted backup import/export missing');
assert.match(js, /function trainANN/, 'ANN training implementation missing');
assert.match(js, /function stage7Generate/, 'Care-plan generation missing');
assert.match(js, /function stage7Save/, 'Care-plan review workflow missing');
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

// Parse app code without executing browser DOM dependencies.
new vm.Script(js, { filename: 'app.js' });
new vm.Script(sw, { filename: 'sw.js' });
console.log(`WoundAI smoke checks passed (${ids.length} unique DOM ids, 9 core pages).`);

assert.match(html, /id=["']startupScreen["']/, 'Branded startup screen missing');
assert.match(html, /woundai-logo-horizontal\.png/, 'Approved horizontal logo missing from startup');
assert.match(html, /تهیه و تنظیم: دکتر آزاده کریمی/, 'Persian author credit missing');
assert.match(html, /Azadeh karimy/, 'English author credit missing');
assert.match(html, /WoundAI • Pro Web v25/, 'Sidebar version not updated');
assert.match(sw, /woundai-release-v25/, 'Service worker cache not updated');
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
