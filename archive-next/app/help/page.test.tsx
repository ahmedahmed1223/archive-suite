// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import HelpPage from "./page";
import { LocaleProvider } from "@/lib/i18n/LocaleProvider";

vi.mock("@/components/AppShell", () => ({
  default: ({ children }: { children: React.ReactNode }) => <main>{children}</main>,
}));
vi.mock("@/components/PageToolbar", () => ({
  default: ({ title, description, actions }: { title: string; description: string; actions: React.ReactNode }) => (
    <header><h1>{title}</h1><p>{description}</p>{actions}</header>
  ),
}));
vi.mock("@/components/GuideBrowser", () => ({
  default: () => <section aria-label="guide-browser" />,
}));

beforeEach(() => {
  const values = new Map<string, string>();
  Object.defineProperty(window, "localStorage", {
    configurable: true,
    value: {
      get length() {
        return values.size;
      },
      clear: () => values.clear(),
      getItem: (key: string) => values.get(key) ?? null,
      key: (index: number) => [...values.keys()][index] ?? null,
      removeItem: (key: string) => values.delete(key),
      setItem: (key: string, value: string) => values.set(key, value),
    } satisfies Storage,
  });
});

afterEach(cleanup);

describe("HelpPage", () => {
  it("presents the searchable guide in natural English", () => {
    render(
      <LocaleProvider initialLocale="en" hasLocaleCookie>
        <HelpPage />
      </LocaleProvider>,
    );

    expect(screen.getByRole("heading", { name: "Help center" })).toBeInTheDocument();
    expect(screen.getByText("Find the chapter for your task, follow its steps, and verify the result before moving on.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Open getting started" })).toHaveAttribute("href", "/help?chapter=getting-started");
    expect(screen.queryByText(/setup doctor/i)).not.toBeInTheDocument();
  });

  it("uses fluent Arabic guidance without exposing implementation commands", () => {
    render(
      <LocaleProvider initialLocale="ar" hasLocaleCookie>
        <HelpPage />
      </LocaleProvider>,
    );

    expect(screen.getByRole("heading", { name: "مركز المساعدة" })).toBeInTheDocument();
    expect(screen.getByText("ابحث عن الفصل المناسب لمهمتك، واتبع خطواته، ثم تحقق من النتيجة قبل الانتقال إلى المهمة التالية.")).toBeInTheDocument();
    expect(screen.queryByText(/\/first-run|setup quick/i)).not.toBeInTheDocument();
  });
});
