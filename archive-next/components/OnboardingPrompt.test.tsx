// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";

import OnboardingPrompt from "./OnboardingPrompt";
import { LocaleProvider } from "@/lib/i18n/LocaleProvider";

vi.mock("next/navigation", () => ({ usePathname: () => "/help" }));

afterEach(() => {
  window.localStorage.clear();
  document.body.innerHTML = "";
});

describe("OnboardingPrompt", () => {
  test("presents the first-run reminder in English when English is selected", async () => {
    render(
      <LocaleProvider initialLocale="en" hasLocaleCookie>
        <OnboardingPrompt />
      </LocaleProvider>,
    );

    expect(await screen.findByText("Is this your first time here?")).toBeVisible();
    expect(screen.getByRole("link", { name: "Open the guide" })).toHaveAttribute("href", "/first-run");
    expect(screen.getByRole("button", { name: "Dismiss reminder" })).toBeVisible();
  });
});
