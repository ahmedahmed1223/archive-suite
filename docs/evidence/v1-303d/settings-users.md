# /settings/users — admin

URL: `/settings/users`

## ترتيب النطق عند Tab

| # | العنصر | الدور | الاسم المنطوق |
| - | ------ | ----- | ------------- |
| 1 | `a` | a | الانتقال إلى المحتوى الرئيسي |
| 2 | `a` | a | مسار - الرئيسية |
| 3 | `a` | a | كيف تعمل هذه الصفحة؟ |
| 4 | `a` | a | إضافة مادة |
| 5 | `button` | button | العناصر الأخيرة والمفضّلة |
| 6 | `button` | button | فتح الإشعارات |
| 7 | `button` | button | تسجيل الخروج |
| 8 | `button` | button | التبديل إلى تباعد مضغوط |
| 9 | `button` | button | تفعيل وضع التركيز |
| 10 | `button` | button | فتح لوحة الأوامر |
| 11 | `button` | button | التبديل إلى الوضع الفاتح |
| 12 | `button` | button | فتح كل المجموعات |
| 13 | `button` | button | طي كل المجموعات |
| 14 | `summary` | summary | الإدخال |
| 15 | `summary` | summary | المكتبة |
| 16 | `summary` | summary | التنظيم |
| 17 | `summary` | summary | المشاركة |
| 18 | `summary` | summary | المؤشرات |
| 19 | `summary` | summary | النظام |
| 20 | `a` | a | بحوث محفوظة |
| 21 | `a` | a | الإضافات |
| 22 | `a` | a | النسخ الاحتياطي |
| 23 | `a` | a | مركز البيانات |
| 24 | `a` | a | التحكم بالنظام |
| 25 | `a` | a | أول تشغيل |
| 26 | `a` | a | الإعدادات |
| 27 | `a` | a | المساعدة |
| 28 | `button` | button | تمرير القائمة لأسفل |
| 29 | `a` | a | الرئيسية |
| 30 | `button` | button | بحث، فتح صفحة، أو تنفيذ أمر...Ctrl / Cmd + K |
| 31 | `a` | a | إضافة |
| 32 | `a` | a | النشاط |
| 33 | `a` | a | الصحة |
| 34 | `button` | button | نصائح حول settings-users |
| 35 | `button` | button | التنبيهات |
| 36 | `a` | a | فتح الجولة |
| 37 | `button` | button | إخفاء التذكير |
| 38 | `a` | a | عرض رحلة الإعداد |
| 39 | `input` | input | البريد الإلكتروني |
| 40 | `select` | select | الدورمديرمحرّرمشاهد |

## شجرة الوصولية (#main-content)

```yaml
- main:
  - strong: Integration User
  - text: مدير الأرشيف النظام
  - strong: الإعدادات
  - button "بحث، فتح صفحة، أو تنفيذ أمر... Ctrl / Cmd + K"
  - navigation "أوامر سريعة":
    - link "إضافة":
      - /url: /uploads
    - link "النشاط":
      - /url: /activity
    - link "الصحة":
      - /url: /status
  - button "نصائح حول settings-users"
  - button "التنبيهات"
  - region "مسار أول تشغيل":
    - strong: هل هذا أول تشغيل؟
    - paragraph: راجع مسار التهيئة السريع أو المتقدم قبل بدء العمل اليومي.
    - link "فتح الجولة":
      - /url: /first-run
    - button "إخفاء التذكير"
  - heading "المستخدمون والأدوار" [level=1]
  - paragraph: إدارة أعضاء الفريق وأدوارهم، ودعوة أعضاء جدد بالبريد الإلكتروني. مقتصر على المدراء.
  - text: مدير فقط
  - status:
    - strong: "رحلة الإعداد: جهّز الفريق بعد التحقق من حساب المدير"
    - paragraph: أضف المستخدمين والأدوار، ثم ارجع إلى الجاهزية لمراجعة الإجراء التالي.
    - link "عرض رحلة الإعداد":
      - /url: /first-run
  - article:
    - heading "دعوة عضو جديد" [level=2]
    - paragraph: تُنشأ دعوة صالحة لمدة 7 أيام؛ يشارك المدير الرابط/الرمز يدويًا حتى تفعيل البريد الإلكتروني.
    - text: البريد الإلكتروني
    - textbox "البريد الإلكتروني"
    - text: الدور
    - combobox "الدور":
      - option "مدير"
      - option "محرّر" [selected]
      - option "مشاهد"
    - button "إرسال الدعوة"
    - status
  - article:
    - heading "الأعضاء" [level=2]
    - region "أعضاء الفريق — منطقة جدول قابلة للتمرير":
      - paragraph: عند الحاجة، ركّز على منطقة الجدول واستخدم السهمين الأيمن والأيسر للتمرير أفقيًا.
      - paragraph: لا يوجد ترتيب مفعل.
      - table "أعضاء الفريق":
        - rowgroup:
          - row "تبديل ترتيب عمود name تبديل ترتيب عمود email تبديل ترتيب عمود role إجراءات":
            - columnheader "تبديل ترتيب عمود name":
              - button "تبديل ترتيب عمود name": الاسم
            - columnheader "تبديل ترتيب عمود email":
              - button "تبديل ترتيب عمود email": البريد الإلكتروني
            - columnheader "تبديل ترتيب عمود role":
              - button "تبديل ترتيب عمود role": الدور
            - columnheader "إجراءات"
        - rowgroup:
          - row "Archive Admin admin@example.com مدير إزالة":
            - cell "Archive Admin"
            - cell "admin@example.com"
            - cell "مدير":
              - combobox "دور admin@example.com":
                - option "مدير" [selected]
                - option "محرّر"
                - option "مشاهد"
            - cell "إزالة":
              - button "إزالة"
          - row "E2E Editor e2e-editor@archive.test محرّر إزالة":
            - cell "E2E Editor"
            - cell "e2e-editor@archive.test"
            - cell "محرّر":
              - combobox "دور e2e-editor@archive.test":
                - option "مدير"
                - option "محرّر" [selected]
                - option "مشاهد"
            - cell "إزالة":
              - button "إزالة"
          - row "E2E Viewer e2e-viewer@archive.test مشاهد إزالة":
            - cell "E2E Viewer"
            - cell "e2e-viewer@archive.test"
            - cell "مشاهد":
              - combobox "دور e2e-viewer@archive.test":
                - option "مدير"
                - option "محرّر"
                - option "مشاهد" [selected]
            - cell "إزالة":
              - button "إزالة"
          - row "Integration User it@archive.test مدير إزالة":
            - cell "Integration User"
            - cell "it@archive.test"
            - cell "مدير":
              - combobox "دور it@archive.test":
                - option "مدير" [selected]
                - option "محرّر"
                - option "مشاهد"
            - cell "إزالة":
              - button "إزالة"
          - row "QA Archive Operator qa.operator@archive.local مدير إزالة":
            - cell "QA Archive Operator"
            - cell "qa.operator@archive.local"
            - cell "مدير":
              - combobox "دور qa.operator@archive.local":
                - option "مدير" [selected]
                - option "محرّر"
                - option "مشاهد"
            - cell "إزالة":
              - button "إزالة"
```
