# مصفوفة التوافق بين المنصات
# Platform Parity Matrix

**تاريخ آخر تحديث:** 2026-07-13  
**مصدر الحقيقة:** `infra/platform/compatibility.v1.json`

## الحالة الحالية — جدول المنصات وأوضاع النشر

| المنصة | الوضع | الحالة | نقطة الدخول | ملاحظات |
|--------|-------|--------|------------|---------|
| Windows 10/11 | Docker | مدعوم مُختبر (conditional) | `setup.bat` أو `Setup-Archive.bat` | Docker Desktop + Compose v2 مطلوب؛ كل الملفات الشخصية في `C:\ArchiveSuite\data` |
| Linux | Docker | مدعوم مُختبر (conditional) | `setup.sh` | Docker Engine + Compose v2 مطلوب؛ الملفات في `/var/lib/archive-suite` |
| macOS | Docker | مدعوم نظريًا (غير مُختبر رسميًا) | `setup.sh` | التشغيل عبر Docker Desktop متاح لكن لم يُختبر على أجهزة Mac حقيقية |
| Windows 10/11 | Native | مخطط — غير متاح بعد | — | V1-210 لم تُنفذ؛ `doctor --mode=native` يرفض التشغيل |
| Linux | Native | مخطط — غير متاح بعد | — | V1-211 لم تُنفذ؛ `doctor --mode=native` يرفض التشغيل |

## الملفات والأوامر الحالية

- **Entry point Windows Docker:** `setup.bat` / `Setup-Archive.bat`
- **Entry point Linux/macOS Docker:** `setup.sh`  
- **أي منصة:** `pnpm control` أو `node scripts/control-center.mjs`
- **اختبار التوافق:** `doctor [--mode=docker|native] [--platform=<id>]`

## ما الذي يفتقده كل وضع

### وضع Native (Windows + Linux)
- **الحالة:** مخطط ولم يُبدأ (V1-210/V1-211)
- **السبب:** تثبيت PHP/Composer/PostgreSQL/Redis محليًا يتطلب سكريبتات نظام التشغيل وإدارة خدمات؛ عمل البنية التحتية مستمر
- **التأثير:** `doctor --mode=native` يرفض الاتصال برسالة "Native deployment is planned"
- **التوقع:** متعدد الأشهر بعد اختبار الحاوي النهائي

### وضع Docker على macOS
- **الحالة:** نظرياً يعمل عبر Docker Desktop لكن غير مدرج كمنصة رسمية في العقد
- **السبب:** لا توجد أجهزة اختبار macOS متاحة حاليًا للتحقق
- **الحل المؤقت:** استخدم Docker Desktop على Mac وقم بتشغيل `setup.sh` (الأمر نفسه لـ Linux)

## الملاحظات

1. **حالة "conditional"** تعني أن المنصة تعتمد على متطلبات خارجية (Docker، الموارد) ولم تختبر على بيئة إنتاجية حقيقية حتى الآن — انظر `supportPolicy` في العقد.

2. **macOS ليست مدرجة** في `infra/platform/compatibility.v1.json` كمنصة رسمية لأن Docker Desktop على macOS يستخدم نفس الصور والإعدادات مثل Linux في الحاوية.

3. **Native mode** (بدون Docker) مخطط لكن غير موجود حاليًا. `doctor` يرفض وضع native بالكامل ما لم يتم إكمال V1-210/V1-211.

---

**مصدر:** هذا الملف مرآة مباشرة للحالة الفعلية في `infra/platform/compatibility.v1.json` و`scripts/platform-contract.mjs`. حدّثه عند تغيير العقد أو إكمال مهام V1-208 عبر V1-212.
