import { NextResponse } from "next/server";
import { getGuideChapters } from "@/lib/guide-content";
import type { GuideRole } from "@/lib/in-app-guide";
import { isAppLocale, type AppLocale } from "@/lib/i18n/types";

export const dynamic = "force-dynamic";

const guideRoles: readonly GuideRole[] = ["viewer", "editor", "admin"];

function errorResponse(status: number, locale: AppLocale = "ar") {
  return NextResponse.json(
    {
      ok: false,
      error: locale === "ar"
        ? "تعذر التحقق من صلاحية الدليل. سجّل الدخول مرة أخرى."
        : "Your guide access could not be verified. Sign in again.",
    },
    { status, headers: { "Cache-Control": "no-store" } },
  );
}

function isGuideRole(value: unknown): value is GuideRole {
  return typeof value === "string" && guideRoles.includes(value as GuideRole);
}

export async function GET(request: Request) {
  const requestedLocale = new URL(request.url).searchParams.get("locale");
  const fallbackLocale: AppLocale = isAppLocale(requestedLocale) ? requestedLocale : "ar";
  const baseUrl = process.env.ARCHIVE_API_BASE_URL?.replace(/\/$/, "");
  const authorization = request.headers.get("authorization");
  const cookie = request.headers.get("cookie");

  if (!baseUrl || (!authorization && !cookie)) {
    return errorResponse(401, fallbackLocale);
  }

  const headers: Record<string, string> = { Accept: "application/json" };
  if (authorization) headers.Authorization = authorization;
  if (cookie) headers.Cookie = cookie;

  try {
    const response = await fetch(`${baseUrl}/auth/me`, { method: "GET", headers, cache: "no-store" });
    const payload = await response.json().catch(() => null) as {
      ok?: boolean;
      user?: { role?: unknown; locale?: unknown };
    } | null;

    if (!response.ok || payload?.ok !== true || !isGuideRole(payload.user?.role)) {
      return errorResponse(401, fallbackLocale);
    }

    const locale = isAppLocale(payload.user?.locale) ? payload.user.locale : fallbackLocale;

    return NextResponse.json(
      { ok: true, locale, chapters: getGuideChapters(payload.user.role, locale) },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return errorResponse(401, fallbackLocale);
  }
}
