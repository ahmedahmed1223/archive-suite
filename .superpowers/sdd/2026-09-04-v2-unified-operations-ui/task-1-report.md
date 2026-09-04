# تقرير المهمة 1: توحيد غلاف التشغيل وتصنيف التنقل

## الملفات المعدلة

- `archive-next/lib/navigation.ts`
- `archive-next/lib/navigation.test.ts`
- `archive-next/components/AppHeader.tsx`
- `archive-next/components/AppHeader.test.tsx`
- `archive-next/lib/i18n/dictionaries/ar/nav.ts`
- `archive-next/lib/i18n/dictionaries/en/nav.ts`
- `archive-next/lib/i18n/dictionaries/ar/shell.ts`
- `archive-next/lib/i18n/dictionaries/en/shell.ts`
- `archive-next/lib/experience-presets.ts` (جولة الإصلاح 1)
- `archive-next/lib/experience-presets.test.ts` (جولة الإصلاح 1)
- `archive-next/app/settings/NavigationCustomizationSection.test.tsx` (جولة الإصلاح 1)
- `archive-next/app/styles/06-widgets.css` (جولة الإصلاح 1)

## التغيير المنفذ

- أعيد تنظيم جميع المسارات المرئية في ثمانية مجالات تشغيلية، بالترتيب المطلوب: العمل اليومي، الإدخال، الوصف الأرشيفي، الوسائط، البحث والمعرفة، المشاريع والتعاون، الحقوق والمشاركة، والإدارة والموثوقية.
- حُفظت جميع المسارات وبوابات القدرات الحالية، بما فيها المسارات الإلزامية.
- أضيف سياق تشغيلي ثابت في رأس التطبيق يعرض المجال النشط، مع بديل محلي للمسارات غير المطابقة.
- بقيت آلية إغلاق التنقل بمفتاح Escape، والتنقل على الهاتف، ومسار التنقل، ووضع التركيز والكثافة ومسار الإعداد الأولي دون تغيير.

## الاختبارات المضافة أو المحدثة

- اختبار ترتيب أسماء المجالات العربية الثمانية.
- اختبار جرد المسارات المرئية كاملًا ومنع فقدان أو تكرار أي مسار.
- اختبار وضع مسارات الوصف الأرشيفي والحقوق والمشاركة في مجالها الصحيح.
- اختبار فتح مجموعة المجال النشط لمسار `/search/saved` وعرض السياق التشغيلي العربي.
- تحديث توقعات اختبارات التنقل اليومية لتتوافق مع التصنيف التشغيلي الجديد، مع استمرار اختبار Esc لاستعادة التركيز إلى زر التنقل.

## الأوامر والنتائج

| الأمر | النتيجة |
| --- | --- |
| `pnpm --filter @archive/next exec vitest run lib/navigation.test.ts components/AppHeader.test.tsx` (قبل التنفيذ) | فشل متوقع: 3 اختبارات جديدة لا تجد التصنيف أو السياق التشغيلي بعد. |
| `pnpm --filter @archive/next exec vitest run lib/navigation.test.ts components/AppHeader.test.tsx` | نجح: 26 اختبارًا. |
| `pnpm --filter @archive/next exec vitest run lib/navigation.test.ts components/AppHeader.test.tsx lib/i18n/dictionaries.test.ts` | نجح: 29 اختبارًا في 3 ملفات. |
| `pnpm typecheck` | نجح: `tsc -p tsconfig.json --noEmit`. |
| `git -c safe.directory=D:/archiveaq/Arch_App diff --check` | نجح بلا أخطاء مسافات. |

## الالتزام

التنفيذ الأصلي للمهمة: `67b8754b` — `feat: unify archive operations navigation`.

## جولة الإصلاح 1

- تُحوَّل تفضيلات ترتيب التنقل المحفوظة بالمفاتيح السابقة (`capture` و`library` وما شابهها) إلى المجالات التشغيلية المناسبة عند القراءة. عند الحفظ التالي، يرسل قسم التخصيص مفاتيح v2 القانونية فقط، فلا تضيع أولوية المستخدم المحفوظة.
- تستعمل الإعدادات المسبقة مفاتيح المجالات التشغيلية الحالية فقط.
- يعرض السياق التشغيلي في الرأس المجال النشط دائمًا؛ ويستعمل `navLabel` بديلًا للمسارات غير المطابقة فقط.
- عُدّلت محددات التنقل في `06-widgets.css` لتستخدم أسماء أقسام v2.

### اختبارات الجولة

| الأمر | النتيجة |
| --- | --- |
| `pnpm --filter @archive/next exec vitest run lib/navigation.test.ts lib/experience-presets.test.ts app/settings/NavigationCustomizationSection.test.tsx components/AppHeader.test.tsx` (قبل الإصلاح) | فشل متوقع: 4 اختبارات تغطي المفاتيح القديمة والإعدادات المسبقة وأولوية السياق. |
| `pnpm --filter @archive/next exec vitest run lib/navigation.test.ts lib/experience-presets.test.ts app/settings/NavigationCustomizationSection.test.tsx components/AppHeader.test.tsx` | نجح: 46 اختبارًا في 4 ملفات. |
| `pnpm typecheck` | نجح: `tsc -p tsconfig.json --noEmit`. |

### التزام جولة الإصلاح

`HEAD` هو التزام جولة الإصلاح الذي يحتوي هذا التقرير؛ وهو مرجع Git دقيق لنفس الكائن ويمكن تحويله إلى SHA الفعلي عبر `git rev-parse HEAD` بعد إنشاء الالتزام. قيمة SHA تُذكر أيضًا في نتيجة التنفيذ لتفادي تخمين قيمة ذاتية قبل حسابها.

## مراجعة ذاتية

- جرد الاختبار يثبت استمرار كل مسار كان مرئيًا قبل إعادة التنظيم، ويمنع تكراره.
- `applyNavigationVisibility` وبوابات القدرات لم تتغير، وبالتالي تستمر صلاحيات النشر وإخفاء الوحدات والإلزامية كما كانت.
- لا تضيف الواجهة أي قدرة ذكاء اصطناعي أو بيانات خلفية جديدة، ولا تغيّر العقد أو التطبيقات المرجعية القديمة.
- السياق التشغيلي يستخدم القاموس نفسه للغتين، ولا يغيّر مسار التنقل أو الأزرار أو البنية القابلة للوصول.

## المخاوف

- لا توجد مخاوف وظيفية معروفة. بقيت `.stitch/` غير المتعقبة كما كانت ولم تُضمَّن في هذا الالتزام.
