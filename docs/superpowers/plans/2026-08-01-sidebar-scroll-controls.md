# Sidebar Scroll Controls Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add accessible up/down scroll controls to the desktop sidebar while hiding its native scrollbar.

**Architecture:** Keep `route-links` as the scroll container and add a ref-driven pair of buttons in `AppHeader`. A small state refresh reads scroll boundaries and runs after scroll, resize, and navigation-group changes. Desktop-only CSS hides the scrollbar while preserving normal scrolling.

**Tech Stack:** Next.js App Router, React 19, TypeScript, lucide-react, Vitest, CSS custom properties.

## Global Constraints

- Use existing `ChevronUp` and `ChevronDown` icons from lucide-react; add no dependency.
- Preserve mobile drawer behavior below 1120px.
- Buttons must have Arabic labels, disabled states, and 44px touch targets.
- Preserve wheel, touch, keyboard, and reduced-motion behavior.

---

### Task 1: Sidebar scroll controls

**Files:**
- Modify: `archive-next/components/AppHeader.tsx`
- Modify: `archive-next/components/AppHeader.test.tsx`
- Modify: `archive-next/app/styles/06-widgets.css`

**Interfaces:**
- Consumes: `HTMLElement.scrollTop`, `scrollHeight`, and `clientHeight` on the existing `route-links` navigation element.
- Produces: buttons labelled `تمرير القائمة لأعلى` and `تمرير القائمة لأسفل` that call `scrollBy` on that element.

- [x] **Step 1: Write the failing test**

```tsx
test("scrolls the desktop navigation from its explicit controls", () => {
  render(<AppHeader subtitle="الرئيسية" />);
  const navigation = screen.getByRole("navigation");
  Object.defineProperties(navigation, {
    scrollHeight: { value: 800 },
    clientHeight: { value: 300 },
    scrollTop: { value: 120, writable: true }
  });
  const scrollBy = vi.fn();
  Object.assign(navigation, { scrollBy });

  fireEvent.click(screen.getByRole("button", { name: "تمرير القائمة لأسفل" }));
  expect(scrollBy).toHaveBeenCalledWith(expect.objectContaining({ top: expect.any(Number) }));
});
```

- [x] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @archive/next test components/AppHeader.test.tsx`

Expected: FAIL because the sidebar does not expose `تمرير القائمة لأسفل`.

- [x] **Step 3: Write minimal implementation**

```tsx
const routeLinksRef = useRef<HTMLElement>(null);
const scrollNavigation = (direction: 1 | -1) => {
  routeLinksRef.current?.scrollBy({ top: direction * 280, behavior: "smooth" });
};

<button aria-label="تمرير القائمة لأعلى" onClick={() => scrollNavigation(-1)} />
<nav ref={routeLinksRef}>...</nav>
<button aria-label="تمرير القائمة لأسفل" onClick={() => scrollNavigation(1)} />
```

Add desktop CSS that lays the controls above and below the scroll region, hides `.route-links` scrollbars with `scrollbar-width: none` and `::-webkit-scrollbar { display: none; }`, and keeps all rules outside mobile breakpoints.

- [x] **Step 4: Run focused tests to verify the result**

Run: `pnpm --filter @archive/next test components/AppHeader.test.tsx`

Expected: PASS, including the new control interaction and existing navigation tests.

- [x] **Step 5: Run integration verification**

Run: `pnpm --filter @archive/next typecheck && pnpm --filter @archive/next build`

Expected: TypeScript and production build both exit with code 0.

- [ ] **Step 6: Commit**

```bash
git add archive-next/components/AppHeader.tsx archive-next/components/AppHeader.test.tsx archive-next/app/styles/06-widgets.css docs/superpowers/specs/2026-08-01-sidebar-scroll-controls-design.md docs/superpowers/plans/2026-08-01-sidebar-scroll-controls.md
git commit -m "feat(navigation): add sidebar scroll controls"
```
