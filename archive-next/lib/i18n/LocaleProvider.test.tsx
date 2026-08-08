// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { LocaleProvider, useLocale } from "./LocaleProvider";

function LocaleProbe() {
  const { direction, locale, setLocale, t } = useLocale();

  return (
    <div>
      <output>{`${locale}:${direction}:${t.shared.feedback.loading}`}</output>
      <button type="button" onClick={() => setLocale(locale === "ar" ? "en" : "ar")}>
        switch
      </button>
    </div>
  );
}

describe("LocaleProvider", () => {
  afterEach(cleanup);

  beforeEach(() => {
    const values = new Map<string, string>();
    const storage: Storage = {
      get length() {
        return values.size;
      },
      clear: () => values.clear(),
      getItem: (key) => values.get(key) ?? null,
      key: (index) => [...values.keys()][index] ?? null,
      removeItem: (key) => values.delete(key),
      setItem: (key, value) => values.set(key, value),
    };
    Object.defineProperty(window, "localStorage", { configurable: true, value: storage });
    window.localStorage.clear();
    document.cookie = "archive_locale=; Max-Age=0; Path=/";
    document.documentElement.lang = "";
    document.documentElement.dir = "";
  });

  it("applies the server locale and switches document direction immediately", () => {
    render(
      <LocaleProvider initialLocale="ar" hasLocaleCookie>
        <LocaleProbe />
      </LocaleProvider>,
    );

    expect(screen.getByText("ar:rtl:جارٍ التحميل…")).toBeInTheDocument();
    expect(document.documentElement).toHaveAttribute("lang", "ar");
    expect(document.documentElement).toHaveAttribute("dir", "rtl");

    fireEvent.click(screen.getByRole("button", { name: "switch" }));

    expect(screen.getByText("en:ltr:Loading…")).toBeInTheDocument();
    expect(document.documentElement).toHaveAttribute("lang", "en");
    expect(document.documentElement).toHaveAttribute("dir", "ltr");
    expect(window.localStorage.getItem("archive.locale")).toBe("en");
    expect(document.cookie).toContain("archive_locale=en");
  });

  it("recovers a supported local locale only when the request had no locale cookie", () => {
    window.localStorage.setItem("archive.locale", "en");

    render(
      <LocaleProvider initialLocale="ar" hasLocaleCookie={false}>
        <LocaleProbe />
      </LocaleProvider>,
    );

    expect(screen.getByText("en:ltr:Loading…")).toBeInTheDocument();
  });

  it("ignores invalid local recovery values", () => {
    window.localStorage.setItem("archive.locale", "fr");

    render(
      <LocaleProvider initialLocale="ar" hasLocaleCookie={false}>
        <LocaleProbe />
      </LocaleProvider>,
    );

    expect(screen.getByText("ar:rtl:جارٍ التحميل…")).toBeInTheDocument();
  });
});
