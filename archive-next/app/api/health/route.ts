import { NextResponse } from "next/server";

// V2-502: the Docker healthcheck just curled `/`, which returns 200 even
// when the Laravel upstream this app depends on for almost everything is
// unreachable -- a "healthy" container that can't actually serve data.
// Reuses the same deep check (DB/redis/storage) routes/api.php's
// /api/v1/health already exercises for the laravel-fpm container's own
// healthcheck, so both containers agree on what "healthy" means.
export const dynamic = "force-dynamic";

export async function GET() {
  const base = process.env.ARCHIVE_API_BASE_URL;

  if (!base) {
    return NextResponse.json(
      { ok: false, upstream: "unconfigured" },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }

  try {
    const upstreamUrl = `${base.replace(/\/$/, "")}/health`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000);
    const response = await fetch(upstreamUrl, { signal: controller.signal, cache: "no-store" });
    clearTimeout(timeout);

    if (!response.ok) {
      return NextResponse.json(
        { ok: false, upstream: "unhealthy", status: response.status },
        { status: 503, headers: { "Cache-Control": "no-store" } },
      );
    }

    return NextResponse.json({ ok: true, upstream: "healthy" }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json(
      { ok: false, upstream: "unreachable" },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
