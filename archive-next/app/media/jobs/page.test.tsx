// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, test, vi } from "vitest";
import { LocaleProvider } from "@/lib/i18n/LocaleProvider";
import MediaJobsPage from "./page";

vi.mock("@/components/AppShell", () => ({
  default: ({ children }: { children: ReactNode }) => <main>{children}</main>
}));

vi.mock("./MediaJobLookup", () => ({ MediaJobLookup: () => <div>Lookup tool</div> }));
vi.mock("./MediaJobsList", () => ({ MediaJobsList: () => <div>Jobs workspace</div> }));
vi.mock("./MediaToolchainStatus", () => ({ MediaToolchainStatus: () => <div>Toolchain status</div> }));

describe("media jobs operational shell", () => {
  afterEach(() => cleanup());

  test("uses the operational page shell while keeping queue and studio routes available", () => {
    render(
      <LocaleProvider initialLocale="en" hasLocaleCookie>
        <MediaJobsPage />
      </LocaleProvider>
    );

    expect(screen.getByRole("region", { name: "Media jobs" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Media studio" })).toHaveAttribute("href", "/media/studio");
    expect(screen.getByText("Jobs workspace")).toBeVisible();
    expect(screen.getByText("Toolchain status")).toBeVisible();
  });
});
