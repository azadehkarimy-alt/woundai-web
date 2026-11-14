import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const source = fs.readFileSync(path.join(here, '..', 'clinical-validation-v30.js'), 'utf8');
const elements = new Map();
function element(id) {
  if (!elements.has(id)) elements.set(id, {
    id, value: '', checked: false, hidden: false, textContent: '', children: [],
    addEventListener() {}, replaceChildren(...xs) { this.children = xs; },
    append(...xs) { this.children.push(...xs); }, classList: { toggle() {} }
  });
  return elements.get(id);
}
const doc = {
  getElementById: element,
  createElement(tag) { return { tag, children: [], append(...xs) { this.children.push(...xs); } }; }
};
const win = {};
vm.runInNewContext(source, { window: win, document: doc, Number, String, Object, Array, RegExp });
const api = win.WoundAIClinical;
assert.ok(api, 'clinical helper is exported');

function reset() {
  elements.clear();
  for (const id of ['assessorName','aPain','aTemp','aHR','aRR','aSpO2','aLength','aWidth','aDepth','aABI','aTBI','aErythemaExtent','tGran','tSlough','tNecrosis','tEpi','aBP','aFollowup','sinSite','sinIsch','sinNeuro','sinInfect','sinArea','sinDepth','wWound','wIschemia','wInfection','aEtiology','aNpiap','aWagner','aUTGrade','aUTStage','aDepthMethod','pushArea','pushExudate','pushTissue',...Array.from({length:13},(_,i)=>`bwat${i+1}`), 'clinicalRedFlagStatus']) element(id);
}
reset();
element('assessorName').value='Clinician A';
element('aPain').value='5';
element('aTemp').value='37.2';
element('aHR').value='80';
element('aRR').value='16';
element('aSpO2').value='98';
element('aLength').value='2.5';
element('aWidth').value='1.2';
element('aDepth').value='3';
element('aABI').value='0.95';
element('aTBI').value='0.7';
element('tGran').value='40';
element('tSlough').value='20';
element('tNecrosis').value='0';
element('tEpi').value='40';
element('aBP').value='120/80';
element('sinSite').value='0'; element('sinIsch').value='1'; element('sinNeuro').value='0';
element('sinInfect').value='0'; element('sinArea').value='1'; element('sinDepth').value='1';
element('wWound').value='1'; element('wIschemia').value='2'; element('wInfection').value='1';
element('aEtiology').value='diabetic'; element('aNpiap').value='na'; element('aDepthMethod').value='probe';
assert.equal(api.validateForm(doc).valid, true, 'valid form passes');

element('aPain').value='11';
assert.equal(api.validateForm(doc).valid, false, 'out-of-range pain rejected');
element('aPain').value='5';
element('tEpi').value='50';
assert.ok(api.validateForm(doc).errors.some(x => x.includes('۱۰۰٪')), 'tissue total >100 rejected');
element('tEpi').value='40';
element('aBP').value='80/120';
assert.ok(api.validateForm(doc).errors.some(x => x.includes('فشار خون')), 'inconsistent BP rejected');
element('aBP').value='120/80';
element('assessorName').value='';
assert.ok(api.validateForm(doc).errors.some(x => x.includes('ارزیاب')), 'assessor required');

element('assessorName').value='Clinician A';
const rows=api.computeScores(doc);
const sin=rows.find(x=>x.name==='SINBAD');
assert.equal(sin.value,'3/6');
const push=rows.find(x=>x.name==='PUSH 3.0');
assert.match(push.value,/داده خام/);
assert.match(push.note,/مجموع امتیاز.*محاسبه نمی‌شود/);
const bwat=rows.find(x=>x.name==='BWAT');
assert.match(bwat.value,/داده خام 0\/13/);
assert.match(bwat.note,/مجموع کل غیرفعال/);
const wifi=rows.find(x=>x.name==='WIfI');
assert.equal(wifi.value,'W1 · I2 · fI1');
assert.match(wifi.note,/استنتاج نمی‌شود/);

element('redFlagGangrene').checked=true;
const flags=api.getRedFlags(doc);
assert.equal(flags.length,1);
assert.equal(flags[0].id,'redFlagGangrene');
api.renderUrgentBanner(doc);
assert.equal(element('clinicalRedFlagStatus').hidden,false);

console.log('clinical-validation-check: all 10 assertions passed');
