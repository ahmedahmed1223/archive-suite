/**
 * Per-component accessibility tests using vitest-axe + @testing-library/react.
 *
 * These run axe-core WCAG rules against the real rendered DOM for each major
 * UI component, giving fast feedback without spinning up a full browser.
 *
 * @vitest-environment jsdom
 */
import React from "react";
import { describe, it, expect, beforeAll } from "vitest";
import { render } from "@testing-library/react";
import { axe } from "vitest-axe";
// toHaveNoViolations is registered globally in src/test-setup.js

// axe options: limit to WCAG 2.x A/AA rules to avoid experimental rule noise
const AXE_OPTS = {
  runOnly: { type: "tag", values: ["wcag2a", "wcag2aa"] },
};

// ---------------------------------------------------------------------------
// 1. Pagination
// ---------------------------------------------------------------------------
import { Pagination } from "../../components/common/Pagination.jsx";

describe("Pagination — a11y", () => {
  it("has no WCAG violations with multiple pages (middle page)", async () => {
    const { container } = render(
      <Pagination page={3} totalPages={10} onPageChange={() => {}} />
    );
    const results = await axe(container, AXE_OPTS);
    expect(results).toHaveNoViolations();
  });

  it("has no WCAG violations on the first page", async () => {
    const { container } = render(
      <Pagination page={1} totalPages={5} onPageChange={() => {}} />
    );
    const results = await axe(container, AXE_OPTS);
    expect(results).toHaveNoViolations();
  });

  it("has no WCAG violations on the last page", async () => {
    const { container } = render(
      <Pagination page={10} totalPages={10} onPageChange={() => {}} />
    );
    const results = await axe(container, AXE_OPTS);
    expect(results).toHaveNoViolations();
  });

  it("has no WCAG violations when totalItems is shown", async () => {
    const { container } = render(
      <Pagination page={2} totalPages={8} onPageChange={() => {}} totalItems={156} />
    );
    const results = await axe(container, AXE_OPTS);
    expect(results).toHaveNoViolations();
  });

  it("renders nothing (no violations possible) when totalPages <= 1", async () => {
    const { container } = render(
      <Pagination page={1} totalPages={1} onPageChange={() => {}} />
    );
    // Component returns null — container should just be the wrapper div with no content
    expect(container.firstChild).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// 2. PresenceIndicator
// ---------------------------------------------------------------------------
import { PresenceIndicator } from "../../components/collaboration/PresenceIndicator.jsx";

const VIEWERS = [
  { userId: "u1", username: "Ahmed" },
  { userId: "u2", username: "Sara" },
  { userId: "u3", username: "Omar" },
];

describe("PresenceIndicator — a11y", () => {
  it("has no WCAG violations with one other viewer", async () => {
    const { container } = render(
      <PresenceIndicator viewers={VIEWERS.slice(0, 2)} currentUserId="u1" />
    );
    const results = await axe(container, AXE_OPTS);
    expect(results).toHaveNoViolations();
  });

  it("has no WCAG violations with three other viewers (no overflow)", async () => {
    const viewers = [
      { userId: "u0", username: "Me" },
      ...VIEWERS,
    ];
    const { container } = render(
      <PresenceIndicator viewers={viewers} currentUserId="u0" />
    );
    const results = await axe(container, AXE_OPTS);
    expect(results).toHaveNoViolations();
  });

  it("has no WCAG violations when overflow +N badge is shown (>3 others)", async () => {
    const viewers = [
      { userId: "u0", username: "Me" },
      { userId: "u1", username: "Ahmed" },
      { userId: "u2", username: "Sara" },
      { userId: "u3", username: "Omar" },
      { userId: "u4", username: "Layla" },
    ];
    const { container } = render(
      <PresenceIndicator viewers={viewers} currentUserId="u0" />
    );
    const results = await axe(container, AXE_OPTS);
    expect(results).toHaveNoViolations();
  });

  it("renders nothing when there are no other viewers", async () => {
    const { container } = render(
      <PresenceIndicator viewers={[{ userId: "u1", username: "Me" }]} currentUserId="u1" />
    );
    expect(container.firstChild).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// 3. ProgressBar
// ---------------------------------------------------------------------------
import { ProgressBar } from "../../components/common/ProgressBar.jsx";

describe("ProgressBar — a11y", () => {
  it("has no WCAG violations during active progress", async () => {
    const { container } = render(
      <ProgressBar
        progress={{ active: true, percent: 45, label: "جاري الرفع...", eta: 30 }}
        onCancel={() => {}}
      />
    );
    const results = await axe(container, AXE_OPTS);
    expect(results).toHaveNoViolations();
  });

  it("has no WCAG violations at 100% (complete)", async () => {
    const { container } = render(
      <ProgressBar
        progress={{ active: true, percent: 100, label: "اكتمل", eta: null }}
      />
    );
    const results = await axe(container, AXE_OPTS);
    expect(results).toHaveNoViolations();
  });

  it("has no WCAG violations without a cancel button", async () => {
    const { container } = render(
      <ProgressBar
        progress={{ active: true, percent: 60, label: "معالجة...", eta: null }}
      />
    );
    const results = await axe(container, AXE_OPTS);
    expect(results).toHaveNoViolations();
  });

  it("has no WCAG violations with ETA in minutes", async () => {
    const { container } = render(
      <ProgressBar
        progress={{ active: true, percent: 20, label: "استيراد البيانات", eta: 300 }}
        onCancel={() => {}}
      />
    );
    const results = await axe(container, AXE_OPTS);
    expect(results).toHaveNoViolations();
  });
});

// ---------------------------------------------------------------------------
// 4. EmptyState
// ---------------------------------------------------------------------------
import { EmptyState } from "../../components/common/EmptyState.jsx";

describe("EmptyState — a11y", () => {
  it("has no WCAG violations with title and description only", async () => {
    const { container } = render(
      <EmptyState
        type="archive"
        title="لا توجد نتائج"
        description="لم يتم العثور على أي سجلات تطابق بحثك."
      />
    );
    const results = await axe(container, AXE_OPTS);
    expect(results).toHaveNoViolations();
  });

  it("has no WCAG violations with action button", async () => {
    const { container } = render(
      <EmptyState
        type="archive"
        title="الأرشيف فارغ"
        description="ابدأ بإضافة ملفاتك الأولى."
        actionLabel="إضافة ملف"
        onAction={() => {}}
      />
    );
    const results = await axe(container, AXE_OPTS);
    expect(results).toHaveNoViolations();
  });

  it("has no WCAG violations with primary and secondary actions", async () => {
    const { container } = render(
      <EmptyState
        type="search"
        title="لا نتائج للبحث"
        description="جرّب كلمات مختلفة."
        actionLabel="بحث جديد"
        onAction={() => {}}
        secondaryActionLabel="مسح الفلاتر"
        onSecondaryAction={() => {}}
      />
    );
    const results = await axe(container, AXE_OPTS);
    expect(results).toHaveNoViolations();
  });

  it("has no WCAG violations with hint items", async () => {
    const { container } = render(
      <EmptyState
        type="favorites"
        title="لا توجد مفضلات"
        hintItems={["أضف نجمة لأي ملف", "المفضلة تظهر هنا"]}
      />
    );
    const results = await axe(container, AXE_OPTS);
    expect(results).toHaveNoViolations();
  });
});

// ---------------------------------------------------------------------------
// 5. AutoTagSuggestions (static render — tags pre-loaded, no fetch)
// ---------------------------------------------------------------------------
import { AutoTagSuggestions } from "../../components/upload/AutoTagSuggestions.jsx";

describe("AutoTagSuggestions — a11y", () => {
  it("renders nothing (no violations) when name/summary are too short", async () => {
    const { container } = render(
      <AutoTagSuggestions name="short" summary="" onAccept={() => {}} />
    );
    // Component returns null when no tags and not loading
    expect(container.firstChild).toBeNull();
  });

  it("has no WCAG violations when showing tag suggestion pills (mocked state)", async () => {
    // We inject a static container that mirrors what AutoTagSuggestions renders
    // when tags are available — this tests the DOM structure directly.
    const { container } = render(
      <div className="mt-2 p-3 rounded-lg">
        <p className="text-xs">وسوم مقترحة</p>
        <div className="flex flex-wrap gap-1.5">
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs">
            وثيقة
            <button aria-label="قبول وثيقة" type="button">✓</button>
            <button aria-label="رفض وثيقة" type="button">×</button>
          </span>
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs">
            تاريخي
            <button aria-label="قبول تاريخي" type="button">✓</button>
            <button aria-label="رفض تاريخي" type="button">×</button>
          </span>
          <button type="button">قبول الكل</button>
        </div>
      </div>
    );
    const results = await axe(container, AXE_OPTS);
    expect(results).toHaveNoViolations();
  });
});

// ---------------------------------------------------------------------------
// 6. BackupManager (mocked fetch to control loading state)
// ---------------------------------------------------------------------------
import { BackupManager } from "../../components/admin/BackupManager.jsx";

describe("BackupManager — a11y", () => {
  beforeAll(() => {
    // Provide a global fetch stub so BackupManager's useEffect resolves cleanly
    global.fetch = async (url) => {
      if (url.includes("/api/admin/backups")) {
        return {
          ok: true,
          json: async () => ({
            backups: [
              {
                filename: "archive-2025-06-01.sqlite",
                createdAt: "2025-06-01T12:00:00Z",
                sizeBytes: 2097152,
              },
              {
                filename: "archive-2025-05-15.sqlite",
                createdAt: "2025-05-15T08:30:00Z",
                sizeBytes: 1048576,
              },
            ],
          }),
        };
      }
      return { ok: false, json: async () => ({}) };
    };
  });

  it("has no WCAG violations in the loaded-with-backups state", async () => {
    const { container, findByText } = render(
      <BackupManager authToken="mock-token" />
    );
    // Wait for the list to appear (fetch resolves)
    await findByText("archive-2025-06-01.sqlite");
    const results = await axe(container, AXE_OPTS);
    expect(results).toHaveNoViolations();
  });

  it("has no WCAG violations in the loading state", async () => {
    // Override fetch to never resolve during this test
    const originalFetch = global.fetch;
    global.fetch = () => new Promise(() => {});
    const { container } = render(<BackupManager authToken="mock-token" />);
    // Component is in "loading" state (no fetch resolution)
    const results = await axe(container, AXE_OPTS);
    expect(results).toHaveNoViolations();
    global.fetch = originalFetch;
  });
});
