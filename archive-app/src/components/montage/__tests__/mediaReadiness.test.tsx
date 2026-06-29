// @vitest-environment jsdom
import * as React from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeAll, describe, expect, it, vi } from "vitest";

import { MediaReadinessPanel } from "../MediaReadinessPanel.jsx";
import { ExportPackageWizard } from "../ExportPackageWizard.jsx";

// jsdom does not implement HTMLDialogElement.showModal / close.
// Polyfill them so DialogV2 (which uses the native <dialog>) can render.
beforeAll(() => {
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

// ── helpers ───────────────────────────────────────────────────────────────────

function makeItem(overrides = {}) {
  return {
    id: `item-${Math.random().toString(36).slice(2)}`,
    title: "Test Item",
    path: "/media/test.mp4",
    metadata: {
      media: {
        thumbnailKey: "thumb.jpg",
        audioKey: "audio.mp3",
        transcription: "some text",
        derivedKey: "proxy.mp4"
      }
    },
    ...overrides
  };
}

function makeProject(overrides = {}) {
  return {
    id: "proj-1",
    name: "تقرير القدس",
    description: "",
    roughCuts: [],
    itemIds: [],
    markers: [],
    comments: [],
    ...overrides
  };
}

// ── MediaReadinessPanel ───────────────────────────────────────────────────────

describe("MediaReadinessPanel", () => {
  it("renders readiness percentage for a fully ready item", () => {
    const item = makeItem();
    const project = makeProject({ itemIds: [item.id] });

    render(
      <MediaReadinessPanel
        project={project}
        items={[item]}
        onExport={vi.fn()}
        onCancel={vi.fn()}
      />
    );

    // Should show 100% since all 5 checks pass
    expect(screen.getByLabelText(/نسبة الجاهزية 100%/)).toBeInTheDocument();
  });

  it("shows blocking issues with red styling for item missing source", () => {
    const item = makeItem({ path: "", metadata: { media: {} } });
    const project = makeProject({ itemIds: [item.id] });

    render(
      <MediaReadinessPanel
        project={project}
        items={[item]}
        onExport={vi.fn()}
        onCancel={vi.fn()}
      />
    );

    // Missing source triggers "blocked" status
    const issueList = screen.getByRole("list", { name: /قائمة مشاكل الوسائط/ });
    expect(issueList).toBeInTheDocument();
    // The item should appear in the issues list
    expect(issueList).toHaveTextContent("Test Item");
  });

  it("shows threshold warning when readiness is below 80%", () => {
    // Item with only source path — missing thumbnail, audio, transcript, web
    const item = makeItem({ metadata: { media: {} } });
    const project = makeProject({ itemIds: [item.id] });

    render(
      <MediaReadinessPanel
        project={project}
        items={[item]}
        onExport={vi.fn()}
        onCancel={vi.fn()}
      />
    );

    expect(screen.getByRole("alert")).toHaveTextContent("غير جاهز للتصدير بالكامل");
  });

  it("fires onExport when 'Export Anyway' button is clicked for low-readiness project", async () => {
    const user = userEvent.setup();
    const onExport = vi.fn();
    const item = makeItem({ metadata: { media: {} } });
    const project = makeProject({ itemIds: [item.id] });

    render(
      <MediaReadinessPanel
        project={project}
        items={[item]}
        onExport={onExport}
        onCancel={vi.fn()}
      />
    );

    const exportAnywayBtn = screen.getByRole("button", { name: /تصدير على أي حال/i });
    await user.click(exportAnywayBtn);

    expect(onExport).toHaveBeenCalledWith("json");
  });

  it("fires onCancel when cancel button is clicked", async () => {
    const user = userEvent.setup();
    const onCancel = vi.fn();
    const project = makeProject();

    render(
      <MediaReadinessPanel
        project={project}
        items={[]}
        onExport={vi.fn()}
        onCancel={onCancel}
      />
    );

    await user.click(screen.getByRole("button", { name: /إلغاء/i }));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it("shows 'متابعة التصدير' button that calls onExport with wizard signal", async () => {
    const user = userEvent.setup();
    const onExport = vi.fn();
    const item = makeItem(); // fully ready
    const project = makeProject({ itemIds: [item.id] });

    render(
      <MediaReadinessPanel
        project={project}
        items={[item]}
        onExport={onExport}
        onCancel={vi.fn()}
      />
    );

    await user.click(screen.getByRole("button", { name: /متابعة التصدير/i }));
    expect(onExport).toHaveBeenCalledWith("wizard");
  });
});

// ── ExportPackageWizard ───────────────────────────────────────────────────────

describe("ExportPackageWizard", () => {
  const defaultProps = {
    open: true,
    onClose: vi.fn(),
    project: makeProject({ name: "تقرير القدس" }),
    items: [],
    itemsById: new Map(),
    onExport: vi.fn()
  };

  it("renders step 1 (package contents) on open", () => {
    render(<ExportPackageWizard {...defaultProps} />);

    // Step 1 header
    expect(screen.getByText(/معالج التصدير/i)).toBeInTheDocument();
    expect(screen.getByText(/محتويات الحزمة/i)).toBeInTheDocument();
    // Step indicator
    expect(screen.getByText(/الخطوة 1 من 2/i)).toBeInTheDocument();
    // The inclusion fieldset legend
    expect(screen.getByText(/اختر المحتويات/i)).toBeInTheDocument();
  });

  it("navigates to step 2 when Next button is clicked", async () => {
    const user = userEvent.setup();
    render(<ExportPackageWizard {...defaultProps} />);

    await user.click(screen.getByRole("button", { name: /المتابعة لخطوة وجهة التصدير/i }));

    expect(screen.getByText(/وجهة التصدير/i)).toBeInTheDocument();
    expect(screen.getByText(/الخطوة 2 من 2/i)).toBeInTheDocument();
  });

  it("navigates back to step 1 from step 2 when Back button is clicked", async () => {
    const user = userEvent.setup();
    render(<ExportPackageWizard {...defaultProps} />);

    // Go to step 2
    await user.click(screen.getByRole("button", { name: /المتابعة لخطوة وجهة التصدير/i }));
    expect(screen.getByText(/الخطوة 2 من 2/i)).toBeInTheDocument();

    // Go back
    await user.click(screen.getByRole("button", { name: /العودة للخطوة السابقة/i }));
    expect(screen.getByText(/الخطوة 1 من 2/i)).toBeInTheDocument();
    expect(screen.getByText(/محتويات الحزمة/i)).toBeInTheDocument();
  });

  it("fires onExport with selected format when export button on step 2 is clicked", async () => {
    const user = userEvent.setup();
    const onExport = vi.fn();
    render(<ExportPackageWizard {...defaultProps} onExport={onExport} />);

    // Navigate to step 2
    await user.click(screen.getByRole("button", { name: /المتابعة لخطوة وجهة التصدير/i }));

    // Default format is "json" — click export
    await user.click(screen.getByRole("button", { name: /تصدير الحزمة/i }));

    expect(onExport).toHaveBeenCalledTimes(1);
    expect(onExport).toHaveBeenCalledWith(
      "json",
      expect.objectContaining({ name: expect.any(String) })
    );
  });

  it("pre-fills output name with project name", async () => {
    const user = userEvent.setup();
    render(<ExportPackageWizard {...defaultProps} />);

    await user.click(screen.getByRole("button", { name: /المتابعة لخطوة وجهة التصدير/i }));

    const input = screen.getByRole("textbox", { name: /اسم ملف التصدير/i });
    expect(input).toHaveValue("تقرير القدس");
  });

  it("calls onClose when Cancel is clicked", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<ExportPackageWizard {...defaultProps} onClose={onClose} />);

    await user.click(screen.getByRole("button", { name: /إلغاء/i }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
