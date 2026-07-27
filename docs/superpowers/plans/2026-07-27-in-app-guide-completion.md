# In-App Guide Completion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete the role-aware in-app guide with maintained Arabic chapters and tests for discovery, filtering, and contextual navigation.

**Architecture:** Markdown remains the only authoring source. The server-side manifest loads it into typed chapters, while the client component filters the supplied chapters locally according to the authenticated role and query. The header continues to link a page to its most-specific permitted chapter.

**Tech Stack:** Next.js App Router, React 19, TypeScript, Vitest.

## Global Constraints

- Use Arabic terminology from `docs/arabic-ui-glossary.md` and preserve RTL UI behavior.
- Keep source material under `archive-next/content/guide/`; no runtime API or external documentation dependency.
- Do not expose a chapter whose `audience` omits the authenticated role.
- Run `pnpm verify` once only after the completed batch.

---

### Task 1: Guide chapter coverage and manifest integrity

**Files:**
- Modify: `archive-next/content/guide/viewer-search.md`
- Modify: `archive-next/content/guide/editor-upload.md`
- Modify: `archive-next/content/guide/admin-operations.md`
- Modify: `archive-next/content/guide/whats-new.md`
- Modify: `archive-next/lib/guide-content.ts`
- Test: `archive-next/lib/in-app-guide.test.ts`

**Interfaces:**
- Consumes: `GuideChapter { id, title, audience, body, href }` from `archive-next/lib/in-app-guide.ts`.
- Produces: a manifest where every chapter has a stable id, Arabic title, supported audience, and routable `href`.

- [ ] **Step 1: Extend the failing manifest test**

```ts
expect(getGuideChapters()).toEqual(expect.arrayContaining([
  expect.objectContaining({ id: "viewer-search", audience: expect.arrayContaining(["viewer"]) }),
  expect.objectContaining({ id: "editor-upload", audience: expect.arrayContaining(["editor"]) }),
  expect.objectContaining({ id: "admin-operations", audience: ["admin"] }),
]));
```

- [ ] **Step 2: Run the focused test and verify the expected missing chapter or assertion failure**

Run: `pnpm --dir archive-next test -- in-app-guide.test.ts`

- [ ] **Step 3: Add only operational Markdown content and manifest entries required by the test**

```ts
{ id: "admin-operations", title: "إدارة النظام والتشغيل", audience: ["admin"], href: "/settings/users", source: "admin-operations.md" }
```

Each chapter must have a concise purpose, ordered actions, and its linked in-app destination.

- [ ] **Step 4: Re-run the focused test and verify it passes**

Run: `pnpm --dir archive-next test -- in-app-guide.test.ts`

- [ ] **Step 5: Commit the self-contained content and manifest change**

```powershell
git add archive-next/content/guide archive-next/lib/guide-content.ts archive-next/lib/in-app-guide.test.ts
git commit -m "docs(guide): complete role-aware chapters"
```

### Task 2: Accessible guide browser behavior

**Files:**
- Modify: `archive-next/components/GuideBrowser.tsx`
- Create: `archive-next/components/GuideBrowser.test.tsx`
- Modify: `archive-next/app/help/page.tsx`

**Interfaces:**
- Consumes: `GuideBrowser({ chapters: GuideChapter[] })` and `filterGuideChapters(chapters, role, query)`.
- Produces: a keyboard-accessible local search, selected chapter state from `?chapter=`, and a fallback state when the chosen chapter is unauthorized or unmatched.

- [ ] **Step 1: Write a failing component test for local search and role filtering**

```tsx
render(<GuideBrowser chapters={chapters} />);
await user.type(screen.getByLabelText("ابحث في الدليل"), "صلاحيات");
expect(screen.getByText("إدارة النظام والتشغيل")).toBeVisible();
expect(screen.queryByText("إضافة المواد ووصفها")).not.toBeInTheDocument();
```

- [ ] **Step 2: Run the focused test and verify it fails before behavior is added**

Run: `pnpm --dir archive-next test -- GuideBrowser.test.tsx`

- [ ] **Step 3: Make the minimum semantic UI change**

```tsx
const selected = visible.find((chapter) => chapter.id === requestedChapter) ?? visible[0];
<p role="status">لا توجد نتيجة مطابقة في الدليل المتاح لدورك.</p>
```

Keep the search label, live region, chapter navigation, and destination link.

- [ ] **Step 4: Re-run the focused test and verify it passes**

Run: `pnpm --dir archive-next test -- GuideBrowser.test.tsx`

- [ ] **Step 5: Commit the browser behavior and test**

```powershell
git add archive-next/components/GuideBrowser.tsx archive-next/components/GuideBrowser.test.tsx archive-next/app/help/page.tsx
git commit -m "feat(guide): improve in-app guide discovery"
```
