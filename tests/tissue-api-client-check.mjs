import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const handlers = new Map();
const els = new Map();
function el(id) {
  if (!els.has(id)) els.set(id, {
    id, value: '', disabled: false, checked: false, hidden: false,
    textContent: '', children: [], files: [],
    addEventListener(type, fn) { handlers.set(`${id}:${type}`, fn); },
    replaceChildren(...nodes) { this.children = [...nodes]; },
    append(node) { this.children.push(node); },
    removeAttribute(name) { if (name === 'src') this.src = ''; }
  });
  return els.get(id);
}
const document = {
  getElementById: el,
  createElement(tag) { return { tag, textContent: '', children: [], append(...nodes) { this.children.push(...nodes); } }; }
};
let healthReady = false;
let analyzeCalled = false;
let sentForm = null;
let sentAuthorization = null;
const mask = Buffer.from('iVBORw0KGgo=', 'base64').toString('base64');
const fetch = async (url, options={}) => {
  if (url.endsWith('/health')) {
    return { ok: true, status: 200, async text() {
      return JSON.stringify({
        status: 'ok', model: 'FixtureModel', model_version: 'test',
        model_loaded: healthReady, checkpoint_verified: healthReady,
        clinical_use: false, reason: healthReady ? 'ready' : 'not configured'
      });
    }};
  }
  if (url.endsWith('/v1/tissue/analyze')) {
    analyzeCalled = true;
    sentForm = options.body;
    sentAuthorization = options.headers?.Authorization || null;
    return { ok: true, status: 200, async text() {
      return JSON.stringify({
        ai_generated: true, research_only: true, clinical_use: false, diagnosis: null,
        model: 'FixtureModel', model_version: 'test',
        classes: [{name:'granulation',pixels:12,percent_of_wound:100,confidence:0.9}],
        mask_png_base64: mask, warning: 'Research only'
      });
    }};
  }
  throw new Error(`Unexpected URL ${url}`);
};
class FakeFormData { constructor(){this.entries=[];} append(...args){this.entries.push(args);} }

const context = {
  document,
  window: {
    location: { origin: 'https://clinic.example' },
    WOUNDAI_API_ALLOWED_ORIGINS: [],
    WoundAISupabase: {
      authenticated: () => true,
      async getAccessToken() { return 'short-lived-supabase-access-token'; }
    }
  },
  URL, fetch, AbortController, setTimeout, clearTimeout, FormData: FakeFormData,
  console
};
vm.runInNewContext(fs.readFileSync(new URL('../tissue-api-v30.js', import.meta.url), 'utf8'), context);

el('tissueApiUrl').value = 'https://clinic.example/api';
await handlers.get('tissueApiCheck:click')();
assert.equal(el('tissueImageFile').disabled, true, 'image upload remains disabled without a model');
assert.equal(el('tissueAnalyzeButton').disabled, true, 'analysis remains disabled without a model');

healthReady = true;
await handlers.get('tissueApiCheck:click')();
assert.equal(el('tissueImageFile').disabled, false, 'image upload enabled after ready health response');
el('tissueImageFile').files = [{ size: 100, type: 'image/png' }];
handlers.get('tissueImageFile:change')();
el('tissueResearchConsent').checked = true;
handlers.get('tissueResearchConsent:change')();
assert.equal(el('tissueAnalyzeButton').disabled, false, 'analysis enabled only with file and consent');

await handlers.get('tissueAnalyzeButton:click')();
assert.equal(analyzeCalled, true, 'analysis endpoint called');
assert.ok(sentForm instanceof FakeFormData, 'image sent as multipart form');
assert.equal(sentAuthorization, 'Bearer short-lived-supabase-access-token', 'short-lived Supabase token attached');
assert.equal(el('tissueAnalyzeResult').hidden, false, 'research result displayed');
assert.match(el('tissueAnalyzeStatus').textContent, /پردازش پژوهشی انجام شد/);
assert.match(el('tissueMaskPreview').src, /^data:image\/png;base64,/);
assert.equal(el('tissueClassResults').children.length, 1);
console.log('tissue-api-client-check: health gating, consent, Supabase bearer token, upload contract and research-only rendering passed');
