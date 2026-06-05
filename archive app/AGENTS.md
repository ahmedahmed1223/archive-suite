# AGENTS.md — قواعد العمل لوكلاء الذكاء الاصطناعي (وللبشر)

> هذا الملف معيار تنسيق العمل عبر المستودعات الثلاثة:
> `archive-core` · `archive-app` · `archive-server`.
> الغرض: تمكين **عدّة وكلاء يعملون بالتوازي دون تعارض**، باتّباع معايير
> هندسة العمل المعتمدة (trunk-based + feature branches + CI gates).

---

## 0. القاعدة الذهبية لتجنّب التعارض

**وكيل واحد = مهمّة واحدة = فرع واحد = PR واحد.** لا تعمل وكيلان على نفس
الملفّات في الوقت نفسه. قبل البدء، اختر مهمّة من `TASKS.md` (قسم Next) أو
`docs/ROADMAP.md`، وامتلكها (علّمها in_progress)، واعمل في فرعها وحدها.

---

## 1. عزل الفروع (إلزامي)

- **لا تلتزم (commit) على `main` مباشرة أبدًا.** كل تغيير عبر فرع + PR.
- تسمية الفروع: `feat/…` · `fix/…` · `docs/…` · `chore/…` · `refactor/…`
- فرع لكل مهمّة منطقية واحدة. لا تخلط مهمّتين في فرع.
- ابدأ كل فرع من `main` محدَّث: `git checkout main && git pull && git checkout -b feat/…`
- **احذف الفرع بعد الدمج** (`gh pr merge --squash --delete-branch`). الفروع
  المهجورة (`codex/*` القديمة مثلًا) ضوضاء تربك الوكلاء اللاحقين.

## 2. الملفّات المشتركة عالية-التعارض — تعامل بحذر

| الملفّ | القاعدة |
|--------|---------|
| `TASKS.md` | عدّل **أسطر مهمّتك فقط**؛ أضِف في قسم Done (إلحاق) بدل إعادة الترتيب. إن تعارض: ادمج بالاتّحاد (union) — احتفظ بكلا الإدخالين. |
| `docs/ROADMAP.md` | حدّث بند مهمّتك فقط. |
| `package.json` / `package-lock.json` | عند تعارض lock: أعد `npm install` على `main` المحدَّث ثم طبّق تغييرك. |
| **مخرجات البناء** (`dist/`, `dist-cloud/`, `dist-aistudio/`, `src/generated/`) | **لا تلتزمها إطلاقًا** — مُهملة في `.gitignore`. CI/Docker/Pages تبنيها من المصدر. التزامها كان أكبر مصدر تعارض. |

## 3. بوّابات الجودة (قبل أي PR)

شغّل محلّيًا وتأكّد من الخُضرة قبل فتح PR:

```bash
# archive-app
npm run verify && npm run build:spa && npm run build:cloud

# archive-server
npm run verify        # 42 اختبار: pocketbase + postgres + api + auth

# archive-core
npm run verify        # اختبارات العقد
```

- **CI إلزامي أخضر** قبل الدمج. لا تدمج PR والـ checks معلّقة أو حمراء.
- إن تعارض الفرع مع `main`: `git checkout main && git pull` ثم rebase فرعك
  (`git rebase main`) أو cherry-pick على فرع جديد، وأعد البناء لحلّ تعارض المخرجات.
- **ممنوع force-push** على فروع مشتركة دون إذن صريح. عند الحاجة لـ history نظيف،
  أنشئ فرعًا جديدًا واعمل cherry-pick.

## 4. الالتزامات (commits)

- **Conventional Commits**: `feat(scope): …` · `fix(scope): …` · `docs:` …
- رسالة واضحة: ماذا + لماذا. العربية مقبولة (المشروع عربي).
- ذيّل كل commit بـ:
  ```
  Co-Authored-By: Claude <noreply@anthropic.com>
  ```
- التزامات ذرّية: تغيير منطقي واحد لكل commit متى أمكن.

## 5. التحقّق قبل ادّعاء الإنجاز

- لا تقل «تمّ» قبل تشغيل `verify` + البناء ورؤية الخُضرة فعليًّا.
- للميزات السحابية: التحقّق الحيّ عبر سكربتات `scripts/smoke-*-live.mjs`
  (تحتاج Docker + Postgres) — ليست جزءًا من `verify` لكنها تثبت الحفظ الفعلي.
- حدّث `TASKS.md` (انقل البند إلى Done) في نفس الـ PR.

## 6. معمارية المنافذ (لا تكسر العقد)

النظام مبني على **منافذ `@archive/core`** (11 دالّة `StorageProvider` + Auth/Sync/
Ai/File). أي خلفية جديدة = محوّل خلف المنفذ، لا تسريب للخلفية في كود الميزات.
- النواة لا تعرف أي خلفية (حقن صرف).
- المحوّلات (`local-*`, `cloud-*`) تنفّذ المنافذ.
- ترقية النواة = رفع وسم git بوعي (`@archive/core#vX.Y.Z`).

## 7. حوكمة عدّة وكلاء (تنسيق)

- استخدم أداة المهامّ الحيّة (TaskCreate/TaskList) لإعلان الملكية داخل الجلسة.
- `TASKS.md` هو السجلّ الدائم؛ الأداة الحيّة هي التنسيق اللحظي.
- إن وجدت فرعًا/PR مفتوحًا لنفس المهمّة من وكيل آخر، **لا تكرّرها** — تابعها أو اختر غيرها.
- مهمّة واحدة كبيرة؟ قسّمها إلى PRs متسلسلة صغيرة (كل واحد قابل للدمج وحده).

---

## مرجع سريع للأوامر

```bash
# دورة مهمّة كاملة
git checkout main && git pull
git checkout -b feat/my-task
# … عدّل …
npm run verify && npm run build:spa        # بوّابة محلّية
git add <files> && git commit -m "feat(x): …"
git push -u origin feat/my-task
gh pr create --base main --title "…" --body "…"
gh pr checks <n> --watch                    # انتظر الخُضرة
gh pr merge <n> --squash --delete-branch
git checkout main && git pull && git fetch --prune
```
