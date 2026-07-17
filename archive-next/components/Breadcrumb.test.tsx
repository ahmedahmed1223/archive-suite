// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, test } from "vitest";
import Breadcrumb from "@/components/Breadcrumb";

afterEach(cleanup);

describe("Breadcrumb", () => {
  test("renders nothing when given no crumbs", () => {
    const { container } = render(<Breadcrumb items={[]} />);
    expect(container.querySelector(".breadcrumb")).toBeNull();
  });

  test("renders crumbs in order with separators between them", () => {
    render(
      <Breadcrumb
        items={[
          { label: "الرئيسية", href: "/" },
          { label: "الأرشيف", href: "/archive" },
          { label: "تسجيل الافتتاح" }
        ]}
      />
    );

    const items = screen.getAllByRole("listitem");
    expect(items.map((item) => item.textContent?.replace("/", "").trim())).toEqual([
      "الرئيسية",
      "الأرشيف",
      "تسجيل الافتتاح"
    ]);
    expect(screen.getAllByText("/")).toHaveLength(2);
  });

  test("renders every crumb except the last as a link", () => {
    render(
      <Breadcrumb
        items={[
          { label: "الرئيسية", href: "/" },
          { label: "الأرشيف", href: "/archive" },
          { label: "تسجيل الافتتاح" }
        ]}
      />
    );

    expect(screen.getByRole("link", { name: "الرئيسية" }).getAttribute("href")).toBe("/");
    expect(screen.getByRole("link", { name: "الأرشيف" }).getAttribute("href")).toBe("/archive");
    expect(screen.queryByRole("link", { name: "تسجيل الافتتاح" })).toBeNull();
  });

  test("marks the last crumb as the current page for assistive tech", () => {
    render(<Breadcrumb items={[{ label: "الرئيسية", href: "/" }, { label: "تسجيل الافتتاح" }]} />);

    expect(screen.getByText("تسجيل الافتتاح").getAttribute("aria-current")).toBe("page");
  });

  test("does not link the last crumb even if it has an href", () => {
    render(<Breadcrumb items={[{ label: "الرئيسية", href: "/" }, { label: "الحالي", href: "/current" }]} />);

    expect(screen.queryByRole("link", { name: "الحالي" })).toBeNull();
    expect(screen.getByText("الحالي").getAttribute("aria-current")).toBe("page");
  });
});
