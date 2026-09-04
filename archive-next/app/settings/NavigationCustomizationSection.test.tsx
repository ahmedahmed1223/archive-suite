// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";
import { DEFAULT_CAPABILITIES, DEFAULT_EXPERIENCE, type Capabilities } from "@/lib/experience-profile";

vi.mock("@/lib/i18n/LocaleProvider", async () => {
  const { getDictionary } = await vi.importActual<typeof import("@/lib/i18n/dictionaries")>("@/lib/i18n/dictionaries");
  return { useLocale: () => ({ locale: "ar", t: getDictionary("ar") }) };
});

const { default: NavigationCustomizationSection } = await import("./NavigationCustomizationSection");

function experienceWith(navigation: { order: string[]; hiddenModules: string[] }) {
  return {
    ...structuredClone(DEFAULT_EXPERIENCE),
    navigation: { value: navigation, source: "user" as const, editable: true }
  };
}

describe("NavigationCustomizationSection", () => {
  afterEach(cleanup);

  test("the mandatory /settings item is checked and disabled, even when hiddenModules asks to hide it", () => {
    const onUpdate = vi.fn().mockResolvedValue({ ok: true });
    const experience = experienceWith({ order: [], hiddenModules: ["/settings"] });

    render(<NavigationCustomizationSection experience={experience} capabilities={DEFAULT_CAPABILITIES} onUpdate={onUpdate} />);

    const checkbox = screen.getByLabelText("الإعدادات") as HTMLInputElement;
    expect(checkbox.checked).toBe(true);
    expect(checkbox.disabled).toBe(true);
  });

  test("a capability-disabled module's checkbox is unchecked and disabled, and cannot be toggled on", () => {
    const onUpdate = vi.fn().mockResolvedValue({ ok: true });
    const capabilities: Capabilities = {
      ...structuredClone(DEFAULT_CAPABILITIES),
      backups: { ...DEFAULT_CAPABILITIES.backups, value: false, status: "disabled" }
    };
    const experience = experienceWith({ order: [], hiddenModules: [] });

    render(<NavigationCustomizationSection experience={experience} capabilities={capabilities} onUpdate={onUpdate} />);

    const checkbox = screen.getByLabelText("النسخ الاحتياطي") as HTMLInputElement;
    expect(checkbox.checked).toBe(false);
    expect(checkbox.disabled).toBe(true);
    expect(screen.getAllByText("معطّل على هذا النشر").length).toBeGreaterThan(0);
  });

  test("hiding an ordinary item writes it into hiddenModules via onUpdate", async () => {
    const onUpdate = vi.fn().mockResolvedValue({ ok: true });
    const experience = experienceWith({ order: [], hiddenModules: [] });

    render(<NavigationCustomizationSection experience={experience} capabilities={DEFAULT_CAPABILITIES} onUpdate={onUpdate} />);

    fireEvent.click(screen.getByLabelText("كانبان"));

    expect(onUpdate).toHaveBeenCalledWith({
      navigation: expect.objectContaining({ hiddenModules: expect.arrayContaining(["/kanban"]) })
    });
  });

  test("moving a group up sends the swapped order to onUpdate", () => {
    const onUpdate = vi.fn().mockResolvedValue({ ok: true });
    const experience = experienceWith({ order: [], hiddenModules: [] });

    render(<NavigationCustomizationSection experience={experience} capabilities={DEFAULT_CAPABILITIES} onUpdate={onUpdate} />);

    const moveUpButtons = screen.getAllByRole("button", { name: /نقل لأعلى/ });
    // The first group's "move up" is disabled (nothing above it); use the second.
    fireEvent.click(moveUpButtons[1]);

    expect(onUpdate).toHaveBeenCalledWith({
      navigation: expect.objectContaining({ order: ["ingest", "dailyWork", "archiveDescription", "media", "searchKnowledge", "projectsCollaboration", "rightsSharing", "administrationReliability"] })
    });
  });

  test("preserves a saved legacy group order and writes its canonical replacement", () => {
    const onUpdate = vi.fn().mockResolvedValue({ ok: true });
    const experience = experienceWith({ order: ["collaborate", "capture", "system"], hiddenModules: [] });

    render(<NavigationCustomizationSection experience={experience} capabilities={DEFAULT_CAPABILITIES} onUpdate={onUpdate} />);

    const labels = Array.from(document.querySelectorAll(".settings-hub__nav-order-row > span:first-child"))
      .map((label) => label.textContent);
    expect(labels.slice(0, 5)).toEqual(["العمل اليومي", "المشاريع والتعاون", "الحقوق والمشاركة", "الإدخال", "الوسائط"]);

    fireEvent.click(screen.getByLabelText("كانبان"));
    expect(onUpdate).toHaveBeenCalledWith({
      navigation: expect.objectContaining({
        order: ["dailyWork", "projectsCollaboration", "rightsSharing", "ingest", "media", "searchKnowledge", "administrationReliability", "archiveDescription"],
      })
    });
  });
});
