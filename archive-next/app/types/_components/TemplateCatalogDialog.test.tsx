// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, test, vi } from "vitest";
import { LocaleProvider } from "@/lib/i18n/LocaleProvider";

const { types, metadataTemplates, tagNodes, saveType, createMetadataTemplate, createTagNode } = vi.hoisted(() => ({
  types: vi.fn(),
  metadataTemplates: vi.fn(),
  tagNodes: vi.fn(),
  saveType: vi.fn(),
  createMetadataTemplate: vi.fn(),
  createTagNode: vi.fn(),
}));
vi.mock("@/lib/archive-api", () => ({
  createArchiveApiClient: () => ({ types, metadataTemplates, tagNodes, saveType, createMetadataTemplate, createTagNode }),
}));

import TemplateCatalogDialog from "./TemplateCatalogDialog";

afterEach(() => { cleanup(); vi.clearAllMocks(); });

function renderDialog(node: ReactNode) {
  return render(<LocaleProvider initialLocale="ar" hasLocaleCookie>{node}</LocaleProvider>);
}

function emptyState() {
  types.mockResolvedValue({ ok: true, types: [], nextCursor: null });
  metadataTemplates.mockResolvedValue({ ok: true, templates: [] });
  tagNodes.mockResolvedValue({ ok: true, nodes: [] });
}

describe("TemplateCatalogDialog", () => {
  test("lists all four archive-pattern templates when opened", async () => {
    emptyState();
    renderDialog(<TemplateCatalogDialog open onOpenChange={() => {}} onApplied={() => {}} />);
    expect(await screen.findByText("البث التلفزيوني والبرامج")).toBeTruthy();
    expect(screen.getByText("اللقطات الميدانية الخام")).toBeTruthy();
    expect(screen.getByText("الشهادات الشفوية")).toBeTruthy();
    expect(screen.getByText("التوثيق الحقوقي")).toBeTruthy();
  });

  test("previews everything as new against an empty instance, then applies and creates every piece", async () => {
    emptyState();
    saveType.mockResolvedValue({ ok: true, type: { id: "pattern-broadcast-program", name: "برنامج تلفزيوني", fields: [] } });
    createTagNode.mockImplementation(async (payload: { tag: string; parent: string }) => ({ ok: true, node: { id: "n", ...payload, color: null, order: 0, icon: null, createdAt: null, updatedAt: null } }));
    createMetadataTemplate.mockResolvedValue({ ok: true, template: { id: "tpl", typeId: "pattern-broadcast-program", departmentId: "general", name: "قالب بيانات برنامج تلفزيوني", fields: {}, tags: [], enabled: false, usageRoles: [], currentVersion: 1, createdById: null, updatedById: null, publishedVersion: null, publishedById: null, publishedAt: null, createdAt: "", updatedAt: "" } });

    const onApplied = vi.fn();
    renderDialog(<TemplateCatalogDialog open onOpenChange={() => {}} onApplied={onApplied} />);

    fireEvent.click(await screen.findByText("البث التلفزيوني والبرامج"));

    expect(await screen.findAllByText("سيُنشأ")).toHaveLength(5); // 1 type + 1 template + 3 tags

    const applyButton = screen.getByRole("button", { name: "تطبيق القالب" });
    expect(applyButton).toBeDisabled(); // department id still empty

    fireEvent.change(screen.getByLabelText(/معرّف القسم المالك/), { target: { value: "general" } });
    expect(applyButton).toBeEnabled();

    fireEvent.click(applyButton);

    await waitFor(() => expect(createMetadataTemplate).toHaveBeenCalled());
    expect(saveType).toHaveBeenCalledWith(expect.objectContaining({ id: "pattern-broadcast-program" }));
    expect(createTagNode).toHaveBeenCalledTimes(3);
    expect(createMetadataTemplate).toHaveBeenCalledWith(expect.objectContaining({ departmentId: "general", enabled: false }));
    expect(await screen.findByText(/تم التطبيق/)).toBeTruthy();
    expect(onApplied).toHaveBeenCalledTimes(1);
  });

  test("marks a template as fully existing and disables apply, without calling any create endpoint", async () => {
    types.mockResolvedValue({ ok: true, types: [{ id: "pattern-broadcast-program", name: "برنامج تلفزيوني", fields: [] }], nextCursor: null });
    metadataTemplates.mockResolvedValue({ ok: true, templates: [{ id: "tpl", typeId: "pattern-broadcast-program", departmentId: "d", name: "قالب بيانات برنامج تلفزيوني", fields: {}, tags: [], enabled: false, usageRoles: [], currentVersion: 1, createdById: null, updatedById: null, publishedVersion: null, publishedById: null, publishedAt: null, createdAt: "", updatedAt: "" }] });
    tagNodes.mockResolvedValue({ ok: true, nodes: [
      { id: "n1", tag: "بث تلفزيوني", parent: "", color: null, order: 0, icon: null, createdAt: null, updatedAt: null },
      { id: "n2", tag: "برامج", parent: "بث تلفزيوني", color: null, order: 0, icon: null, createdAt: null, updatedAt: null },
      { id: "n3", tag: "نشرات إخبارية", parent: "بث تلفزيوني", color: null, order: 0, icon: null, createdAt: null, updatedAt: null },
    ] });

    renderDialog(<TemplateCatalogDialog open onOpenChange={() => {}} onApplied={() => {}} />);
    fireEvent.click(await screen.findByText("البث التلفزيوني والبرامج"));

    expect(await screen.findAllByText("موجود مسبقًا")).toHaveLength(5);
    expect(screen.getByText("كل عناصر هذا القالب موجودة بالفعل — لا شيء لتطبيقه.")).toBeTruthy();
    expect(screen.getByRole("button", { name: "تطبيق القالب" })).toBeDisabled();

    fireEvent.click(screen.getByRole("button", { name: "تطبيق القالب" }));
    expect(saveType).not.toHaveBeenCalled();
    expect(createTagNode).not.toHaveBeenCalled();
    expect(createMetadataTemplate).not.toHaveBeenCalled();
  });
});
