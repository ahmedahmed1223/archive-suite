// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";
import { buildPresetPatch } from "@/lib/experience-presets";

vi.mock("@/lib/i18n/LocaleProvider", async () => {
  const { getDictionary } = await vi.importActual<typeof import("@/lib/i18n/dictionaries")>("@/lib/i18n/dictionaries");
  return { useLocale: () => ({ locale: "ar", t: getDictionary("ar") }) };
});

const { default: PresetsSection } = await import("./PresetsSection");

describe("PresetsSection", () => {
  afterEach(cleanup);

  test("applying a preset sends the exact one-time patch built for it, nothing else", async () => {
    const onUpdate = vi.fn().mockResolvedValue({ ok: true });
    render(<PresetsSection onUpdate={onUpdate} />);

    fireEvent.click(screen.getAllByRole("button", { name: "تطبيق" })[0]);

    await waitFor(() => expect(onUpdate).toHaveBeenCalledTimes(1));
    expect(onUpdate).toHaveBeenCalledWith(buildPresetPatch("archivist"));
  });

  test("shows all four required personas by their Arabic names", () => {
    const onUpdate = vi.fn().mockResolvedValue({ ok: true });
    render(<PresetsSection onUpdate={onUpdate} />);

    expect(screen.getByText("أمين أرشيف")).toBeInTheDocument();
    expect(screen.getByText("مراجع")).toBeInTheDocument();
    expect(screen.getByText("محرر وسائط")).toBeInTheDocument();
    expect(screen.getByText("عرض مبسط")).toBeInTheDocument();
  });

  test("surfaces a write failure instead of silently discarding it", async () => {
    const onUpdate = vi.fn().mockResolvedValue({ ok: false, failure: { kind: "network", message: "تعذر الاتصال بالخادم." } });
    render(<PresetsSection onUpdate={onUpdate} />);

    fireEvent.click(screen.getAllByRole("button", { name: "تطبيق" })[0]);

    expect(await screen.findByText("تعذر الاتصال بالخادم.")).toBeInTheDocument();
  });
});
