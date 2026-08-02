# /archive — viewer

URL: `/archive`

## ترتيب النطق عند Tab

| # | العنصر | الدور | الاسم المنطوق |
| - | ------ | ----- | ------------- |
| 1 | `a` | a | الانتقال إلى المحتوى الرئيسي |
| 2 | `a` | a | مسار - الرئيسية |
| 3 | `a` | a | إضافة مادة |
| 4 | `button` | button | العناصر الأخيرة والمفضّلة |
| 5 | `button` | button | فتح الإشعارات |
| 6 | `button` | button | تسجيل الخروج |
| 7 | `button` | button | التبديل إلى تباعد مضغوط |
| 8 | `button` | button | تفعيل وضع التركيز |
| 9 | `button` | button | فتح لوحة الأوامر |
| 10 | `button` | button | التبديل إلى الوضع الفاتح |
| 11 | `button` | button | فتح كل المجموعات |
| 12 | `button` | button | طي كل المجموعات |
| 13 | `summary` | summary | الإدخال |
| 14 | `summary` | summary | المكتبة |
| 15 | `a` | a | اللوحة |
| 16 | `a` | a | يومي |
| 17 | `a` | a | الأرشيف |
| 18 | `a` | a | البحث |
| 19 | `a` | a | الاكتشاف |
| 20 | `a` | a | المفضلة |
| 21 | `a` | a | قوائم القراءة |
| 22 | `a` | a | الخط الزمني |
| 23 | `a` | a | العلاقات |
| 24 | `a` | a | الخريطة |
| 25 | `a` | a | الملفات |
| 26 | `summary` | summary | التنظيم |
| 27 | `summary` | summary | المشاركة |
| 28 | `summary` | summary | المؤشرات |
| 29 | `summary` | summary | النظام |
| 30 | `button` | button | تمرير القائمة لأسفل |
| 31 | `a` | a | الرئيسية |
| 32 | `button` | button | بحث، فتح صفحة، أو تنفيذ أمر...Ctrl / Cmd + K |
| 33 | `a` | a | إضافة |
| 34 | `a` | a | النشاط |
| 35 | `a` | a | الصحة |
| 36 | `button` | button | نصائح حول archive |
| 37 | `button` | button | التنبيهات |
| 38 | `a` | a | فتح الجولة |
| 39 | `button` | button | إخفاء التذكير |
| 40 | `button` | button | حفظ العرض |

## شجرة الوصولية (#main-content)

```yaml
- main:
  - strong: E2E Viewer
  - text: مساحة العمل المكتبة
  - strong: الأرشيف
  - button "بحث، فتح صفحة، أو تنفيذ أمر... Ctrl / Cmd + K"
  - navigation "أوامر سريعة":
    - link "إضافة":
      - /url: /uploads
    - link "النشاط":
      - /url: /activity
    - link "الصحة":
      - /url: /status
  - button "نصائح حول archive"
  - button "التنبيهات"
  - region "مسار أول تشغيل":
    - strong: هل هذا أول تشغيل؟
    - paragraph: راجع مسار التهيئة السريع أو المتقدم قبل بدء العمل اليومي.
    - link "فتح الجولة":
      - /url: /first-run
    - button "إخفاء التذكير"
  - text: مساحة الأرشيف
  - heading "الأرشيف" [level=1]
  - paragraph: سطح عمل موحد للبحث والتصفية والمعاينة والإجراءات الجماعية على السجلات.
  - button "حفظ العرض"
  - text: 4 نتيجة 0 فلتر نشط 0 محدد بحث
  - searchbox "بحث"
  - text: المخزن
  - combobox "المخزن":
    - option "كل المخازن" [selected]
    - option "archive"
  - text: النوع
  - combobox "النوع":
    - option "كل الأنواع" [selected]
    - option "document"
  - text: الفرز
  - combobox "الفرز":
    - option "آخر تحديث" [selected]
    - option "تاريخ الإنشاء"
    - option "العنوان"
  - text: الاتجاه
  - combobox "الاتجاه":
    - option "الأحدث أولاً" [selected]
    - option "الأقدم أولاً"
  - button "تحديث"
  - button "تصفير"
  - group "تصفية حسب حالة سير العمل":
    - button "الكل · 4"
    - button "مسودة · 4"
  - group "طريقة العرض":
    - button "شبكة" [pressed]
    - button "معرض"
    - button "مضغوط"
    - button "قائمة"
    - button "جدول"
    - button "مقسّم"
  - group "كثافة العناصر":
    - button "مضغوط" [pressed]
    - button "مريح"
    - button "كبير"
  - region "نتائج الأرشيف":
    - list:
      - listitem:
        - checkbox "تحديد سجل admin المعزول"
        - heading "سجل admin المعزول" [level=2]:
          - link "سجل admin المعزول":
            - /url: /archive/e2e-admin-record-1
        - button "معاينة"
        - paragraph: بيانات معزولة للدور admin (V1-303B).
        - text: archive document مسودة
        - time: ٢‏/٨‏/٢٠٢٦
        - text: e2e-admin
      - listitem:
        - checkbox "تحديد سجل editor المعزول"
        - heading "سجل editor المعزول" [level=2]:
          - link "سجل editor المعزول":
            - /url: /archive/e2e-editor-record-1
        - button "معاينة"
        - paragraph: بيانات معزولة للدور editor (V1-303B).
        - text: archive document مسودة
        - time: ٢‏/٨‏/٢٠٢٦
        - text: e2e-editor
      - listitem:
        - checkbox "تحديد سجل viewer المعزول"
        - heading "سجل viewer المعزول" [level=2]:
          - link "سجل viewer المعزول":
            - /url: /archive/e2e-viewer-record-1
        - button "معاينة"
        - paragraph: بيانات معزولة للدور viewer (V1-303B).
        - text: archive document مسودة
        - time: ٢‏/٨‏/٢٠٢٦
        - text: e2e-viewer
      - listitem:
        - checkbox "تحديد تسجيل تكامل Next/Laravel"
        - heading "تسجيل تكامل Next/Laravel" [level=2]:
          - link "تسجيل تكامل Next/Laravel":
            - /url: /archive/next-laravel-record
        - button "معاينة"
        - paragraph: Fixture يؤكد أن عارض المشاركة في Next يقرأ من Laravel API.
        - text: archive document مسودة
        - time: ١‏/٨‏/٢٠٢٦
        - text: integration next laravel
    - complementary "معاينة السجل":
      - text: معاينة
      - heading "سجل admin المعزول" [level=2]
      - paragraph: بيانات معزولة للدور admin (V1-303B).
      - strong: المخزن
      - text: archive
      - strong: النوع
      - text: document
      - strong: الإنشاء
      - text: ٢‏/٨‏/٢٠٢٦
      - strong: التحديث
      - text: ٢‏/٨‏/٢٠٢٦ e2e-admin
      - link "فتح التفاصيل":
        - /url: /archive/e2e-admin-record-1
      - link "بحث مشابه":
        - /url: /search?q=%D8%B3%D8%AC%D9%84%20admin%20%D8%A7%D9%84%D9%85%D8%B9%D8%B2%D9%88%D9%84
```
