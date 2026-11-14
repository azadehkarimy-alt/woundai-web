# WoundAI Pro — Release v30.5

تاریخ: ۱۴ نوامبر ۲۰۲۶  
مبنای توسعه: WoundAI Version 30.4

## هدف بسته
سخت‌سازی مسیر دسترسی به API پژوهشی و ایجاد audit trail خودکار در سطح پایگاه داده.

## تغییرات
1. احراز هویت endpointهای `POST /v1/tissue/analyze` و `POST /v1/tissue/quantify-mask` با اعتبارسنجی access token از طریق Supabase Auth.
2. fail-closed در صورت نبود تنظیمات سرور؛ درخواست‌های بدون/با نشست نامعتبر 401 و پیکربندی ناقص سرور 503.
3. دریافت توکن کوتاه‌عمر از نشست Supabase و ارسال آن در Authorization Bearer؛ بدون service-role key در مرورگر.
4. محدودسازی نرخ درون‌پردازه‌ای؛ مقدار پیش‌فرض ۱۲ درخواست در دقیقه برای هر IP و route.
5. CORS فقط برای originهای دقیق `WOUNDAI_ALLOWED_ORIGINS`.
6. حذف EXIF و metadata تصویر با decode/re-encode قبل از inference.
7. Migration audit trigger برای clinics (بدون حذف)، clinic_members، patients، wounds، wound_images، assessments، care_plans، encounters و appointments.
8. لغو دسترسی مستقیم کلاینت برای جعل/ویرایش/حذف رویدادهای audit.
9. به‌روزرسانی نسخه برنامه، PWA و Service Worker به 30.5؛ حفظ formVersion بالینی 30.4.

## آزمون‌ها
- بررسی نحوی JavaScript و Python.
- Smoke test و کنترل نسخه/cache.
- تست Supabase client و access-token accessor.
- تست رابط ارسال تصویر با Bearer token.
- تست API: احراز هویت، fail-closed، CORS، rate limit، sanitization و adapter.
- تست ایستای SQL migration.

## محدودیت‌ها و موارد نیازمند اجرای بیرونی
- Migration روی پروژه واقعی Supabase اجرا نشده است؛ فقط فایل SQL و تست ایستای آن تحویل شده.
- آزمون اتصال واقعی Supabase Auth در staging انجام نشده؛ تست HTTP با mock اجرا شده است.
- rate limit درون‌پردازه‌ای است؛ برای چند worker یا چند replica باید در API Gateway/Redis محدودیت مشترک اعمال شود.
- audit triggerهای دیتابیس تا اجرای migration فعال نیستند.
- حذف metadata تضمین نمی‌کند که خود محتوای بصری تصویر فاقد اطلاعات شناسایی‌کننده باشد.
- API هنوز ارتباط تحلیل را به clinic_id، پرونده، رضایت و audit رویداد تصویر متصل نمی‌کند.
- هیچ مدل AI واقعی در بسته نصب نشده؛ endpoint پس از احراز هویت همچنان در وضعیت بدون مدل 503 می‌دهد.
- آزمون موبایل/دسکتاپ واقعی، نفوذپذیری، DPIA/GDPR و اعتبارسنجی بالینی خارج از این تحویل هستند.

## نتیجه
بسته 30.5 کنترل دسترسی و ثبت تغییرات را در سطح کد و migration تقویت می‌کند؛ این تحویل به معنی استقرار موفق در Supabase یا تأیید استفاده بالینی نیست.


## اصلاح وابستگی migration در بسته v30.6
در نسخه تحویلی v30.6، دو trigger مربوط به `encounters` و `appointments` از migration v30.5 برداشته شده‌اند؛ این جدول‌ها در migration هسته وجود نداشتند و در v30.6 ساخته می‌شوند. برای نصب تازه، migration اصلاح‌شده v30.5 و سپس migration v30.6 اجرا شود. اگر migration v30.5 قبلاً با موفقیت اجرا شده، دوباره اجرا نشود.
