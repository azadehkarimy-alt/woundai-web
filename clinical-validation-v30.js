/* WoundAI v30.3 clinical form validation and score-safety helpers.
 * Input validation is not a clinical reference range or diagnosis.
 * Tool totals are shown only where the supplied project specification supports them.
 */
(function (global) {
  'use strict';
  const $ = (id, doc = document) => doc.getElementById(id);
  const val = (id, doc = document) => $(id, doc)?.value ?? '';
  const num = (id, doc = document) => {
    const raw = val(id, doc).trim();
    if (raw === '') return null;
    const n = Number(raw);
    return Number.isFinite(n) ? n : NaN;
  };
  const labels = {
    redFlagSepsis: 'شک به سپسیس / بدحالی سیستمیک',
    redFlagNecrotizing: 'شک به عفونت نکروزان',
    redFlagGas: 'گاز بافتی مشکوک یا تأییدشده',
    redFlagDeepAbscess: 'شک به آبسه عمقی',
    redFlagGangrene: 'گانگرن',
    redFlagAcuteIschemia: 'شک به ایسکمی حاد اندام',
    redFlagDisproportionatePain: 'درد نامتناسب با ظاهر زخم',
    redFlagRapidProgression: 'نکروز یا تخریب سریعاً پیشرونده',
    redFlagSystemicDeterioration: 'افت وضعیت عمومی / ناپایداری همودینامیک'
  };
  function validateForm(doc = document) {
    const errors = [];
    const warnings = [];
    const ranges = [
      ['aPain', 0, 10, 'درد'],
      ['aTemp', 25, 45, 'دما'],
      ['aHR', 20, 250, 'ضربان قلب'],
      ['aRR', 4, 80, 'تعداد تنفس'],
      ['aSpO2', 50, 100, 'اشباع اکسیژن'],
      ['aLength', 0, 300, 'طول زخم'],
      ['aWidth', 0, 300, 'عرض زخم'],
      ['aDepth', 0, 200, 'عمق زخم'],
      ['aABI', 0, 2.5, 'ABI'],
      ['aTBI', 0, 2.5, 'TBI'],
      ['aErythemaExtent', 0, 100, 'وسعت اریتم'],
      ['tGran', 0, 100, 'گرانولاسیون'],
      ['tSlough', 0, 100, 'اسلاف'],
      ['tNecrosis', 0, 100, 'نکروز'],
      ['tEpi', 0, 100, 'اپی‌تلیال']
    ];
    for (const [id, min, max, label] of ranges) {
      const n = num(id, doc);
      if (n === null) continue;
      if (!Number.isFinite(n) || n < min || n > max) errors.push(`${label}: مقدار باید بین ${min} و ${max} باشد.`);
    }
    const tissueIds = ['tGran', 'tSlough', 'tNecrosis', 'tEpi'];
    const tissue = tissueIds.map(id => num(id, doc)).map(n => n === null ? 0 : n);
    if (tissue.every(Number.isFinite) && tissue.reduce((a, b) => a + b, 0) > 100) {
      errors.push('مجموع درصد اجزای بستر زخم نباید بیشتر از ۱۰۰٪ باشد.');
    }
    const bp = val('aBP', doc).trim();
    if (bp && !/^\d{2,3}\s*\/\s*\d{2,3}$/.test(bp)) errors.push('فشار خون باید با قالب سیستول/دیاستول مانند 120/80 ثبت شود.');
    if (bp && /^\d{2,3}\s*\/\s*\d{2,3}$/.test(bp)) {
      const [sys, dia] = bp.split('/').map(Number);
      if (sys < 40 || sys > 300 || dia < 20 || dia > 200 || dia >= sys) errors.push('مقادیر فشار خون از نظر قالب عددی ناسازگارند؛ ورودی را بازبینی کنید.');
    }
    const assessor = val('assessorName', doc).trim();
    if (!assessor) errors.push('نام یا شناسه ارزیاب برای ثبت ارزیابی الزامی است.');
    const followup = val('aFollowup', doc);
    if (followup && !/^\d{4}-\d{2}-\d{2}$/.test(followup)) errors.push('تاریخ پیگیری معتبر نیست.');
    const sinIds = ['sinSite', 'sinIsch', 'sinNeuro', 'sinInfect', 'sinArea', 'sinDepth'];
    const sinVals = sinIds.map(id => val(id, doc));
    if (sinVals.some(v => v !== '') && sinVals.some(v => v !== '0' && v !== '1')) {
      warnings.push('SINBAD ناقص یا دارای مقدار خارج از دامنه است؛ امتیاز محاسبه نمی‌شود.');
    }
    const wifiIds = ['wWound', 'wIschemia', 'wInfection'];
    for (const id of wifiIds) {
      const v = val(id, doc);
      if (v !== '' && !/^[0-3]$/.test(v)) errors.push(`${id}: درجه باید بین ۰ تا ۳ باشد.`);
    }
    const etiology = val('aEtiology', doc);
    if (val('aNpiap', doc) !== '' && val('aNpiap', doc) !== 'na' && etiology !== 'pressure') {
      warnings.push('مرحله NPIAP ثبت شده اما اتیولوژی انتخابی زخم «فشاری» نیست؛ ارتباط آن را بازبینی کنید.');
    }
    if (val('aWagner', doc) !== '' && etiology !== 'diabetic') {
      warnings.push('گرید Wagner برای زخم غیر دیابتی انتخاب شده است؛ ارتباط آن را بازبینی کنید.');
    }
    if (val('aUTGrade', doc) !== '' || val('aUTStage', doc) !== '') {
      if (etiology !== 'diabetic') warnings.push('طبقه‌بندی University of Texas برای اتیولوژی غیر دیابتی انتخاب شده است؛ ارتباط آن را بازبینی کنید.');
    }
    if (val('aDepth', doc) !== '' && val('aDepthMethod', doc) === 'unknown') {
      warnings.push('عمق ثبت شده اما روش اندازه‌گیری «نامشخص» است؛ روش را بازبینی کنید.');
    }
    return { valid: errors.length === 0, errors, warnings };
  }
  function getRedFlags(doc = document) {
    return Object.keys(labels).filter(id => $(id, doc)?.checked).map(id => ({ id, label: labels[id] }));
  }
  function computeScores(doc = document) {
    const rows = [];
    const sinIds = ['sinSite', 'sinIsch', 'sinNeuro', 'sinInfect', 'sinArea', 'sinDepth'];
    const sin = sinIds.map(id => val(id, doc));
    if (sin.every(v => v === '0' || v === '1')) {
      rows.push({
        name: 'SINBAD',
        value: `${sin.reduce((sum, v) => sum + Number(v), 0)}/6`,
        raw: sin,
        note: 'مجموع مؤلفه‌های واردشده؛ هر مؤلفه خام کنار مجموع نگهداری می‌شود. تفسیر پیامد فردی یا تصمیم درمانی از امتیاز به‌تنهایی انجام نشود.',
        version: 'SINBAD / registry 1.0 — نیازمند تأیید نسخه و پروتکل مرکز'
      });
    } else {
      rows.push({ name: 'SINBAD', value: 'قابل محاسبه نیست', raw: sin, note: 'هر ۶ مؤلفه باید مقدار معتبر ۰ یا ۱ داشته باشند.' });
    }
    const push = [val('pushArea', doc), val('pushExudate', doc), val('pushTissue', doc)];
    const pushCount = push.filter(v => v !== '').length;
    rows.push({
      name: 'PUSH 3.0',
      value: `داده خام ${pushCount}/3`,
      raw: { area: push[0], exudate: push[1], tissue: push[2] },
      note: 'در این نسخه فقط داده خام ثبت می‌شود؛ مجموع امتیاز تا تأیید نسخه رسمی، جدول امتیازدهی و مجوز استفاده محاسبه نمی‌شود.',
      version: 'PUSH — raw capture only; scoring disabled pending authorization'
    });
    const bwatIds = Array.from({ length: 13 }, (_, i) => `bwat${i + 1}`);
    const bwat = bwatIds.map(id => val(id, doc));
    const bwatCount = bwat.filter(v => /^[1-5]$/.test(v)).length;
    rows.push({
      name: 'BWAT',
      value: `داده خام ${bwatCount}/13`,
      raw: Object.fromEntries(bwatIds.map((id, i) => [`item${i + 1}`, bwat[i]])),
      note: '۱۳ مشاهده امتیازدار موجود در فرم ثبت می‌شوند؛ مجموع کل غیرفعال است تا نسخه کامل ابزار، موارد توصیفی و مجوز استفاده توسط مرکز تأیید شوند.',
      version: 'BWAT — raw capture only; total scoring disabled'
    });
    const wifi = ['wWound', 'wIschemia', 'wInfection'].map(id => val(id, doc));
    rows.push({
      name: 'WIfI',
      value: wifi.every(v => /^[0-3]$/.test(v)) ? `W${wifi[0]} · I${wifi[1]} · fI${wifi[2]}` : 'اجزای ناقص',
      raw: { wound: wifi[0], ischemia: wifi[1], infection: wifi[2] },
      note: 'فقط درجات اجزا ثبت می‌شوند؛ مرحله نهایی WIfI بدون جدول رسمی ترکیب و داده‌های عروقی لازم استنتاج نمی‌شود.',
      version: 'WIfI — component capture only'
    });
    return rows;
  }
  function renderUrgentBanner(doc = document) {
    const host = $('clinicalRedFlagStatus', doc);
    if (!host) return [];
    const flags = getRedFlags(doc);
    host.hidden = flags.length === 0;
    host.replaceChildren();
    if (flags.length) {
      const title = doc.createElement('strong');
      title.textContent = 'هشدار ارجاع فوری ثبت‌شده توسط ارزیاب';
      const list = doc.createElement('ul');
      flags.forEach(flag => {
        const li = doc.createElement('li'); li.textContent = flag.label; list.append(li);
      });
      const note = doc.createElement('p');
      note.textContent = 'این هشدار بر اساس انتخاب ارزیاب است و تشخیص خودکار نیست. ارزیابی حضوری فوری و مسیر ارجاع مرکز را اجرا کنید؛ سامانه جایگزین قضاوت بالینی یا خدمات اورژانسی نیست.';
      host.append(title, list, note);
    }
    return flags;
  }
  function renderValidationMessages(result, doc = document) {
    const host = $('clinicalValidationWarnings', doc);
    if (!host) return;
    host.replaceChildren();
    const warnings = result?.warnings || [];
    host.hidden = warnings.length === 0;
    if (warnings.length) {
      const title = doc.createElement('strong'); title.textContent = 'موارد نیازمند بازبینی';
      const list = doc.createElement('ul');
      warnings.forEach(message => { const li = doc.createElement('li'); li.textContent = message; list.append(li); });
      host.append(title, list);
    }
  }
  Object.keys(labels).forEach(id => $(id)?.addEventListener('change', () => renderUrgentBanner(document)));
  global.WoundAIClinical = { validateForm, getRedFlags, computeScores, renderUrgentBanner, renderValidationMessages };
})(window);
