(() => {
  'use strict';
  const byId = id => document.getElementById(id);
  const button = byId('tissueApiCheck');
  const input = byId('tissueApiUrl');
  const status = byId('tissueApiStatus');
  const details = byId('tissueApiDetails');
  const imageInput = byId('tissueImageFile');
  const consent = byId('tissueResearchConsent');
  const analyzeButton = byId('tissueAnalyzeButton');
  const analyzeStatus = byId('tissueAnalyzeStatus');
  const resultHost = byId('tissueAnalyzeResult');
  const resultWarning = byId('tissueResultWarning');
  const classResults = byId('tissueClassResults');
  const maskPreview = byId('tissueMaskPreview');
  if (!button || !input || !status || !details) return;

  let verifiedEndpoint = null;
  let modelReady = false;
  const MAX_IMAGE_BYTES = 15_000_000;
  const MAX_RESPONSE_CHARS = 12_000_000;

  function validateEndpoint(raw) {
    const endpoint = new URL(raw.trim());
    const localHttp = endpoint.protocol === 'http:' &&
      ['localhost', '127.0.0.1', '[::1]'].includes(endpoint.hostname);
    const configuredOrigins = Array.isArray(window.WOUNDAI_API_ALLOWED_ORIGINS)
      ? window.WOUNDAI_API_ALLOWED_ORIGINS : [];
    const originAllowed = endpoint.origin === window.location.origin ||
      configuredOrigins.includes(endpoint.origin) || localHttp;
    if (!(endpoint.protocol === 'https:' || localHttp) || !originAllowed ||
        endpoint.username || endpoint.password || endpoint.search || endpoint.hash) {
      throw new Error('نشانی API مجاز نیست؛ HTTPS یا localhost و مبدأ مجاز لازم است.');
    }
    return endpoint;
  }

  function apiUrl(endpoint, path) {
    const basePath = endpoint.pathname.replace(/\/+$/, '');
    return `${endpoint.origin}${basePath}${path}`;
  }

  async function fetchJson(url, options = {}, timeoutMs = 8000) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(url, {
        ...options, signal: controller.signal, cache: 'no-store', credentials: 'omit',
        headers: { Accept: 'application/json', ...(options.headers || {}) }
      });
      const text = await response.text();
      if (text.length > MAX_RESPONSE_CHARS) throw new Error('پاسخ سرور بیش از حد بزرگ است.');
      let data;
      try { data = JSON.parse(text); }
      catch { throw new Error('پاسخ سرور JSON معتبر نیست.'); }
      if (!response.ok) {
        const message = typeof data.detail === 'string' ? data.detail : `HTTP ${response.status}`;
        const err = new Error(message);
        err.status = response.status;
        throw err;
      }
      return data;
    } finally {
      clearTimeout(timeout);
    }
  }

  function updateAnalyzeAvailability() {
    const hasImage = !!imageInput?.files?.[0];
    const file = imageInput?.files?.[0];
    const fileOkay = !!file && file.size > 0 && file.size <= MAX_IMAGE_BYTES &&
      ['image/png', 'image/jpeg', 'image/webp'].includes(file.type);
    if (imageInput) imageInput.disabled = !modelReady;
    if (consent) consent.disabled = !modelReady;
    if (analyzeButton) analyzeButton.disabled = !(modelReady && fileOkay && consent?.checked);
    if (file && !fileOkay && analyzeStatus) {
      analyzeStatus.textContent = 'فایل باید PNG، JPEG یا WEBP و حداکثر ۱۵ مگابایت باشد.';
    }
  }

  async function checkHealth(raw) {
    const endpoint = validateEndpoint(raw);
    const result = await fetchJson(apiUrl(endpoint, '/health'), {}, 8000);
    return { endpoint, result };
  }

  button.addEventListener('click', async () => {
    modelReady = false;
    verifiedEndpoint = null;
    updateAnalyzeAvailability();
    let endpoint;
    try {
      endpoint = validateEndpoint(input.value);
    } catch (err) {
      status.textContent = err.message;
      details.textContent = 'هیچ تصویری ارسال نشده است.';
      return;
    }
    status.textContent = 'در حال بررسی اتصال سرور...';
    details.textContent = 'در حال دریافت وضعیت سرویس و مدل؛ هنوز تصویری ارسال نمی‌شود.';
    button.disabled = true;
    try {
      const { result } = await checkHealth(endpoint.href);
      verifiedEndpoint = endpoint;
      modelReady = result.model_loaded === true && result.clinical_use === false;
      status.textContent = modelReady
        ? 'Runtime پژوهشی از سوی سرور آماده گزارش شده است؛ این وضعیت به معنی اعتبارسنجی بالینی نیست.'
        : 'سرور در دسترس است، اما runtime معتبر پژوهشی آماده نیست؛ تحلیل تصویر غیرفعال باقی می‌ماند.';
      details.textContent =
        `اتصال سرور: موفق\nمدل: ${result.model || 'نامشخص'}\n` +
        `نسخه مدل: ${result.model_version || 'نامشخص'}\n` +
        `Checkpoint تأییدشده: ${result.checkpoint_verified === true ? 'بله' : 'خیر'}\n` +
        `استفاده بالینی: همیشه غیرفعال\n` +
        `دلیل وضعیت: ${result.reason || 'گزارش نشده'}\n` +
        `پاسخ سرور:\n${JSON.stringify(result, null, 2).slice(0, 12000)}`;
      if (!modelReady && analyzeStatus) {
        analyzeStatus.textContent = 'مدل معتبر نصب و تأیید نشده است؛ هیچ تصویری ارسال نکنید.';
      }
    } catch (err) {
      status.textContent = 'اتصال برقرار نشد. وضعیت سرور، HTTPS/localhost و تنظیمات CORS را بررسی کنید.';
      details.textContent = `خطا: ${err.name === 'AbortError' ? 'پایان زمان انتظار ۸ ثانیه‌ای' : err.message}`;
    } finally {
      button.disabled = false;
      updateAnalyzeAvailability();
    }
  });

  imageInput?.addEventListener('change', () => {
    if (resultHost) resultHost.hidden = true;
    updateAnalyzeAvailability();
  });
  consent?.addEventListener('change', updateAnalyzeAvailability);

  analyzeButton?.addEventListener('click', async () => {
    if (!modelReady || !verifiedEndpoint || !consent?.checked) return;
    const file = imageInput?.files?.[0];
    if (!file || file.size <= 0 || file.size > MAX_IMAGE_BYTES ||
        !['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) {
      analyzeStatus.textContent = 'فایل تصویر معتبر نیست یا از حد مجاز بزرگ‌تر است.';
      return;
    }
    analyzeButton.disabled = true;
    analyzeStatus.textContent = 'تصویر برای پردازش پژوهشی به سرور ارسال می‌شود...';
    resultHost.hidden = true;
    const form = new FormData();
    form.append('image', file, 'deidentified-wound-image');
    try {
      const cloudAuth = window.WoundAISupabase;
      if (!cloudAuth || !cloudAuth.authenticated()) {
        throw new Error('برای ارسال تصویر پژوهشی ابتدا وارد حساب امن مرکز شوید.');
      }
      const accessToken = await cloudAuth.getAccessToken();
      const result = await fetchJson(apiUrl(verifiedEndpoint, '/v1/tissue/analyze'), {
        method: 'POST', body: form,
        headers: { Authorization: `Bearer ${accessToken}` }
      }, 90000);
      if (result.ai_generated !== true || result.clinical_use !== false ||
          result.research_only !== true || result.diagnosis !== null) {
        throw new Error('قرارداد ایمنی خروجی مدل معتبر نیست؛ نتیجه نمایش داده نشد.');
      }
      if (!Array.isArray(result.classes) || result.classes.length > 6) {
        throw new Error('ساختار خروجی قطعه‌بندی معتبر نیست.');
      }
      classResults.replaceChildren();
      result.classes.forEach(item => {
        if (!item || typeof item.name !== 'string' ||
            !Number.isFinite(item.pixels) || !Number.isFinite(item.percent_of_wound)) return;
        const row = document.createElement('p');
        const confidence = Number.isFinite(item.confidence)
          ? ` · اطمینان مدل: ${(item.confidence * 100).toFixed(1)}٪` : ' · اطمینان گزارش نشده';
        row.textContent = `${item.name}: ${item.percent_of_wound}% (${item.pixels} پیکسل)${confidence}`;
        classResults.append(row);
      });
      resultWarning.textContent = result.warning || 'خروجی پژوهشی است و تشخیص یا توصیه درمانی نیست.';
      const mask = result.mask_png_base64;
      if (typeof mask === 'string' && mask.length > 0 && mask.length <= 10_700_000 &&
          /^[A-Za-z0-9+/]+={0,2}$/.test(mask)) {
        maskPreview.src = `data:image/png;base64,${mask}`;
        maskPreview.hidden = false;
      } else {
        maskPreview.removeAttribute('src');
        maskPreview.hidden = true;
      }
      resultHost.hidden = false;
      analyzeStatus.textContent = `پردازش پژوهشی انجام شد؛ مدل ${result.model || 'نامشخص'}، نسخه ${result.model_version || 'نامشخص'}. نتیجه ذخیره نمی‌شود و باید توسط متخصص بازبینی شود.`;
    } catch (err) {
      analyzeStatus.textContent = err.status === 503
        ? 'مدل روی سرور آماده نیست؛ تصویر تحلیل نشد.'
        : `تحلیل انجام نشد: ${err.name === 'AbortError' ? 'زمان پردازش بیش از حد مجاز شد.' : err.message}`;
    } finally {
      updateAnalyzeAvailability();
    }
  });
})();
