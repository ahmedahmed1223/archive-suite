/**
 * Pages & UI components — WCAG 2.2 AA accessibility tests.
 *
 * Strategy:
 *  - V2 design-system primitives are tested directly (they are the real a11y surface).
 *  - Pages with simple dependency trees (SharedWithMePage, FileManagerPage) are rendered
 *    directly with props.
 *  - Pages that depend on useAppStore are rendered after seeding the store via setState().
 *  - framer-motion is mocked so jsdom does not throw on animation APIs.
 *  - HTMLDialogElement is polyfilled (jsdom lacks showModal/close).
 *
 * @vitest-environment jsdom
 */
import React from "react";
import { describe, it, expect, beforeEach, vi } from "vitest";
import { render } from "@testing-library/react";
import { axe } from "vitest-axe";

// toHaveNoViolations is registered globally in src/test-setup.js

// Limit to WCAG 2.x A/AA rules only — avoids experimental / best-practice noise
const AXE_OPTS = {
  runOnly: { type: "tag", values: ["wcag2a", "wcag2aa"] },
};

// ---------------------------------------------------------------------------
// Global mocks
// ---------------------------------------------------------------------------

// Silence framer-motion — jsdom cannot animate
vi.mock("framer-motion", async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    AnimatePresence: ({ children }) => children,
    motion: new Proxy(
      {},
      {
        get: (_target, tag) =>
          // Return a plain element with the same tag for any motion.X
          ({ children, initial, animate, exit, transition, variants, ...rest }) =>
            React.createElement(tag === "div" ? "div" : tag, rest, children),
      }
    ),
  };
});

// Polyfill HTMLDialogElement for jsdom
beforeEach(() => {
  if (!HTMLDialogElement.prototype.showModal) {
    HTMLDialogElement.prototype.showModal = function () {
      this.setAttribute("open", "");
    };
  }
  if (!HTMLDialogElement.prototype.close) {
    HTMLDialogElement.prototype.close = function () {
      this.removeAttribute("open");
    };
  }
});

// ---------------------------------------------------------------------------
// 1. ButtonV2 — all variants
// ---------------------------------------------------------------------------
import { ButtonV2 } from "../../components/ui/ButtonV2.jsx";

describe("ButtonV2 — a11y", () => {
  it("primary variant has no WCAG violations", async () => {
    const { container } = render(
      <ButtonV2 variant="primary">حفظ</ButtonV2>
    );
    expect(await axe(container, AXE_OPTS)).toHaveNoViolations();
  });

  it("secondary variant has no WCAG violations", async () => {
    const { container } = render(
      <ButtonV2 variant="secondary">إلغاء</ButtonV2>
    );
    expect(await axe(container, AXE_OPTS)).toHaveNoViolations();
  });

  it("ghost variant has no WCAG violations", async () => {
    const { container } = render(
      <ButtonV2 variant="ghost">المزيد</ButtonV2>
    );
    expect(await axe(container, AXE_OPTS)).toHaveNoViolations();
  });

  it("destructive variant has no WCAG violations", async () => {
    const { container } = render(
      <ButtonV2 variant="destructive">حذف</ButtonV2>
    );
    expect(await axe(container, AXE_OPTS)).toHaveNoViolations();
  });

  it("loading state (aria-busy) has no WCAG violations", async () => {
    const { container } = render(
      <ButtonV2 loading>جاري الحفظ</ButtonV2>
    );
    expect(await axe(container, AXE_OPTS)).toHaveNoViolations();
  });

  it("disabled state has no WCAG violations", async () => {
    const { container } = render(
      <ButtonV2 disabled>معطّل</ButtonV2>
    );
    expect(await axe(container, AXE_OPTS)).toHaveNoViolations();
  });
});

// ---------------------------------------------------------------------------
// 2. InputV2 — label, error, helper-text states
// ---------------------------------------------------------------------------
import { InputV2 } from "../../components/ui/InputV2.jsx";

describe("InputV2 — a11y", () => {
  it("with label has no WCAG violations", async () => {
    const { container } = render(
      <InputV2 label="البريد الإلكتروني" type="email" placeholder="user@example.com" />
    );
    expect(await axe(container, AXE_OPTS)).toHaveNoViolations();
  });

  it("required field has no WCAG violations", async () => {
    const { container } = render(
      <InputV2 label="الاسم الكامل" required />
    );
    expect(await axe(container, AXE_OPTS)).toHaveNoViolations();
  });

  it("error state (aria-invalid + alert) has no WCAG violations", async () => {
    const { container } = render(
      <InputV2 label="كلمة المرور" type="password" error="كلمة المرور قصيرة جداً" />
    );
    expect(await axe(container, AXE_OPTS)).toHaveNoViolations();
  });

  it("helper-text state has no WCAG violations", async () => {
    const { container } = render(
      <InputV2 label="اسم المستخدم" helperText="يجب أن يكون فريداً" />
    );
    expect(await axe(container, AXE_OPTS)).toHaveNoViolations();
  });

  it("no label (unlabelled) — no violations when aria-label provided via rest", async () => {
    const { container } = render(
      <InputV2 aria-label="بحث" placeholder="ابحث هنا..." />
    );
    expect(await axe(container, AXE_OPTS)).toHaveNoViolations();
  });
});

// ---------------------------------------------------------------------------
// 3. BadgeV2 — all variants
// ---------------------------------------------------------------------------
import { BadgeV2 } from "../../components/ui/BadgeV2.jsx";

describe("BadgeV2 — a11y", () => {
  it("default variant has no WCAG violations", async () => {
    const { container } = render(<BadgeV2>مسودة</BadgeV2>);
    expect(await axe(container, AXE_OPTS)).toHaveNoViolations();
  });

  it("success with dot has no WCAG violations", async () => {
    const { container } = render(<BadgeV2 variant="success" dot>نشط</BadgeV2>);
    expect(await axe(container, AXE_OPTS)).toHaveNoViolations();
  });

  it("danger variant has no WCAG violations", async () => {
    const { container } = render(<BadgeV2 variant="danger">مرفوض</BadgeV2>);
    expect(await axe(container, AXE_OPTS)).toHaveNoViolations();
  });

  it("warning variant has no WCAG violations", async () => {
    const { container } = render(<BadgeV2 variant="warning">قيد المراجعة</BadgeV2>);
    expect(await axe(container, AXE_OPTS)).toHaveNoViolations();
  });

  it("info variant has no WCAG violations", async () => {
    const { container } = render(<BadgeV2 variant="info">جديد</BadgeV2>);
    expect(await axe(container, AXE_OPTS)).toHaveNoViolations();
  });
});

// ---------------------------------------------------------------------------
// 4. CardV2 — solid and subtle, with sub-slots
// ---------------------------------------------------------------------------
import { CardV2 } from "../../components/ui/CardV2.jsx";

describe("CardV2 — a11y", () => {
  it("solid card with Header/Body/Footer has no WCAG violations", async () => {
    const { container } = render(
      <CardV2 variant="solid">
        <CardV2.Header>عنوان الملف</CardV2.Header>
        <CardV2.Body>وصف قصير للعنصر الأرشيفي المحدد.</CardV2.Body>
        <CardV2.Footer>
          <ButtonV2 variant="primary">فتح</ButtonV2>
        </CardV2.Footer>
      </CardV2>
    );
    expect(await axe(container, AXE_OPTS)).toHaveNoViolations();
  });

  it("subtle card with Body only has no WCAG violations", async () => {
    const { container } = render(
      <CardV2 variant="subtle">
        <CardV2.Body>محتوى مبسّط</CardV2.Body>
      </CardV2>
    );
    expect(await axe(container, AXE_OPTS)).toHaveNoViolations();
  });
});

// ---------------------------------------------------------------------------
// 5. SwitchV2 — role=switch, aria-checked, label
// ---------------------------------------------------------------------------
import { SwitchV2 } from "../../components/ui/SwitchV2.jsx";

describe("SwitchV2 — a11y", () => {
  it("unchecked state has no WCAG violations", async () => {
    const { container } = render(
      <SwitchV2 checked={false} onChange={() => {}} aria-label="تفعيل" />
    );
    expect(await axe(container, AXE_OPTS)).toHaveNoViolations();
  });

  it("checked state has no WCAG violations", async () => {
    const { container } = render(
      <SwitchV2 checked={true} onChange={() => {}} aria-label="تفعيل" />
    );
    expect(await axe(container, AXE_OPTS)).toHaveNoViolations();
  });

  it("with label has no WCAG violations", async () => {
    const { container } = render(
      <SwitchV2 checked={false} onChange={() => {}} label="تفعيل الإشعارات" />
    );
    expect(await axe(container, AXE_OPTS)).toHaveNoViolations();
  });

  it("disabled state has no WCAG violations", async () => {
    const { container } = render(
      // label prop provides the accessible name via aria-labelledby
      <SwitchV2 checked={false} onChange={() => {}} disabled label="وضع النوم" />
    );
    expect(await axe(container, AXE_OPTS)).toHaveNoViolations();
  });
});

// ---------------------------------------------------------------------------
// 6. TabsV2 — tablist/tab/tabpanel ARIA wiring
// ---------------------------------------------------------------------------
import { TabsV2 } from "../../components/ui/TabsV2.jsx";

describe("TabsV2 — a11y", () => {
  function renderTabs(props = {}) {
    return render(
      <TabsV2 defaultValue="details" {...props}>
        <TabsV2.List>
          <TabsV2.Tab value="details">التفاصيل</TabsV2.Tab>
          <TabsV2.Tab value="history">السجل</TabsV2.Tab>
          <TabsV2.Tab value="related" disabled>ذات صلة</TabsV2.Tab>
        </TabsV2.List>
        <TabsV2.Panel value="details">
          <p>محتوى التفاصيل</p>
        </TabsV2.Panel>
        <TabsV2.Panel value="history">
          <p>محتوى السجل</p>
        </TabsV2.Panel>
        <TabsV2.Panel value="related">
          <p>محتوى ذات صلة</p>
        </TabsV2.Panel>
      </TabsV2>
    );
  }

  it("underline variant has no WCAG violations", async () => {
    const { container } = renderTabs({ variant: "underline" });
    expect(await axe(container, AXE_OPTS)).toHaveNoViolations();
  });

  it("filled variant has no WCAG violations", async () => {
    const { container } = renderTabs({ variant: "filled" });
    expect(await axe(container, AXE_OPTS)).toHaveNoViolations();
  });

  it("second tab active has no WCAG violations", async () => {
    const { container } = renderTabs({ defaultValue: "history" });
    expect(await axe(container, AXE_OPTS)).toHaveNoViolations();
  });
});

// ---------------------------------------------------------------------------
// 7. DialogV2 — role=dialog, aria-modal, aria-labelledby, focus wiring
// ---------------------------------------------------------------------------
import { DialogV2 } from "../../components/ui/DialogV2.jsx";

describe("DialogV2 — a11y", () => {
  it("open dialog with title has no WCAG violations", async () => {
    const { container } = render(
      <DialogV2 open onClose={() => {}} title="تأكيد الحذف">
        <DialogV2.Body>هل أنت متأكد من حذف هذا العنصر؟</DialogV2.Body>
        <DialogV2.Footer>
          <ButtonV2 variant="destructive">حذف</ButtonV2>
          <ButtonV2 variant="secondary">إلغاء</ButtonV2>
        </DialogV2.Footer>
      </DialogV2>
    );
    expect(await axe(container, AXE_OPTS)).toHaveNoViolations();
  });

  it("dialog with title and description has no WCAG violations", async () => {
    const { container } = render(
      <DialogV2
        open
        onClose={() => {}}
        title="تغيير الاسم"
        description="أدخل الاسم الجديد للعنصر"
      >
        <DialogV2.Body>
          <InputV2 label="الاسم الجديد" />
        </DialogV2.Body>
      </DialogV2>
    );
    expect(await axe(container, AXE_OPTS)).toHaveNoViolations();
  });

  it("dialog without title (content-only) has no WCAG violations", async () => {
    const { container } = render(
      <DialogV2 open onClose={() => {}}>
        <DialogV2.Body>
          <p id="confirm-msg">هل تريد المتابعة؟</p>
        </DialogV2.Body>
      </DialogV2>
    );
    // No aria-labelledby when no title — acceptable for content-only dialogs
    expect(await axe(container, AXE_OPTS)).toHaveNoViolations();
  });
});

// ---------------------------------------------------------------------------
// 8. ToastV2 — role=alert, aria-live
// ---------------------------------------------------------------------------
import { ToastV2 } from "../../components/ui/ToastV2.jsx";

describe("ToastV2 — a11y", () => {
  it("success toast has no WCAG violations", async () => {
    const { container } = render(
      <ToastV2 message="تم الحفظ بنجاح" variant="success" onClose={() => {}} />
    );
    // Toast portals into document.body — axe the body to catch it
    expect(await axe(document.body, AXE_OPTS)).toHaveNoViolations();
  });

  it("error toast (assertive) has no WCAG violations", async () => {
    const { container } = render(
      <ToastV2 message="حدث خطأ غير متوقع" variant="error" onClose={() => {}} />
    );
    expect(await axe(document.body, AXE_OPTS)).toHaveNoViolations();
  });

  it("warning toast has no WCAG violations", async () => {
    const { container } = render(
      <ToastV2 message="سيتم حذف الملف نهائياً" variant="warning" onClose={() => {}} />
    );
    expect(await axe(document.body, AXE_OPTS)).toHaveNoViolations();
  });

  it("info toast without close button has no WCAG violations", async () => {
    render(<ToastV2 message="جاري المزامنة..." variant="info" />);
    expect(await axe(document.body, AXE_OPTS)).toHaveNoViolations();
  });
});

// ---------------------------------------------------------------------------
// 9. TooltipV2 — role=tooltip, aria-describedby
// ---------------------------------------------------------------------------
import { TooltipV2 } from "../../components/ui/TooltipV2.jsx";

describe("TooltipV2 — a11y", () => {
  it("tooltip wrapper around a button has no WCAG violations (hidden state)", async () => {
    // Tooltip is hidden by default (shown only on hover/focus)
    const { container } = render(
      <TooltipV2 content="حذف العنصر نهائياً" position="top">
        <button type="button" aria-label="حذف">🗑</button>
      </TooltipV2>
    );
    expect(await axe(container, AXE_OPTS)).toHaveNoViolations();
  });
});

// ---------------------------------------------------------------------------
// 10. SharedWithMePage — standalone page (no store dependency)
// ---------------------------------------------------------------------------
import SharedWithMePage from "../../pages/SharedWithMePage.jsx";

describe("SharedWithMePage — a11y", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.stubGlobal("location", { origin: "https://archive.example" });
  });

  it("initial empty state has no WCAG violations", async () => {
    const { container } = render(
      <SharedWithMePage openShareUrl={() => {}} />
    );
    expect(await axe(container, AXE_OPTS)).toHaveNoViolations();
  });
});

// ---------------------------------------------------------------------------
// 11. FileManagerPage — injected via props (no store needed at render)
// ---------------------------------------------------------------------------
import { FileManagerPage } from "../../pages/FileManagerPage.jsx";

function makeApi() {
  return {
    browseFiles: vi.fn(async () => ({
      entries: [
        { name: "مقاطع", key: "clips", kind: "folder" },
        { name: "حفل-2024.mp4", key: "حفل-2024.mp4", kind: "file", size: 512000 },
      ],
      nextCursor: null,
    })),
    createFileFolder: vi.fn(async () => ({ key: "new-folder" })),
    runFileAction: vi.fn(async () => ({ results: [] })),
    uploadManagedFile: vi.fn(async ({ key }) => ({ key })),
    downloadManagedFile: vi.fn(async () => new Blob(["x"])),
  };
}

describe("FileManagerPage — a11y", () => {
  it("initial loading state has no WCAG violations", async () => {
    // Use a never-resolving browseFiles so we catch the loading skeleton
    const frozenApi = { ...makeApi(), browseFiles: () => new Promise(() => {}) };
    const { container } = render(
      <FileManagerPage
        api={frozenApi}
        queueUpload={vi.fn(async () => null)}
        storageProvider={{}}
        onArchive={vi.fn()}
      />
    );
    expect(await axe(container, AXE_OPTS)).toHaveNoViolations();
  });

  it("loaded state (files visible) has no WCAG violations", async () => {
    const { container, findByText } = render(
      <FileManagerPage
        api={makeApi()}
        queueUpload={vi.fn(async () => null)}
        storageProvider={{}}
        onArchive={vi.fn()}
      />
    );
    // Wait for file list to appear
    await findByText("حفل-2024.mp4");
    expect(await axe(container, AXE_OPTS)).toHaveNoViolations();
  });
});

// ---------------------------------------------------------------------------
// 12. AddVideoPage — store-seeded render (step 1 only)
// ---------------------------------------------------------------------------
import { useAppStore } from "../../stores/appStore.js";
import { AddVideoPage } from "../../pages/AddVideoPage.jsx";

describe("AddVideoPage — a11y", () => {
  beforeEach(() => {
    useAppStore.setState({
      contentTypes: [
        { id: "video", name: "فيديو", status: "active", fields: [] },
      ],
      addVideoItem: vi.fn(async (item) => item),
      enqueueUploads: vi.fn(() => [{ id: "up_1", status: "queued" }]),
      updateUpload: vi.fn(),
      setCurrentPage: vi.fn(),
      setSelectedItemId: vi.fn(),
      showToast: vi.fn(),
    });
  });

  it("step 1 (file selection) has no WCAG violations", async () => {
    const { container } = render(<AddVideoPage />);
    expect(await axe(container, AXE_OPTS)).toHaveNoViolations();
  });
});
