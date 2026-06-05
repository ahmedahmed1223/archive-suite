# التصميم: مجموعة أدوات وسائط ffmpeg (مصغّرات/تحويل/صوت/مونتاج)

> التاريخ: 2026-06-04
> الحالة: ✅ مُعتمد — للتنفيذ بالكامل من الوكيل الآخر عبر `TASKS.md`.
> ملاحظة للمنفّذ: يفهم العربية لكنه **لا يلتزم RTL تلقائياً** — راجع «متطلبات RTL» قبل أي واجهة.

---

## 1. الهدف والنطاق

**الهدف:** توسيع تكامل ffmpeg في `archive-server` إلى مجموعة أدوات وسائط كاملة تُستخدم من
الواجهة: توليد المصغّرات/البوسترات، استخراج بيانات الوسائط (ffprobe)، استخراج الصوت، تحويل/ضغط
الفيديو (نسخة ويب)، ومعاينة GIF — إضافةً إلى تصدير المونتاج الموجود — يدوياً وأوتوماتيكياً، مع
متابعة العمليات ومعالجة الأخطاء.

**القيد الأساسي:** ffmpeg يعمل على الخادم؛ فيعالج **فقط** الوسائط الموجودة في FileStore (المرفوعة).
العناصر ذات المسار المحلي (المحجوب في المتصفح) تحتاج رفعاً أولاً، وتُعرض رسالة واضحة بدل الإجراء.

**داخل النطاق:**
- خادم: نواة argv نقية + مُشغّل + نقاط متزامنة سريعة + طابور مهام للثقيل.
- واجهة: عميل وسائط + إجراءات يدوية (تفاصيل/جماعي) + توليد تلقائي عند الرفع + لوحة متابعة المهام.

**خارج النطاق (لاحقاً):** سبرايت/storyboard للتمرير، تحرير non-linear متقدم داخل المتصفح، GPU transcode.

---

## 2. الحالة الحالية (الفحص)

- `archive-server/src/export/ffmpegPlan.js` — `buildFfmpegArgs` (argv نقي لتصدير timeline، نمط ممتاز يُحاكى).
- `archive-server/src/export/mp4.js` — `exportTimelineToMp4`: `spawn` ffmpeg، `resolveUnderRoot` (حارس traversal على جذر FileStore)، `runFfmpeg` قابل للحقن، مهلة 10د.
- `archive-server/src/api/server.js` — `POST /api/projects/export` يبثّ MP4 (تنزيل متزامن)؛ `/api/files/*` (list/status/url/put/get/delete) عبر FileStore.
- FileStore (disk/dropbox/s3/azure/gdrive): `putBlob/getBlob/getUrl/remove/list/describe`.
- الواجهة: `src/features/projects/exportClient.js` (MP4/EDL/JSON)؛ `src/features/media/viewModel.js` (مساعدات نقية: clock، رفع، صفوف متصفح)؛ ffmpeg مثبّت في `Dockerfile.server`.

**فجوات:** لا توليد مصغّرات/probe/استخراج صوت/تحويل؛ لا طابور مهام؛ لا توليد تلقائي عند الرفع.

---

## 3. القرارات المعتمدة

1. **القدرات:** ffprobe (مدة/دقة/كوديك/بِت‑ريت)، مصغّر/بوستر، استخراج صوت، تحويل/ضغط (نسخة ويب H.264)، معاينة GIF، وتصدير المونتاج (موجود، يُوسَّع للطابور).
2. **التنفيذ:** **متزامن** للسريع (probe، مصغّر، GIF قصير، صوت قصير)؛ **طابور غير متزامن** للثقيل (تحويل، مونتاج طويل) مع تقدّم وإشعار.
3. **المصدر/الناتج:** المصدر من FileStore (حارس traversal)؛ الناتج يُحفظ في FileStore عبر `putBlob` ببادئات `thumbnails/`، `audio/`، `derived/`، `previews/`؛ العنصر يخزّن مفاتيحها؛ يُخدَم عبر `/api/files/url`.
4. **يدوي + أوتوماتيكي + متابعة + أخطاء:** إجراءات يدوية (تفاصيل/جماعي)، توليد تلقائي (مصغّر+probe) عند الرفع، لوحة مهام للمتابعة، ومعالجة أخطاء واضحة + إعادة محاولة.
5. **الصلاحيات:** عمليات الكتابة (توليد/تحويل) لـ admin/editor فقط (نفس بوابة التصدير الحالية backend+token).

## 4. توصيات إضافية (مدمجة في المعالم)

- **بوستر ذكي:** التقاط الإطار عند ~10% من المدة (أو فلتر `thumbnail`) لتجنّب الإطارات السوداء.
- **تعبئة تلقائية للبيانات الوصفية:** كتابة المدة/الدقة من ffprobe على العنصر عند الرفع/التوليد.
- **توحيد تصدير المونتاج:** المونتاج الطويل يمرّ عبر الطابور (تقدّم + ناتج مخزَّن)، مع إبقاء المسار المتزامن للمشاريع القصيرة.
- **حد التزامن:** سقف لعدد عمليات ffmpeg المتوازية في الـ worker (مثلاً 1–2) لتجنّب إرهاق الخادم.
- **حدود الإدخال:** سقف للمدة/الحجم لكل عملية + مهلة لكل نوع.
- **التنظيف/الاحتفاظ:** حذف النواتج المشتقة (مصغّر/صوت/derived) من FileStore عند حذف العنصر نهائياً.
- **الأمان:** argv مصفوفة فقط (لا shell، لا حقن أوامر)، حارس traversal (موجود)، تعقيم مفاتيح الإخراج (`sanitizeUploadKey`).
- **استعادة استخراج الصوت:** ناتج الصوت يصلح كمدخل لخط التفريغ (transcription) الموجود.

## 5. التفاصيل التقنية

### 5.1 نواة الوسائط (خادم، نقية)
`src/media/mediaPlan.js`: دوال argv نقية + كائن probe parse:
- `buildThumbnailArgs(src, { atSec, width, out })` → إطار JPEG/WebP.
- `buildGifPreviewArgs(src, { startSec, durationSec, width, fps, out })` → GIF متحرّك قصير.
- `buildAudioArgs(src, { format="mp3", bitrate, out })` → استخراج صوت.
- `buildTranscodeArgs(src, { height=720, codec="libx264", crf=23, out })` → نسخة ويب +faststart.
- `parseFfprobe(json)` → `{ durationSec, width, height, codec, bitrate, hasAudio }` (مدخل `ffprobe -v quiet -print_format json -show_format -show_streams`).
كلها نقية (لا exec) ومختبَرة في `verify`. المُشغّل = إعادة استخدام نمط `mp4.js` (`spawn` قابل للحقن) في `src/media/runMedia.js`.

### 5.2 النقاط (خادم)
- متزامنة (سريعة): `POST /api/media/probe` `{ key }` → بيانات ffprobe؛ `POST /api/media/thumbnail` `{ key, atSec?, width? }` → `{ outputKey }`؛ `POST /api/media/audio` `{ key, format? }` → `{ outputKey }`؛ `POST /api/media/preview` `{ key, startSec?, durationSec? }` → GIF `{ outputKey }`.
- غير متزامنة (طابور): `POST /api/media/jobs` `{ type:"transcode"|"montage", ... }` → `{ jobId }`؛ `GET /api/media/jobs` و`GET /api/media/jobs/:id` → الحالة/التقدّم/الناتج؛ `POST /api/media/jobs/:id/retry`.
- كلها admin/editor، تقرأ المصدر من FileStore وتكتب الناتج إليه.

### 5.3 نموذج الطابور
مخزن `media_jobs` (نفس التخزين): `{ id, type, sourceKey, params, status: queued|running|done|error, progress, outputKey, error, createdAt, updatedAt, requestedBy }`. عامل داخل عملية الخادم يسحب `queued`، يشغّل ffmpeg مع تحليل التقدّم من stderr، ويحدّث الحالة؛ سقف تزامن؛ إشعار عبر eventBus عند الاكتمال/الفشل.

### 5.4 الواجهة
`src/features/media/mediaClient.js` (fetch قابل للحقن): probe/thumbnail/audio/preview/transcode(job)/jobs. منطق نقي في `media/viewModel.js` (اختيار اللحظة، صياغة المهمة، تجميع حالة الطابور). الواجهات: DetailPage (إجراءات + عرض ffprobe)، الأرشيف (جماعي)، لوحة «مهام الوسائط»، وخُطّاف ما بعد الرفع (توليد مصغّر+probe تلقائياً).

## 6. متطلبات RTL الإلزامية (واجهات M-FF4/M-FF5)
`dir="rtl"` على الجذر؛ خصائص منطقية (`ms/me/ps/pe/start/end`) لا (`ml/mr/left/right`)؛ المفاتيح/المدد/الأكواد اللاتينية `dir="ltr"` داخل سياق عربي؛ أيقونات الاتجاه تتبع RTL؛ ممنوع `flex-row-reverse` المزدوج؛ أصناف سمة (`va-surface-muted`) لا ألوان داكنة ثابتة؛ شريط التقدّم وعناصر اللوحة متوافقة مع السمة؛ تحقّق بصري نهاري+ليلي.

## 7. الأخطاء والحالات الحدّية
- مصدر محلي/مفقود → رسالة «ارفع الملف أولاً» بدل الإجراء.
- فشل ffmpeg → الرمز + آخر ~500 حرف stderr (نمط `ExportError`)؛ مهلة للمتزامن.
- مهمة فاشلة → `status:error` + السبب + زر إعادة محاولة.
- FileStore غير مهيّأ → رسالة واضحة.
- حذف العنصر → تنظيف النواتج المشتقة.

## 8. الاختبار
- `verify` (خادم): argv النقية لكل عملية + `parseFfprobe` + نموذج `media_jobs` (انتقالات الحالة).
- `verify-media` (خادم): النقاط + الـ worker بـ `runFfmpeg`/FileStore وهميين (بلا ffmpeg حقيقي).
- `verify` (SPA): `mediaClient` (تحليل الاستجابة) + view-models (اختيار اللحظة/تجميع المهام).
- `test:a11y`: لوحة المهام + إجراءات التفاصيل (تباين v4 نهاري+ليلي).
- اختبار Docker (اختياري): توليد مصغّر/تحويل فعلي عبر الحزمة (يدوياً).

## 9. المعالم (للتنفيذ في `TASKS.md`)
- **M-FF1** نواة `mediaPlan` (argv + parseFfprobe) + `runMedia` + مُحلِّل/مخزِّن FileStore. (خادم)
- **M-FF2** نقاط متزامنة: probe/thumbnail/audio/preview. (خادم؛ يعتمد M-FF1)
- **M-FF3** طابور `media_jobs` + worker + تحويل/مونتاج طويل + retry + إشعار. (خادم؛ يعتمد M-FF1)
- **M-FF4** عميل واجهة + إجراءات يدوية (تفاصيل) + توليد تلقائي عند الرفع + عرض ffprobe. ⚠️RTL (يعتمد M-FF2)
- **M-FF5** جماعي (أرشيف) + لوحة متابعة المهام + معالجة الأخطاء/الإشعارات + التنظيف. ⚠️RTL (يعتمد M-FF3, M-FF4)

ترتيب موصى: M-FF1 → (M-FF2، M-FF3) → M-FF4 → M-FF5.
