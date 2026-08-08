// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import GuideBrowser from "@/components/GuideBrowser";
import type { GuideChapter } from "@/lib/in-app-guide";
import { LocaleProvider } from "@/lib/i18n/LocaleProvider";
import type { AppLocale } from "@/lib/i18n/types";

const mockUseAuthSession = vi.fn();
const mockUseSearchParams = vi.fn();

vi.mock("@/lib/auth-session", () => ({
  useAuthSession: () => mockUseAuthSession(),
}));

vi.mock("next/navigation", () => ({
  useSearchParams: () => mockUseSearchParams(),
}));

const chapters: GuideChapter[] = [
  {
    id: "viewer-search",
    title: "البحث في السجلات",
    audience: ["viewer", "editor", "admin"],
    body: "استخدم البحث للوصول إلى السجلات.",
    href: "/search",
  },
  {
    id: "editor-upload",
    title: "رفع الملفات",
    audience: ["editor", "admin"],
    body: "ارفع الملفات من صفحة التحميل.",
    href: "/uploads",
  },
  {
    id: "admin-users",
    title: "إدارة المستخدمين",
    audience: ["admin"],
    body: "أدر صلاحيات المستخدمين من الإعدادات.",
    href: "/settings/users",
  },
];

function setRole(role: "admin" | "editor" | "viewer") {
  mockUseAuthSession.mockReturnValue({ status: "guest", user: { role } });
}

function setChapter(chapter: string | null) {
  mockUseSearchParams.mockReturnValue(new URLSearchParams(chapter ? { chapter } : undefined));
}

function renderGuide(chaptersToRender: GuideChapter[], locale: AppLocale = "ar") {
  return render(
    <LocaleProvider initialLocale={locale} hasLocaleCookie>
      <GuideBrowser chapters={chaptersToRender} />
    </LocaleProvider>,
  );
}

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

afterEach(() => {
  cleanup();
  mockUseAuthSession.mockReset();
  mockUseSearchParams.mockReset();
});

describe("GuideBrowser", () => {
  test("filters the local guide by search query without showing chapters outside the viewer role", () => {
    setRole("viewer");
    setChapter(null);
    renderGuide(chapters);

    expect(screen.getByRole("link", { name: "البحث في السجلات" })).toBeTruthy();
    expect(screen.queryByText("رفع الملفات")).toBeNull();
    expect(screen.queryByText("إدارة المستخدمين")).toBeNull();

    fireEvent.change(screen.getByLabelText("ابحث في الدليل"), { target: { value: "صلاحيات" } });

    expect(screen.getByText("لا توجد نتيجة مطابقة في الدليل المتاح لدورك.")).toBeTruthy();
    expect(screen.getByRole("status")).toHaveTextContent("لا توجد نتائج مطابقة في الدليل.");
    expect(screen.queryByText("إدارة المستخدمين")).toBeNull();
  });

  test("uses the requested allowed chapter and preserves its destination link", () => {
    setRole("editor");
    setChapter("editor-upload");
    renderGuide(chapters);

    expect(screen.getByRole("link", { name: "رفع الملفات" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "افتح الصفحة المرتبطة" })).toHaveAttribute("href", "/uploads");
    expect(screen.queryByText("إدارة المستخدمين")).toBeNull();
  });

  test("renders Markdown instruction lists with semantic list elements", () => {
    setRole("viewer");
    setChapter("viewer-search");
    renderGuide([{
      ...chapters[0],
      body: "<h2>خطوات</h2><ol><li>افتح البحث</li><li>راجع النتائج</li></ol><ul><li>صفِّ النتائج</li><li>احفظ البحث</li></ul>",
    }]);

    expect(screen.getByRole("heading", { name: "خطوات", level: 3 })).toBeInTheDocument();
    const selectedArticle = screen.getByRole("heading", { name: "البحث في السجلات", level: 2 }).closest("article");
    expect(selectedArticle).not.toBeNull();
    const instructionLists = within(selectedArticle!).getAllByRole("list");
    expect(instructionLists[0]).toHaveTextContent("افتح البحث");
    expect(instructionLists.flatMap((list) => Array.from(list.querySelectorAll("li")))).toHaveLength(4);
  });

  test("loads the requested authorized chapter from the secured guide endpoint", async () => {
    mockUseAuthSession.mockReturnValue({ status: "authenticated", user: { role: "editor" }, accessToken: "editor-token" });
    setChapter("editor-upload");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({
      ok: true,
      chapters: [chapters[0], chapters[1]],
    }))));

    renderGuide([]);

    expect(await screen.findByRole("heading", { name: "رفع الملفات" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "افتح الصفحة المرتبطة" })).toHaveAttribute("href", "/uploads");
    expect(fetch).toHaveBeenCalledWith("/api/guide?locale=ar", expect.objectContaining({
      cache: "no-store",
      headers: { Authorization: "Bearer editor-token" },
    }));
  });

  test("renders guide controls and empty results in natural English", () => {
    setRole("viewer");
    setChapter(null);
    renderGuide([{
      id: "viewer-search",
      title: "Search records",
      audience: ["viewer", "editor", "admin"],
      body: "Use filters to narrow the results.",
      href: "/search",
    }], "en");

    expect(screen.getByRole("heading", { name: "Viewer guide" })).toBeInTheDocument();
    fireEvent.change(screen.getByRole("searchbox", { name: "Search the guide" }), { target: { value: "permissions" } });
    expect(screen.getByText("No matching result is available in your guide.")).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("No matching results in the guide.");
  });
});
