import { NextResponse } from "next/server";
import { getCopilotStatus } from "@/lib/copilot-status";

export const dynamic = "force-dynamic";

/**
 * Public-by-design readiness signal. It intentionally excludes provider
 * identity, endpoints, credentials, and any archive content.
 */
export function GET() {
  return NextResponse.json(getCopilotStatus(process.env), {
    headers: { "Cache-Control": "no-store" }
  });
}
