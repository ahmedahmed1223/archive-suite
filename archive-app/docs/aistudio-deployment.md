# تشغيل التطبيق في Google AI Studio

Video Archive يبني كـ **HTML بملف واحد** عبر `vite-plugin-singlefile`، فيكون
ملائمًا لـ Google AI Studio "Apps" حيث ترفع HTML/JS قائمين بذاتيهما.

## البناء

```bash
npm install
npm run build:aistudio
```

يولّد ملفًّا واحدًا في `dist-aistudio/index.html` — كل شيء (JS، CSS، الخطوط)
مضمَّن داخل HTML. لا روابط لـ CDN، لا ملفّات إضافية.

## ما يختلف عن `build:spa`

| البند | `build:spa` | `build:aistudio` |
|------|-------------|------------------|
| Output | `dist/index.html` | `dist-aistudio/index.html` |
| Single-file | نعم | نعم |
| `__VITE_AISTUDIO__` | `false` | **`true`** |
| الـ backend الافتراضي عند أوّل تشغيل | اختيار في wizard | **محلي مباشرة** (IndexedDB) |
| خيار خادم سحابي في setup wizard | معروض | **مخفي** (AI Studio iframe لا يصل لـ remote APIs) |

> الـ wizard يتفقّد `__VITE_AISTUDIO__` ويبدّل خطوة backend-choice بمعلومة
> «العمل المحلي فقط داخل AI Studio» (انظر شطر spB-B٣).

## رفع الـ HTML إلى AI Studio

1. افتح [Google AI Studio](https://aistudio.google.com).
2. من الواجهة، اختر **Build** ثم **New app**.
3. ارفع `dist-aistudio/index.html` كأصل (asset) للتطبيق.
4. اضبط الـ runtime على **Static HTML** (لا حاجة لـ server-side execution).
5. شغّل preview للتأكّد من تحميل الواجهة.

## القيود داخل AI Studio

| القدرة | الوضع |
|--------|------|
| تخزين IndexedDB | يعمل (مرتبط بـ origin الـ iframe) |
| رفع ملفّات محلية | يعمل عبر `<input type="file">` |
| الوصول إلى ملفّات نظام الجهاز | لا يعمل (sandbox) — الحلّ: المستخدم يستخدم رفع/تنزيل عبر المتصفّح |
| اتصال خادم خارجي | يعمل إذا origin مسموح، لكن AI Studio iframe قد يحجبه |
| Service Worker | غالبًا لا يعمل في iframe AI Studio |

> **الاستخدام المثالي:** تجربة سريعة للتطبيق + عرض demo. للإنتاج الجدّي،
> استخدم نشر Hostinger VPS (انظر [`archive-server/deploy/hostinger-vps.md`](https://github.com/ahmedahmed1223/archive-server/blob/main/deploy/hostinger-vps.md)).

## فحص حجم الـ bundle

```bash
ls -lh dist-aistudio/index.html
# يجب أن يكون ~1.6MB (gzip ~475KB) — قابل للرفع لـ AI Studio (الحدّ عادة 10MB).
```

## التحديث

```bash
git pull
npm install   # إن تغيّرت الاعتماديّات
npm run build:aistudio
# ارفع dist-aistudio/index.html الجديد في AI Studio (يستبدل القديم)
```
