// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";
import GuideBrowser from "@/components/GuideBrowser";
import type { GuideChapter } from "@/lib/in-app-guide";

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

afterEach(() => {
  cleanup();
  mockUseAuthSession.mockReset();
  mockUseSearchParams.mockReset();
});

describe("GuideBrowser", () => {
  test("filters the local guide by search query without showing chapters outside the viewer role", () => {
    setRole("viewer");
    setChapter(null);
    render(<GuideBrowser chapters={chapters} />);

    expect(screen.getByRole("link", { name: "البحث في السجلات" })).toBeTruthy();
    expect(screen.queryByText("رفع الملفات")).toBeNull();
    expect(screen.queryByText("إدارة المستخدمين")).toBeNull();

    fireEvent.change(screen.getByLabelText("ابحث في الدليل"), { target: { value: "صلاحيات" } });

    expect(screen.getByText("لا توجد نتيجة مطابقة في الدليل المتاح لدورك.")).toBeTruthy();
    expect(screen.getByRole("status")).toHaveTextContent("0 نتائج مطابقة في الدليل.");
    expect(screen.queryByText("إدارة المستخدمين")).toBeNull();
  });

  test("uses the requested allowed chapter and preserves its destination link", () => {
    setRole("editor");
    setChapter("editor-upload");
    render(<GuideBrowser chapters={chapters} />);

    expect(screen.getByRole("link", { name: "رفع الملفات" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "افتح الصفحة المرتبطة" })).toHaveAttribute("href", "/uploads");
    expect(screen.queryByText("إدارة المستخدمين")).toBeNull();
  });

  test("renders Markdown instruction lists with semantic list elements", () => {
    setRole("viewer");
    setChapter("viewer-search");
    render(<GuideBrowser chapters={[{
      ...chapters[0],
      body: "## خطوات\n1. افتح البحث\n2. راجع النتائج\n\n- صفِّ النتائج\n- احفظ البحث",
    }]} />);

    const instructionLists = screen.getAllByRole("list", { name: "خطوات" });
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

    render(<GuideBrowser chapters={[]} />);

    expect(await screen.findByRole("heading", { name: "رفع الملفات" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "افتح الصفحة المرتبطة" })).toHaveAttribute("href", "/uploads");
    expect(fetch).toHaveBeenCalledWith("/api/guide", expect.objectContaining({
      cache: "no-store",
      headers: { Authorization: "Bearer editor-token" },
    }));
  });
});
