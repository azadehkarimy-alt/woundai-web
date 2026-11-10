# WoundAI Pro Web — PWA v4.0

This is an incremental PWA build for mobile and desktop.

## Included in this build
- Uses the user-provided approved WoundAI wordmark artwork in the app brand area.
- Generates 192px and 512px install icons from that same supplied logo artwork.
- Adds a standard wound photography guide (lighting, perpendicular angle, full wound margin, scale at skin level).
- Camera preview no longer silently captures the first video frame. The user must tap **Capture photo**.
- Front/rear camera switching is available where supported by the browser.
- Adds two-point on-image scale selection: tap both ends of a known ruler/card distance, enter the real length in cm, then set calibration.
- Keeps manual polygon tracing and labels measurements as manual, clinician-reviewed measurements.
- Bumps the service-worker cache name to v4 to avoid serving stale v3 assets.

## Deploy to GitHub Pages
Upload the *contents* of this folder to the repository root, including `assets/`, then commit to the Pages source branch. Do not upload the ZIP as a single file.

## Important limitations
This is still a research/prototype build. It does not contain a clinically validated automatic wound segmentation model, a secure multi-user backend, or a central database. Local browser storage is not suitable for identifiable real-patient data. Do not use it as a clinical decision system.


## v5 usability update
- Added prominent dashboard shortcut to clinical assessment.
- Replaced tap-only boundary plotting with add-points and drag-to-edit pointer workflow.
- Added explicit boundary-close action and clearer mobile guidance.
- Imaging controls are arranged below the image in a full-width workflow.
- No validated automatic wound segmentation model or cloud backend is included.


## v6 clinical workflow update
- Scale calibration inputs are positioned immediately above the wound image.
- Boundary tracing, edit/add/close tools, area result and save controls are positioned immediately below the image.
- Added clinician-facing calculation summary for SINBAD, PUSH 3.0 component total, BWAT total, WIfI component tuple, and entered Wagner / University of Texas / NPIAP classifications.
- Added a draft care-plan builder based on entered wound etiology, signs, tissue findings and recorded values. It is a decision-support draft only and requires clinician review.
- PUSH area categories were expanded to the 0–10 area subscore bands; closed and epithelial tissue choices are separate.
- WIfI composite clinical stage is intentionally not auto-inferred from three component grades; perfusion data and official stage matrix / clinical interpretation are required.
- AI wound segmentation is still not included. No model-generated diagnosis is claimed.


## v7 report export
- Added patient + wound selector in Reports.
- Generates a one-page-style wound report as a high-resolution PNG download and print-to-PDF workflow.
- Report includes patient code/name, wound type/site, latest clinical assessment, image, measurements, tissue percentages, local signs, TIME, available scores/classifications, vitals, notes/interventions, follow-up and saved draft care plan.
- Missing fields are labeled as not recorded; report is generated from local browser data only.


## v8 brand + AI algorithm architecture
- Increased approved WoundAI logo visibility in the application sidebar and top-bar icon.
- Added explicit ANN, CNN and SVM architecture cards, following the initial wound-management research discussion.
- ANN is assigned to structured clinical/tabular data and longitudinal healing/risk modelling; CNN to image segmentation/tissue analysis; SVM to baseline/comparative classification.
- This is an architecture and integration specification only. Trained model weights, validated datasets, inference services and clinical validation are not included; no automated diagnosis is claimed.


## v9 patient portrait and ANN implementation readiness
- Added optional patient portrait upload in the patient registration form, client-side resized/compressed and saved with the local patient record; patient cards display the portrait. Wound photos remain separate in wound imaging.
- ANN task preserved from the initial project discussion: use structured clinical, image-derived and treatment/longitudinal features to estimate healing trajectory or treatment response. This requires a labelled, de-identified longitudinal dataset and a precisely defined target (e.g. percentage area reduction by a fixed follow-up window or healing/non-healing at a defined time).
- The current project contains no verified labelled training dataset or trained ANN weights. Therefore an honest trained predictor cannot be shipped yet. The UI must not fabricate predictions or reuse the literature-reported 96% as this product's performance.
- Recommended training split is patient-level (not image-level) with an independent test set; report AUROC/AUPRC for classification or MAE/RMSE for regression, calibration and subgroup performance. External validation and clinician review are required before clinical use.


## نسخه ۱۰ — تکمیل هفت محور ارزیابی تخصصی
این نسخه یک خروجی هفت‌محوره در بخش ارزیابی بالینی اضافه می‌کند:
1. طبقه‌بندی و گریدبندی: نمایش چارچوب‌های ثبت‌شده NPIAP، Wagner، University of Texas و WIfI؛ سیستم گرید را از روی داده ناقص حدس نمی‌زند.
2. بستر زخم: خلاصه درصد گرانولاسیون، اسلاف، نکروز و اپی‌تلیال.
3. ترشحات: مقدار و نوع ترشح و یادآوری مستندسازی تغییرات.
4. عفونت/التهاب: شدت ثبت‌شده و علائم موضعی، همراه با هشدار ارزیابی بالینی.
5. خطرها: پرچم‌های خطر بر اساس ایسکمی، علائم سیستمیک/موضعی، نکروز و درد شدید.
6. ملاحظات پانسمان: پیشنهاد خانواده پانسمان بر اساس مقدار ترشح و شرایط ثبت‌شده؛ نه نسخه قطعی یا انتخاب برند.
7. پلن و پیگیری: پاک‌سازی طبق پروتکل مرکز، حفاظت پوست اطراف، کنترل علت زمینه‌ای، کاهش فشار در صورت اندیکاسیون و پایش استاندارد.
خروجی هفت‌محوره و جزئیات آن در پیش‌نویس پلن مراقبت ذخیره می‌شود. همه پیشنهادها نیازمند بازبینی درمانگرند و جایگزین تشخیص/نسخه پزشکی نیستند.


## نسخه ۱۰.۱ — ممیزی و یکپارچه‌سازی هفت محور
هفت محور ارزیابی در زمان ورود به فرم بالینی نمایش داده می‌شوند و با تغییر ورودی‌های مرتبط به‌روزرسانی می‌شوند؛ دکمه محاسبه امتیاز و ساخت پلن نیز هر دو خروجی را تازه‌سازی می‌کنند. پرچم‌های خطر شامل فشار سیستولیک پایین، افزایش تعداد تنفس، اشباع اکسیژن پایین، دمای پایین، Probe-to-bone مثبت، علائم عفونت، ایسکمی، نکروز و درد شدید است. این آستانه‌ها غربالگری هشدارند و تشخیص سپسیس یا بیماری خاص نیستند. طبقه‌بندی‌های NPIAP/Wagner/UT/WIfI ورودی ارزیاب هستند؛ سامانه آن‌ها را از روی عکس یا داده ناقص حدس نمی‌زند. محاسبه SINBAD/PUSH/BWAT فقط با تکمیل ورودی‌های لازم انجام می‌شود. پیشنهاد پانسمان، خانواده‌های قابل بررسی را بر اساس ترشح و نشانه‌های ثبت‌شده مطرح می‌کند و نسخه قطعی نیست.


## مرحله اول — بازسازی هسته (نسخه توسعه‌ای)
- رفع خطای نحوی JavaScript در هسته برنامه و بررسی مجدد با `node --check`.
- مقاوم‌سازی بارگذاری و ذخیره‌سازی محلی؛ مدیریت خطاهای داده خراب، محدودیت فضا و عدم دسترسی به localStorage.
- جلوگیری از ثبت کد پرونده تکراری و الزام نام بیمار.
- حفظ صفحات و مسیرهای موجود: داشبورد، بیماران، ارزیابی بالینی، تصویربرداری، گزارش‌ها و امنیت.
- بزرگ‌تر شدن نمایش لوگوی WoundAI در سربرگ کناری و آواتار.
- افزایش نسخه کش Service Worker برای جلوگیری از نمایش فایل‌های کش‌شده قدیمی پس از استقرار.
- این نسخه هنوز نمونه توسعه‌ای محلی است؛ ورود چنددستگاهی و ذخیره امن سروری در مراحل بعدی انجام می‌شود.
- آزمون انجام‌شده: صحت نحوی JavaScript، نبود شناسه HTML تکراری، بررسی ارجاع‌های DOM استاتیک و صحت بسته ZIP. آزمون واقعی دوربین و مرورگر روی دستگاه فیزیکی هنوز لازم است.


## مرحله دوم — پرونده بیمار
- افزودن شماره تماس و مخاطب اضطراری.
- تفکیک داروهای مصرفی از سوابق پزشکی و جراحی.
- امکان مشاهده نمای کامل پرونده و زخم‌های وابسته.
- امکان ویرایش پرونده موجود بدون تغییر شناسه بیمار و حفظ ارتباط زخم‌ها و ارزیابی‌ها.
- کنترل یکتایی کد پرونده و اعتبارسنجی نام بیمار.
- امکان افزودن زخم از نمای جزئیات بیمار.
- عکس بیمار در پرونده نگهداری می‌شود و عکس زخم همچنان در بخش تصویربرداری ثبت می‌شود.
- ذخیره‌سازی همچنان محلی و محدود به مرورگر است؛ احراز هویت، همگام‌سازی چنددستگاهی و ذخیره امن سروری جزو مرحله نهم هستند.


## مرحله سوم — تصویربرداری و ثبت زخم
- اتصال هر عکس به بیمار و زخم مشخص؛ انتخاب بیمار فهرست زخم‌های فعال همان بیمار را بارگذاری می‌کند.
- ثبت چند تصویر برای هر زخم با تاریخ و ساعت مستقل.
- ثبت نوع تصویر (پایه، پیگیری، نمای نزدیک یا سایر) و یادداشت تصویربرداری.
- ذخیره ابعاد اصلی عکس، نسخه JPEG بهینه‌شده و فراداده تصویر.
- نمایش تاریخچه تصاویر زخم انتخاب‌شده برای پیگیری طولی.
- دوربین و گالری از مسیر موجود استفاده می‌کنند؛ عکس زخم از عکس پرسنلی بیمار جداست.
- تصاویر به JPEG با حداکثر ضلع ۱۶۰۰ پیکسل و کیفیت ۰٫۸۲ تبدیل می‌شوند تا فشار ذخیره‌سازی محلی کمتر شود؛ اصل فایل در این نمونه نگهداری نمی‌شود.
- داده‌ها همچنان در مرورگر محلی هستند؛ برای پرونده واقعی، بک‌اند امن و فضای ذخیره‌سازی رمزنگاری‌شده لازم است.


## مرحله چهارم — اندازه‌گیری و ترسیم زخم
- محاسبه طول و عرض تقریبی از کادر محاطی چندضلعی ترسیم‌شده، پس از بستن مرز و کالیبراسیون.
- محاسبه مساحت چندضلعی دستی با مقیاس ثبت‌شده.
- نمایش شبکه‌بندی قابل روشن/خاموش و سه فاصله شبکه.
- مقایسه درصد تغییر مساحت با آخرین ارزیابی ذخیره‌شده همان زخم.
- ذخیره طول، عرض و مساحت محاسبه‌شده در رکورد تصویر و ارزیابی.
- اندازه‌ها وابسته به کیفیت عکس، قرارگیری خط‌کش هم‌سطح پوست، زاویه دوربین و دقت ترسیم هستند. طول/عرض فعلاً ابعاد کادر محاطی در محورهای تصویرند و لزوماً بیشینه طول هندسی زخم نیستند.
- شبکه‌بندی نمایشی است و به‌تنهایی مقیاس واقعی ایجاد نمی‌کند؛ فقط کالیبراسیون معتبر امکان محاسبه سانتی‌متر را می‌دهد.


## مرحله پنجم — ماژول ANN پژوهشی
- افزودن صفحه مستقل ANN به ناوبری.
- پیاده‌سازی شبکه عصبی پیش‌خور چندلایه با ۸ ویژگی ورودی، ۱۰ نورون پنهان و دو خروجی دودویی.
- آموزش محلی با فایل CSV ناشناس و برچسب‌خورده؛ حداقل ۲۰ نمونه و حضور هر دو کلاس لازم است.
- جداسازی ثابت ۸۰/۲۰ آموزش و آزمون، استانداردسازی ویژگی‌ها، محاسبه دقت و ماتریس درهم‌ریختگی.
- ذخیره مدل آموزش‌دیده در فضای محلی مرورگر و اجرای پیش‌بینی روی ورودی دستی.
- قالب CSV قابل دانلود.
- این نسخه مدل از پیش‌آموزش‌دیده پزشکی ندارد. برچسب کلاس‌ها باید در مستندات دیتاست تعریف شوند؛ خروجی صرفاً پژوهشی است و احتمال‌ها کالیبره بالینی نیستند.
- CNN واقعی و تحلیل مستقیم تصویر در این مرحله پیاده‌سازی نشده است؛ برای آن معماری، مجموعه‌داده تصویری برچسب‌خورده، آموزش و اعتبارسنجی جداگانه لازم است.


## مرحله ششم — هفت ماژول تخصصی ارزیابی زخم
- فعال‌سازی خروجی یکپارچه هفت‌محوری: طبقه‌بندی/گریدبندی، بافت، ترشحات، عفونت/التهاب، خطرها، ملاحظات انتخاب خانواده پانسمان، پلن مراقبت و پیگیری.
- استفاده از داده‌های فرم بالینی، علائم موضعی، علائم حیاتی، اتیولوژی و مقیاس‌های ثبت‌شده توسط ارزیاب.
- نمایش مستقل خلاصه هر محور و تولید پیش‌نویس پلن با سطح فوریت مبتنی بر ورودی‌های هشداردهنده.
- ملاحظات پانسمان به‌صورت خانواده‌های قابل بررسی و مشروط ارائه می‌شود، نه نسخه محصول/دارو.
- ذخیره خروجی هفت محور و پیش‌نویس پلن همراه رکورد ارزیابی بالینی؛ امکان ثبت اصلاحات و علامت بازبینی متخصص در پیش‌نویس جداگانه.
- SINBAD و PUSH/BWAT فقط با تکمیل داده‌های لازم محاسبه می‌شوند؛ WIfI stage به‌صورت خودکار از ورودی ناقص استنتاج نمی‌شود.
- تصمیم‌های دبریدمان، آنتی‌بیوتیک، فشرده‌سازی، offloading و انتخاب نهایی پانسمان نیازمند ارزیابی و تأیید درمانگر است.


## اصلاحات یکپارچگی پس از مرحله ششم
- تکمیل ذخیره و ویرایش فیلدهای پرونده بیمار شامل تلفن، تماس ضروری، داروها، آلرژی، سوابق، عکس و رضایت.
- انتقال آخرین اندازه‌گیری ذخیره‌شده زخم به فیلدهای خالی طول و عرض ارزیابی بالینی؛ نمایش زمان، مساحت و وضعیت کالیبراسیون.
- افزودن انتقال داده‌های موجود فرم بالینی به ورودی‌های پژوهشی ANN؛ مساحت از اندازه‌گیری تصویر کالیبره‌شده یا حاصل طول×عرض دستی پر می‌شود.
- ذخیره خروجی پژوهشی ANN به‌عنوان رکورد جداگانه در تاریخچه زخم، بدون تبدیل آن به تشخیص یا توصیه درمانی.
- افزودن پیوند آخرین اندازه‌گیری تصویری و آخرین خروجی ANN به رکورد ارزیابی بالینی.
- اصلاح بازگشت وضعیت حافظه در صورت شکست ذخیره پیش‌نویس مراقبت.
- یادآوری: LocalStorage رمزنگاری‌شده یا ذخیره‌سازی چنددستگاهی امن نیست؛ احراز هویت و سرور امن هنوز باید در مرحله استقرار طراحی شود.
- آزمون واقعی دوربین، مرورگرهای موبایل و سناریوی چنددستگاهی در محیط کاربر نیازمند اجرای میدانی است.


## اصلاحات یکپارچگی پس از مرحله ششم
- گزارش اصلاحات و آزمون‌ها در فایل «گزارش-اصلاحات-یکپارچگی-مراحل-۱-تا-۶.md» قرار دارد.
- مسیر انتقال اندازه‌گیری به ارزیابی بالینی اصلاح و خطای تابع تعریف‌نشده رفع شد.
- اتصال عکس به زخم دیگر با شنونده قدیمی به‌صورت ضمنی تغییر نمی‌کند.
- snapshot ارزیابی بالینی شناسه‌ها و فراداده تصویر و خروجی ANN همان زخم را ثبت می‌کند.
- آموزش ANN با تقسیم طبقه‌بندی‌شده و استانداردسازی فقط روی داده آموزش اصلاح شد.


## مرحله هفتم — برنامه مراقبتی و پشتیبان تصمیم بالینی
- صفحه مستقل برای انتخاب بیمار و زخم و دریافت آخرین ارزیابی بالینی ذخیره‌شده همان زخم.
- نمایش خلاصه بیمار/زخم، اندازه‌گیری تصویری مرتبط، وضعیت ANN پژوهشی، هشدارها، هفت محور تخصصی و اقدامات پیشنهادی.
- عدم تولید برنامه در نبود ارزیابی بالینی ذخیره‌شده یا داده کافی؛ نمایش پیام روشن برای تکمیل ارزیابی.
- امکان ذخیره پیش‌نویس برنامه و ثبت اصلاحات متخصص.
- تأیید نهایی نیازمند نام متخصص و پذیرش صریح مسئولیت تأیید است.
- هر نسخه برنامه با شناسه بیمار، زخم، ارزیابی منبع، زمان، وضعیت، نام و شناسه حرفه‌ای متخصص ذخیره می‌شود.
- تاریخچه پیش‌نویس‌ها و برنامه‌های تأییدشده برای هر زخم نمایش داده می‌شود.
- این موتور در این نسخه مبتنی بر قواعد و اطلاعات ثبت‌شده است؛ ANN صرفاً به‌عنوان خروجی پژوهشی نمایش داده می‌شود و مستقیماً تصمیم درمانی نمی‌گیرد.
- هیچ دارو، آنتی‌بیوتیک، دبریدمان یا فشرده‌سازی به‌صورت خودکار تجویز یا اجرا نمی‌شود؛ تأیید درمانگر الزامی است.


## مراحل ۸ تا ۱۰
جزئیات قابلیت‌ها، آزمون‌های انجام‌شده و محدودیت‌های انتشار در «گزارش-مراحل-هشتم-تا-دهم.md» ثبت شده است. این نسخه ورود ابری و همگام‌سازی چنددستگاهی واقعی ندارد؛ استفاده از اطلاعات واقعی بیمار تا استقرار بک‌اند امن مجاز نیست.
