(() => {
  const button = document.getElementById('tissueApiCheck');
  const input = document.getElementById('tissueApiUrl');
  const status = document.getElementById('tissueApiStatus');
  const details = document.getElementById('tissueApiDetails');
  if (!button || !input || !status || !details) return;
  button.addEventListener('click', async () => {
    let endpoint;
    try {
      endpoint = new URL(input.value.trim());
      if (endpoint.protocol !== 'https:' || endpoint.username || endpoint.password ||
          endpoint.search || endpoint.hash) throw new Error('invalid URL');
    } catch {
      status.textContent = 'نشانی معتبر HTTPS بدون نام کاربری یا رمز عبور وارد کنید.';
      return;
    }
    status.textContent = 'در حال بررسی اتصال سرور...';
    details.textContent = 'هیچ تصویر یا اطلاعات بیمار ارسال نمی‌شود.';
    button.disabled = true;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    try {
      const healthUrl = endpoint.origin + endpoint.pathname.replace(/\/$/, '') + '/health';
      const response = await fetch(healthUrl, {
        signal: controller.signal, cache: 'no-store', credentials: 'omit'
      });
      if (!response.ok) throw new Error('HTTP ' + response.status);
      const result = await response.json();
      const loaded = result.model_loaded === true;
      status.textContent = loaded
        ? 'سرور در دسترس است و بارگذاری مدل را گزارش می‌کند؛ این به معنی تأیید دقت بالینی نیست.'
        : 'سرور در دسترس است، ولی مدل واقعی هنوز بارگذاری نشده است.';
      details.textContent =
        'اتصال HTTPS: موفق\n' +
        'مدل بارگذاری شده: ' + (loaded ? 'بله' : 'خیر') + '\n' +
        'استفاده بالینی: غیرفعال در WoundAI V29\n' +
        'ارسال تصویر: غیرفعال\n' +
        'پاسخ سرور:\n' + JSON.stringify(result, null, 2);
    } catch (err) {
      status.textContent = 'اتصال برقرار نشد. سرور، HTTPS و CORS را بررسی کنید.';
      details.textContent = 'خطا: ' + (err.name === 'AbortError' ? 'پایان زمان انتظار' : err.message);
    } finally {
      clearTimeout(timeout);
      button.disabled = false;
    }
  });
})();
