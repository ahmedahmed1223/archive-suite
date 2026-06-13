# دليل تشغيل full-stack

> آخر تحديث: 2026-06-04

هذا الدليل يشغّل منصة الأرشيف كسيناريو إنتاج مصغّر: خادم API، قاعدة بيانات،
مخزن ملفات، مزود AI، ثم رفع مادة وتفريغها.

## 1. المتطلبات

- Node.js 22.12+ و npm.
- Docker عند تشغيل Postgres محلي أو حاويات الخادم.
- حساب admin داخل التطبيق السحابي.
- مفاتيح اختيارية حسب الاستخدام:
  - `AI_PROVIDER` و`AI_API_KEY` للتلخيص والوسوم والتدقيق.
  - `TRANSCRIBE_PROVIDER` و`TRANSCRIBE_API_KEY` للتفريغ.
  - Dropbox app key/secret أو access token عند استخدام Dropbox FileStore.

## 2. الخادم وقاعدة البيانات

من مجلد `archive-server`:

```bash
npm install
```

لـPostgres خارجي أو محلي، اضبط:

```bash
BACKEND=postgres
DATABASE_PROVIDER=postgresql
DATABASE_URL=postgresql://archive:password@postgres:5432/archive
AUTH_SECRET=change-me
```

المحرّكات المدعومة في واجهة الإعدادات وحفظ config هي:

| المحرّك | `DATABASE_PROVIDER` | مثال URL |
|---|---|---|
| PostgreSQL | `postgresql` | `postgresql://user:pass@host:5432/db` |
| MySQL | `mysql` | `mysql://user:pass@host:3306/db` |
| SQLite | `sqlite` | `file:./archive.sqlite` |
| SQL Server | `sqlserver` | `sqlserver://user:pass@host:1433/db` |

يمكن أيضاً حفظ `{ engine, url }` من واجهة الإعدادات السحابية عبر بطاقة قاعدة
البيانات، ثم إعادة تشغيل الخادم. تبديل المحرّك ليس runtime toggle (Prisma 7 لا
يسمح بـ `env()` داخل `provider`)؛ بل يُحدَّد **وقت التوليد**: سكربت
`scripts/set-db-provider.mjs` يعيد كتابة `provider` في `schema.prisma` من
`DATABASE_PROVIDER` تلقائياً قبل التوليد/الترحيل (يعمل ضمن `prisma:generate` و
`prisma:migrate`). لذا يكفي ضبط `DATABASE_PROVIDER` (+ربط Prisma driver adapter
المناسب في صورة الخادم لغير Postgres) ثم تشغيل:

```bash
DATABASE_PROVIDER=mysql npm run prisma:generate   # أو postgresql | sqlite | sqlserver
DATABASE_PROVIDER=mysql npm run prisma:migrate
```

بعد نجاح migration أعد تشغيل `archive-server` وافتح `/api/health` للتأكد أن
`db.ok=true`.

## 3. مخزن الملفات

### Disk

```bash
FILE_STORE=disk
FILE_STORE_DIR=.archive-files
```

### Dropbox يدوي

```bash
FILE_STORE=dropbox
DROPBOX_ACCESS_TOKEN=...
DROPBOX_ROOT_PATH=/archive
```

### Dropbox OAuth

```bash
FILE_STORE=dropbox
DROPBOX_APP_KEY=...
DROPBOX_APP_SECRET=...
DROPBOX_ROOT_PATH=/archive
```

بعد تشغيل الخادم، افتح الواجهة السحابية كـadmin:

1. الإعدادات.
2. الصيانة.
3. مخزن الملفات.
4. أدخل App key/secret وroot path.
5. اضغط `ربط Dropbox`.

لحسابات Dropbox Business يمكن ضبط:

```bash
DROPBOX_SELECT_USER=dbid:...
DROPBOX_SELECT_ADMIN=dbid:...
```

أو إدخالها من بطاقة مخزن الملفات.

## 4. مزود AI والتفريغ

للمساعدة النصية:

```bash
AI_PROVIDER=openrouter
AI_API_KEY=...
AI_MODEL=...
```

للتفريغ الصوتي:

```bash
TRANSCRIBE_PROVIDER=openai
TRANSCRIBE_API_KEY=...
TRANSCRIBE_MODEL=whisper-1
```

عند غياب المفاتيح تختفي إجراءات AI من الواجهة أو تظهر رسالة أن المزود غير مهيأ.

## 5. الواجهة السحابية

من مجلد `archive-app`:

```bash
npm install
npm run build:cloud
```

ارفع `dist-cloud` خلف الخادم أو شغّلها عبر proxy يوجه `/api` إلى
`archive-server`.

## 5.1 التخزين المحلي بدون خادم

عند اختيار الوضع المحلي من معالج البدء أو الإعدادات، يمكن استخدام:

| المحرّك المحلي | السلوك |
|---|---|
| IndexedDB | الافتراضي المستقر في كل المتصفحات المدعومة. |
| SQLite (WASM) | يستخدم `sql.js` وOPFS لحفظ ملف `VideoArchiveDB.sqlite` داخل المتصفح، مع تصدير/استيراد ملف `.sqlite` من المحوّل. إذا لم يدعم المتصفح OPFS يتراجع التطبيق تلقائياً إلى IndexedDB. |

## 6. اختبار المسار الكامل

1. سجّل الدخول كـadmin.
2. افتح الإعدادات > الصيانة > مخزن الملفات.
3. اضغط `اختبار الاتصال` وتأكد أن `list` يعمل.
4. افتح `رفع الملفات`.
5. ارفع ملف فيديو أو صوت إلى مجلد مثل `uploads`.
6. افتح الأرشيف وأضف مادة تربط المسار أو الملف المحلي.
7. افتح صفحة التفريغ واختر ملفاً صوتياً/مرئياً.
8. شغّل التفريغ.
9. افتح المادة في صفحة التفاصيل واستخدم `AI Workbench` للتلخيص أو الوسوم.
10. أنشئ مجموعة، أضف المادة، ثم أنشئ رابط مشاركة.

## 7. تحقق سريع

من `archive-server`:

```bash
node scripts/verify-api.mjs
node scripts/verify-share.mjs
node scripts/verify-files-dropbox.mjs
node scripts/verify-dropbox-oauth.mjs
```

من `archive-app`:

```bash
node scripts/verify-modules.mjs
npm run build:cloud
```

إذا فشل رفع الملفات، افحص FileStore أولاً. إذا فشل AI، افحص مزود AI ثم
`/api/ai/rpc` و`/api/ai/transcribe` من الخادم.
