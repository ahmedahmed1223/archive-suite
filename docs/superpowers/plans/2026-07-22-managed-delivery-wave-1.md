# Managed Delivery Wave 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Correct the release ledger and deliver three locally verifiable slices: server-backed type icons, role-aware contextual help, and an enforceable Arabic UI terminology baseline.

**Architecture:** The manager owns shared documentation and integrates sequential commits on `master`. Server-backed type icons extend the existing `/types` JSON contract without a schema migration because type definitions already live in `storage_rows.data`. Contextual tips gain an optional role audience and a pure selector, while the Arabic audit gains a machine-readable glossary plus a deterministic source guard.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript 6, Vitest 4, Laravel, PHPUnit, OpenAPI JSON, pnpm 11.

## Global Constraints

- Work only in `archive-next/`, `archive-laravel/`, `docs/api/`, and manager-owned ledger files.
- Do not add features to `archive-app/` or `archive-server/`.
- Every behavior change starts with a failing focused test and records the expected failure.
- Agents must not edit `TASKS.md` or `ChangeLog.md`; the manager owns both.
- Any public contract change updates OpenAPI, Laravel, the Next client, and contract verification in the same accepted slice.
- Do not download font files or introduce new dependencies in this wave.
- Do not close clean-host, credentialed-provider, GPU, publishing, or organizational-sign-off tasks.

---

### Task 1: Correct the open-task ledger count

**Files:**
- Modify: `TASKS.md:9`

**Interfaces:**
- Consumes: unchecked entries matching `- [ ]` in `TASKS.md`.
- Produces: a truthful summary count equal to the mechanically counted open entries.

- [ ] **Step 1: Recount unchecked entries**

Run:

```powershell
$openTaskCount = (Get-Content TASKS.md | Where-Object { $_ -match '^\s*- \[ \]' }).Count
$openTaskCount
```

Expected: `47`.

- [ ] **Step 2: Correct the summary sentence**

Replace `يوجد 63 بندًا مفتوحًا` with `يوجد 47 بندًا مفتوحًا`. Do not modify any task checkbox.

- [ ] **Step 3: Verify the declared and mechanical counts agree**

Run:

```powershell
$text = Get-Content TASKS.md -Raw
$openTaskCount = (Get-Content TASKS.md | Where-Object { $_ -match '^\s*- \[ \]' }).Count
if ($text -notmatch "يوجد $openTaskCount بندًا مفتوحًا") { throw "TASKS.md count mismatch" }
```

Expected: exit code `0`.

- [ ] **Step 4: Commit**

```powershell
git add TASKS.md
git commit -m "docs: correct open task count"
```

---

### Task 2: Persist type icons through the canonical API

**Files:**
- Modify: `archive-laravel/tests/Feature/TypesControllerTest.php`
- Modify: `archive-laravel/app/Http/Controllers/Api/V1/TypesController.php`
- Modify: `docs/api/archive-contract.openapi.json`
- Modify: `archive-next/lib/archive-api.ts`
- Modify (generated): `archive-next/lib/generated/archive-api.ts`

**Interfaces:**
- Consumes: the existing `POST /api/v1/types`, `GET /api/v1/types`, and `GET /api/v1/types/{id}` endpoints.
- Produces: `ArchiveType.icon?: string`; requests may include an icon identifier with 1–100 characters and responses preserve it.

- [ ] **Step 1: Add failing Laravel persistence and validation tests**

Add these methods to `TypesControllerTest`:

```php
public function test_create_type_persists_icon_identifier(): void
{
    $payload = [
        'id' => 'photo-type',
        'name' => 'Photo',
        'icon' => 'Image',
        'fields' => [],
    ];

    $response = $this->actingAs($this->adminUser)->postJson('/api/v1/types', $payload);

    $response->assertCreated()->assertJsonPath('type.icon', 'Image');
    $this->actingAs($this->viewerUser)
        ->getJson('/api/v1/types/photo-type')
        ->assertOk()
        ->assertJsonPath('type.icon', 'Image');
}

public function test_create_type_rejects_invalid_icon_identifier(): void
{
    $payload = [
        'id' => 'bad-icon-type',
        'name' => 'Bad Icon',
        'icon' => str_repeat('x', 101),
        'fields' => [],
    ];

    $this->actingAs($this->adminUser)
        ->postJson('/api/v1/types', $payload)
        ->assertUnprocessable()
        ->assertJsonValidationErrors(['icon']);
}
```

- [ ] **Step 2: Run the focused tests and verify RED**

Run through the repository Laravel Docker helper:

```powershell
node scripts/laravel-docker.mjs test --filter TypesControllerTest
```

Expected: the persistence test fails because `type.icon` is absent. If Docker is unavailable, record the exact environment error and use the existing installed PHP runtime only if the repository helper explicitly supports it.

- [ ] **Step 3: Add icon validation and storage**

In `TypesController::store`, add:

```php
'icon' => ['sometimes', 'nullable', 'string', 'min:1', 'max:100'],
```

to the validator rules, and construct stored data as:

```php
$data = [
    'id' => $validated['id'],
    'name' => $validated['name'],
    ...(array_key_exists('icon', $validated) ? ['icon' => $validated['icon']] : []),
    'fields' => $validated['fields'],
];
```

- [ ] **Step 4: Extend the OpenAPI schema**

Add a `TypeDefinition` schema after `TypeDefinitionField`:

```json
"TypeDefinition": {
  "type": "object",
  "required": ["id", "name", "fields"],
  "properties": {
    "id": { "type": "string", "minLength": 1, "maxLength": 255 },
    "name": { "type": "string", "minLength": 1, "maxLength": 255 },
    "icon": { "type": "string", "minLength": 1, "maxLength": 100 },
    "fields": {
      "type": "array",
      "items": { "$ref": "#/components/schemas/TypeDefinitionField" }
    }
  }
},
```

Add canonical `/types` GET/POST and `/types/{id}` GET/DELETE path declarations because these Laravel routes are not currently represented in the OpenAPI document. Use cookie/bearer security, the existing `Error` response, cursor/limit parameters matching `TypesController`, `TypeDefinition` for request payloads, and success objects with `ok`, `type` or `types`, and nullable `nextCursor`. The POST response documents both `200` update and `201` creation.

- [ ] **Step 5: Extend the Next client type**

Change `ArchiveType` to:

```ts
export interface ArchiveType {
  id: string;
  name: string;
  icon?: string;
  fields: ArchiveTypeField[];
  createdAt?: string;
  updatedAt?: string;
}
```

Regenerate the checked-in binding:

```powershell
pnpm api:generate
```

- [ ] **Step 6: Verify GREEN and contract consistency**

Run:

```powershell
node scripts/laravel-docker.mjs test --filter TypesControllerTest
pnpm verify:api-contracts
pnpm verify:api-generated
pnpm typecheck
```

Expected: all available commands exit `0`. An unavailable Docker engine is reported as an environment block rather than a passing Laravel test.

- [ ] **Step 7: Commit**

```powershell
git add archive-laravel/tests/Feature/TypesControllerTest.php archive-laravel/app/Http/Controllers/Api/V1/TypesController.php docs/api/archive-contract.openapi.json archive-next/lib/archive-api.ts archive-next/lib/generated/archive-api.ts
git commit -m "feat(types): persist icon identifiers in API"
```

---

### Task 3: Make the type editor and list use server-backed icons

**Files:**
- Modify: `archive-next/app/types/_components/TypesEditor.test.tsx`
- Modify: `archive-next/app/types/_components/TypesEditor.tsx`
- Modify: `archive-next/app/types/_components/TypesList.test.tsx`
- Modify: `archive-next/app/types/_components/TypesList.tsx`
- Delete: `archive-next/lib/type-icons.ts`
- Delete: `archive-next/lib/type-icons.test.ts`

**Interfaces:**
- Consumes: `ArchiveType.icon?: string` from Task 2.
- Produces: type save payloads containing `icon` when selected; list rendering based on `type.icon`; no type-icon data in browser-local storage.

- [ ] **Step 1: Replace local-storage expectations with failing API-payload expectations**

In `TypesEditor.test.tsx`, remove imports from `@/lib/type-icons`. Replace the two icon persistence tests with:

```tsx
test("preselects the icon supplied by the existing type", () => {
  const existing = {
    id: "document",
    name: "مستند",
    icon: "FileText",
    fields: [{ name: "العنوان", type: "text" as const, fieldAcl: { view: [], edit: [] } }]
  };

  renderEditor({ initialType: existing });

  expect(screen.getByRole("button", { name: "FileText" })).toHaveAttribute("aria-pressed", "true");
});

test("includes the selected icon in the saved type payload", async () => {
  const { onSave } = renderEditor();
  fireEvent.change(screen.getByLabelText(/معرّف النوع/), { target: { value: "document" } });
  fireEvent.change(screen.getByLabelText(/اسم النوع/), { target: { value: "مستند" } });
  fireEvent.change(screen.getByLabelText("اسم الحقل"), { target: { value: "العنوان" } });
  fireEvent.click(screen.getByRole("button", { name: "FileText" }));
  fireEvent.click(screen.getByRole("button", { name: "حفظ النوع" }));

  await vi.waitFor(() => expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ icon: "FileText" })));
});
```

In `TypesList.test.tsx`, remove `setTypeIcon` and make the assigned-icon fixture explicit:

```tsx
test("renders the assigned lucide icon instead of the letter mark", () => {
  render(
    <TypesList
      types={[{ id: "document", name: "مستند", icon: "FileText", fields: [] }]}
      selectedTypeId={null}
      deletingTypeId={null}
      onSelectType={vi.fn()}
      onEditType={vi.fn()}
      onDeleteType={vi.fn()}
      onCreateType={vi.fn()}
    />
  );
  expect(screen.queryByText("م")).toBeNull();
});
```

- [ ] **Step 2: Run focused tests and verify RED**

Run:

```powershell
pnpm --filter @archive/next exec vitest run app/types/_components/TypesEditor.test.tsx app/types/_components/TypesList.test.tsx
```

Expected: payload and rendering tests fail because production code still reads and writes local storage.

- [ ] **Step 3: Use the API field in the editor**

Remove the `type-icons` import. Initialize with:

```ts
setIcon(initialType?.icon ?? "");
```

Save with:

```ts
await onSave({
  id: savedId,
  name: typeName.trim(),
  ...(icon ? { icon } : {}),
  fields: normalizedFields
});
```

Remove the `setTypeIcon` call.

- [ ] **Step 4: Use the API field in the list and remove obsolete storage**

Remove the `type-icons` import and replace:

```ts
const iconName = getTypeIcon(type.id);
```

with:

```ts
const iconName = type.icon;
```

Delete `archive-next/lib/type-icons.ts` and its test. Keep `entity-icons.ts` and `tag-icons.ts` because tags remain client-only in this slice.

- [ ] **Step 5: Verify GREEN**

Run:

```powershell
pnpm --filter @archive/next exec vitest run app/types/_components/TypesEditor.test.tsx app/types/_components/TypesList.test.tsx
pnpm typecheck
pnpm test:next
```

Expected: all commands exit `0` with no failed tests.

- [ ] **Step 6: Commit**

```powershell
git add archive-next/app/types/_components/TypesEditor.test.tsx archive-next/app/types/_components/TypesEditor.tsx archive-next/app/types/_components/TypesList.test.tsx archive-next/app/types/_components/TypesList.tsx archive-next/lib/type-icons.ts archive-next/lib/type-icons.test.ts
git commit -m "feat(next): sync type icons through API"
```

---

### Task 4: Filter contextual guidance by role

**Files:**
- Create: `archive-next/lib/contextual-tips.test.ts`
- Modify: `archive-next/lib/contextual-tips.ts`
- Create: `archive-next/components/ContextualTips.test.tsx`
- Modify: `archive-next/components/ContextualTips.tsx`

**Interfaces:**
- Consumes: `NavigationRole` and `useAuthSession().user?.role`.
- Produces: `Tip.roles?: readonly NavigationRole[]` and `getPageTips(page: PageKey, role?: NavigationRole): Tip[]`.

- [ ] **Step 1: Add failing pure selector tests**

Create `contextual-tips.test.ts`:

```ts
import { describe, expect, test } from "vitest";
import { getPageTips } from "@/lib/contextual-tips";

describe("role-aware contextual tips (V1-306C)", () => {
  test("viewer guidance excludes archive editing instructions", () => {
    const titles = getPageTips("archive", "viewer").map((tip) => tip.title);
    expect(titles).toContain("وضع القراءة");
    expect(titles).not.toContain("تعديل السجلات");
  });

  test("editor guidance includes archive editing instructions", () => {
    const titles = getPageTips("archive", "editor").map((tip) => tip.title);
    expect(titles).toContain("تعديل السجلات");
    expect(titles).not.toContain("وضع القراءة");
  });

  test("shared guidance remains visible to every role", () => {
    expect(getPageTips("archive", "viewer").map((tip) => tip.title)).toContain("السجلات");
    expect(getPageTips("archive", "admin").map((tip) => tip.title)).toContain("السجلات");
  });
});
```

- [ ] **Step 2: Run the selector test and verify RED**

Run:

```powershell
pnpm --filter @archive/next exec vitest run lib/contextual-tips.test.ts
```

Expected: FAIL because `getPageTips` does not exist.

- [ ] **Step 3: Add role metadata and the pure selector**

Import `NavigationRole`, extend `Tip`, and export the selector:

```ts
import type { NavigationRole } from "@/lib/navigation";

export interface Tip {
  title: string;
  description: string;
  icon?: string;
  roles?: readonly NavigationRole[];
}

export function getPageTips(page: PageKey, role?: NavigationRole): Tip[] {
  return pageTips[page].filter((tip) => !tip.roles || (role ? tip.roles.includes(role) : false));
}
```

In the `archive` tips, scope `تعديل السجلات` to editor/admin and add:

```ts
{
  title: "وضع القراءة",
  description: "يمكنك فتح السجلات والملفات المرتبطة بها دون ظهور إجراءات التعديل أو الحذف",
  icon: "Eye",
  roles: ["viewer"]
}
```

- [ ] **Step 4: Add a failing component integration test**

Create `ContextualTips.test.tsx`:

```tsx
// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";
import ContextualTips from "@/components/ContextualTips";

vi.mock("@/lib/use-contextual-tips", () => ({
  useContextualTips: () => ({
    isDismissed: false,
    handleDismiss: vi.fn(),
    isHydrated: true
  })
}));

vi.mock("@/lib/auth-session", () => ({
  useAuthSession: () => ({ user: { role: "viewer" } })
}));

afterEach(cleanup);

describe("ContextualTips role integration (V1-306C)", () => {
  test("shows viewer guidance without archive editing instructions", () => {
    render(<ContextualTips page="archive" />);
    fireEvent.click(screen.getByRole("button", { name: /نصائح حول/ }));

    expect(screen.getByText("وضع القراءة")).toBeTruthy();
    expect(screen.queryByText("تعديل السجلات")).toBeNull();
  });
});
```

- [ ] **Step 5: Pass the authenticated role to the selector**

In `ContextualTips.tsx`, import `useAuthSession` and `getPageTips`, then use:

```ts
const { user } = useAuthSession();
const tips = getPageTips(page, user?.role);
```

Remove the direct `pageTips[page]` access.

- [ ] **Step 6: Verify GREEN**

Run:

```powershell
pnpm --filter @archive/next exec vitest run lib/contextual-tips.test.ts components/ContextualTips.test.tsx
pnpm typecheck
pnpm test:next
```

Expected: all commands exit `0`.

- [ ] **Step 7: Commit**

```powershell
git add archive-next/lib/contextual-tips.test.ts archive-next/lib/contextual-tips.ts archive-next/components/ContextualTips.test.tsx archive-next/components/ContextualTips.tsx
git commit -m "feat(next): tailor contextual help by role"
```

---

### Task 5: Establish and enforce the Arabic UI terminology baseline

**Files:**
- Create: `docs/arabic-ui-glossary.md`
- Create: `archive-next/lib/arabic-terminology.ts`
- Create: `archive-next/lib/arabic-terminology.test.ts`

**Interfaces:**
- Consumes: UTF-8 source text from `archive-next/app`, `archive-next/components`, and `archive-next/lib`.
- Produces: `findDeprecatedUiTerms(text: string): string[]` and a documented distinction between سجل, مادة, مخزن, and بيانات وصفية.

- [ ] **Step 1: Add failing terminology matcher tests**

Create `arabic-terminology.test.ts` with unit cases first:

```ts
import { describe, expect, test } from "vitest";
import { findDeprecatedUiTerms } from "@/lib/arabic-terminology";

describe("Arabic UI terminology baseline (V1-791)", () => {
  test("flags deprecated transliterated operational terms", () => {
    expect(findDeprecatedUiTerms("افتح السيرفر ثم راجع اللوج")).toEqual(["السيرفر", "اللوج"]);
  });

  test("accepts the approved operational terms", () => {
    expect(findDeprecatedUiTerms("افتح الخادم ثم راجع السجل")).toEqual([]);
  });

  test("does not match a deprecated term inside a longer Arabic word", () => {
    expect(findDeprecatedUiTerms("تكنولوجيا الخوادم")).toEqual([]);
  });
});
```

- [ ] **Step 2: Run the unit test and verify RED**

Run:

```powershell
pnpm --filter @archive/next exec vitest run lib/arabic-terminology.test.ts
```

Expected: FAIL because the module does not exist.

- [ ] **Step 3: Implement the minimal matcher**

Create `arabic-terminology.ts`:

```ts
const DEPRECATED_UI_TERMS = ["السيرفر", "اللوج"] as const;

export function findDeprecatedUiTerms(text: string): string[] {
  return DEPRECATED_UI_TERMS.filter((term) => {
    const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return new RegExp(`(^|[^\\p{L}])${escaped}($|[^\\p{L}])`, "u").test(text);
  });
}
```

- [ ] **Step 4: Document the approved distinctions**

Create `docs/arabic-ui-glossary.md` with these normative entries:

```markdown
# مسرد واجهة مسار العربية

| المفهوم | المصطلح المعتمد | الاستخدام |
| --- | --- | --- |
| Archive database record | سجل | الكيان الذي يحمل المعرّف والحقول والعلاقات. |
| Media or content item | مادة | المحتوى المرئي أو المسموع أو الملف المرتبط بسجل. |
| Storage backend | مخزن | وجهة التخزين المحلية أو الخارجية؛ لا تستخدم «متجر». |
| Metadata | بيانات وصفية | الاسم الكامل في الشرح؛ يجوز «التوصيف» للعملية التي يعدّل بها المستخدم البيانات الوصفية. |
| Server | خادم | لا تستخدم «سيرفر» في النص التشغيلي. |
| Log | سجل أحداث أو سجل أخطاء | اختر الوصف المحدد؛ لا تستخدم «لوج». |
```

- [ ] **Step 5: Add a deterministic targeted source guard**

Extend the test file using the same recursive file-listing pattern as `mojibake-guard.test.ts`. Scan non-test `.ts` and `.tsx` files under `app`, `components`, and `lib`, call `findDeprecatedUiTerms`, and assert the offender list is empty.

- [ ] **Step 6: Run the guard and fix only exact deprecated matches**

Run:

```powershell
pnpm --filter @archive/next exec vitest run lib/arabic-terminology.test.ts
```

Expected: exit `0`. If exact matches exist, replace only user-facing `السيرفر` with `الخادم` and `اللوج` with the context-specific `سجل الأحداث` or `سجل الأخطاء`; add changed files to this task’s commit.

- [ ] **Step 7: Run integration checks**

Run:

```powershell
pnpm typecheck
pnpm test:next
pnpm build:next
```

Expected: all commands exit `0`.

- [ ] **Step 8: Commit**

```powershell
git add docs/arabic-ui-glossary.md archive-next/lib/arabic-terminology.ts archive-next/lib/arabic-terminology.test.ts archive-next/app archive-next/components archive-next/lib
git commit -m "test(next): enforce Arabic UI terminology baseline"
```

---

### Task 6: Manager integration and ledger progress

**Files:**
- Modify: `TASKS.md`
- Modify: `ChangeLog.md`

**Interfaces:**
- Consumes: reviewed commits and fresh verification output from Tasks 1–5.
- Produces: accurate partial-progress notes without closing V1-794, V1-306C, or V1-791 unless all their original acceptance criteria are met.

- [ ] **Step 1: Inspect the integrated diff and commit sequence**

Run:

```powershell
git status --short --branch
git log -8 --oneline
git diff HEAD~5..HEAD --check
```

Expected: clean worktree, intentional per-task commits, and no whitespace errors.

- [ ] **Step 2: Run the wave verification gate**

Run:

```powershell
pnpm verify:api-contracts
pnpm verify:api-generated
pnpm typecheck
pnpm test:next
pnpm build:next
```

Run the focused Laravel test through Docker when available:

```powershell
node scripts/laravel-docker.mjs test --filter TypesControllerTest
```

Expected: every available gate exits `0`; Docker unavailability remains explicitly recorded and prevents claiming Laravel live verification.

- [ ] **Step 3: Update progress notes accurately**

Keep all three task checkboxes open. Append dated notes stating:

- V1-794: type icons now persist through the Laravel/OpenAPI/Next contract; tags and category/group coverage plus self-hosted fonts remain.
- V1-306C: archive contextual tips now differ by role; other pages and the full role guide remain.
- V1-791: the approved glossary and initial deterministic deprecated-term guard exist; the comprehensive Arabic copy review remains.

Add a concise matching entry to `ChangeLog.md` referencing the accepted commit hashes and verification commands.

- [ ] **Step 4: Recount and verify the ledger**

Run:

```powershell
$text = Get-Content TASKS.md -Raw
$openTaskCount = (Get-Content TASKS.md | Where-Object { $_ -match '^\s*- \[ \]' }).Count
if ($text -notmatch "يوجد $openTaskCount بندًا مفتوحًا") { throw "TASKS.md count mismatch" }
```

Expected: exit `0`; count remains `47` because the wave delivers partial slices.

- [ ] **Step 5: Commit integration documentation**

```powershell
git add TASKS.md ChangeLog.md
git commit -m "docs: record managed delivery wave 1"
```
