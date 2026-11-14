# WoundAI Pro — Release v30.7

نسخه ۳۰.۷ بر پایه بسته ۳۰.۶ ساخته شده است. این بسته مدیریت نقش اعضای مرکز، کنترل تعارض نسخه رکورد، Snapshot منطقی پایگاه داده و صف آفلاین تصاویر را اضافه می‌کند.

## قابلیت‌های v30.7

### ۱) کنترل تعارض و نسخه رکورد
- افزودن `revision`, `updated_at`, `updated_by` به جداول بالینی.
- trigger سمت پایگاه داده که revision را در هر update افزایش می‌دهد.
- متد `updateRowsVersioned` در کلاینت: فقط وقتی revision فعلی برابر revision مورد انتظار باشد، update انجام می‌شود.
- در صورت تغییر هم‌زمان، خطای `WOUNDAI_CONFLICT` همراه با نسخه فعلی رکورد برمی‌گردد.
- مسیر انتقال پرونده بیمار از upsert بی‌قید برای رکوردهای موجود به compare-and-swap تغییر کرده است.
- انتقال بین‌دستگاهی همچنان با اقدام دستی کاربر انجام می‌شود؛ Realtime/live sync برای همه فرم‌ها هنوز کامل نیست.

### ۲) مدیریت اعضا و نقش‌ها
- فهرست اعضای مرکز با UUID و نقش.
- RPC امن `manage_clinic_member` برای افزودن عضو موجود، تغییر نقش یا حذف عضویت.
- فقط owner/admin مجاز به مدیریت اعضا هستند.
- admin نمی‌تواند owner یا admin دیگر را تغییر دهد.
- admin فقط می‌تواند نقش clinician/reviewer/viewer بدهد.
- آخرین owner قابل حذف یا تنزل نقش نیست.
- تغییرات عضویت در audit_events ثبت می‌شود.
- دعوت ایمیلی کاربر جدید در این بسته نیست؛ کاربر باید از قبل در Supabase Auth وجود داشته باشد و UUID او وارد شود.

### ۳) Snapshot و بازیابی سمت سرور
- RPC ساخت Snapshot منطقی برای بیماران، زخم‌ها، metadata تصاویر، encounterها، ارزیابی‌ها، برنامه‌های مراقبتی و نوبت‌ها.
- حداکثر ۳۰ Snapshot برای هر مرکز نگهداری می‌شود.
- فقط owner/admin می‌توانند Snapshot بسازند و فهرست را بخوانند.
- بازیابی فقط برای owner و با کد تأیید دقیق `RESTORE-<backup UUID>` انجام می‌شود.
- بازیابی فقط رکوردهای مفقود را درج می‌کند؛ رکوردهای موجود را overwrite نمی‌کند.
- اجرای زمان‌بندی‌شده روزانه از طریق فایل اختیاری `supabase/optional/enable_daily_backups_pg_cron.sql` در صورت پشتیبانی pg_cron امکان‌پذیر است.

**محدودیت حیاتی پشتیبان:** Snapshot در همان پایگاه داده پروژه نگهداری می‌شود؛ بنابراین پشتیبان مستقل خارج از دیتابیس یا جایگزین PITR/backup مدیریت‌شده ارائه‌دهنده نیست. فایل‌های باینری تصاویر در Snapshot قرار ندارند؛ فقط metadata و مسیر Storage ثبت می‌شود. برای حفاظت واقعی در برابر از دست رفتن کامل پروژه، پشتیبان‌گیری مستقل دیتابیس و Storage باید جداگانه فعال و بازیابی آن آزمایش شود.

### ۴) صف آفلاین تصاویر
- ذخیره Blob تصاویر در IndexedDB.
- صف محلی برای تصاویر زخم که هنگام انتقال با خطای شبکه مواجه شوند.
- ارسال مجدد دستی صف با نشست MFA سطح AAL2.
- حذف آیتم صف فقط پس از موفقیت upload فایل و ثبت metadata.
- داده محلی و تصویرهای اصلی در زمان صف‌گذاری پاک نمی‌شوند.
- این صف فقط برای تصاویر cloud upload است؛ تغییرات فرم‌های بالینی هنوز صف همگام‌سازی آفلاین عمومی ندارند.

## فایل‌های راهنما
- `MIGRATION-GUIDE-v30.7.md`: ترتیب استقرار و چک‌لیست staging.
- `TEST-REPORT-v30.7.txt`: نتایج آزمون‌های محلی و محدودیت‌ها.
- `V30-REMEDIATION-TRACKER-FA.md`: پیگیری اصلاحات و موارد باز.

## ترتیب استقرار دیتابیس
در پروژه staging مستقل و پس از بازبینی:
1. migration هسته v30.1/v30.2.
2. migration اصلاح‌شده v30.5 در صورت نیاز به نصب تازه.
3. migration v30.6.
4. migration v30.7: `supabase/migrations/202611160005_woundai_v30_7_concurrency_roles_backups.sql`.
5. اختیاری: `supabase/optional/enable_daily_backups_pg_cron.sql` فقط در صورت فعال‌بودن pg_cron و پس از بررسی دسترسی‌ها.

اگر migrationهای v30.5 یا v30.6 قبلاً با موفقیت اجرا شده‌اند، آن‌ها را دوباره اجرا نکنید. وضعیت migration history را بررسی کنید.

## آزمون‌های محلی
نتایج اجرای این بسته در `TEST-REPORT-v30.7.txt` ثبت شده است.
```bash
node --check app.js
node --check supabase-client-v30.js
node --check supabase-ui-v30.js
node --check cloud-sync-v30.js
node --check offline-image-store-v307.js
node --check sw.js
node tests/smoke-check.mjs
node tests/supabase-client-check.mjs
node tests/cloud-sync-check.mjs
node tests/offline-image-store-check.mjs
node tests/clinical-validation-check.mjs
node tests/tissue-api-client-check.mjs
python -m pytest -q research-tissue-api -p no:cacheprovider
```

## موارد باز و محدودیت‌ها
- migrationهای SQL در این بسته روی Supabase واقعی اجرا نشده‌اند.
- RPCها، RLS و Storage policies باید در staging با دو حساب و دو مرکز واقعی آزموده شوند.
- Revision-aware update در مسیر sync بیمار فعال است؛ همه فرم‌های بالینی هنوز به sync زنده و compare-and-swap متصل نشده‌اند.
- Realtime و conflict resolution تعاملی هنوز وجود ندارد.
- Snapshot همان پایگاه داده را هدف می‌گیرد و تصویرهای باینری را شامل نمی‌شود.
- pg_cron اختیاری است و تا اجرای فایل زمان‌بندی، Snapshot روزانه خودکار فعال نیست.
- صف آفلاین فقط تصاویر را پوشش می‌دهد؛ فرم‌ها همچنان در LocalStorage باقی می‌مانند.
- این نسخه برای استفاده بالینی با داده واقعی تأیید نشده است.
