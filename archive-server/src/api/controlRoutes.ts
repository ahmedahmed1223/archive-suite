import type { IncomingMessage, ServerResponse } from "node:http";

const CONTROL_ACTIONS = new Set(["start", "stop", "restart", "apply-config"]);

interface Agent {
  status(): Promise<Record<string, unknown>>;
  logs(opts: { service?: string; limit?: number | undefined }): Promise<unknown>;
  runAction?(action: string, opts: { service?: string }): Promise<{ statusCode?: number; ok?: boolean; [key: string]: unknown }>;
  unsupportedAction?(action: string): Promise<{ statusCode?: number; ok?: boolean; [key: string]: unknown }>;
}

interface ControlRouteOptions {
  req: IncomingMessage;
  res: ServerResponse;
  url: string;
  requestUrl: URL;
  authorizeAdmin: (req: IncomingMessage, res: ServerResponse) => boolean;
  sendJson: (res: ServerResponse, status: number, data: unknown) => void;
  agent: Agent;
  overLimit?: (res: ServerResponse, type: string, req: IncomingMessage) => boolean;
  readJsonBody?: (req: IncomingMessage) => Promise<Record<string, unknown>>;
}

export async function handleControlRoute({
  req,
  res,
  url,
  requestUrl,
  authorizeAdmin,
  sendJson,
  agent,
  overLimit,
  readJsonBody = async () => ({})
}: ControlRouteOptions): Promise<boolean> {
  if (!url.startsWith("/api/control/")) return false;

  if (!authorizeAdmin(req, res)) return true;

  if (req.method === "GET" && url === "/api/control/status") {
    const result = await agent.status();
    sendJson(res, 200, { ok: true, result });
    return true;
  }

  if (req.method === "GET" && url === "/api/control/logs") {
    const limitParam = requestUrl.searchParams.get("limit");
    const result = await agent.logs({
      service: requestUrl.searchParams.get("service") || "archive-api",
      limit: limitParam === null ? undefined : Number(limitParam)
    });
    sendJson(res, 200, { ok: true, result });
    return true;
  }

  const action = url.slice("/api/control/".length);
  if (req.method === "POST" && CONTROL_ACTIONS.has(action)) {
    if (overLimit?.(res, "rpc", req)) return true;
    const body = await readJsonBody(req);
    const service = String(body?.service || requestUrl.searchParams.get("service") || "archive-api");
    const canRunAction = typeof agent.runAction === "function";
    const result = canRunAction
      ? await agent.runAction!(action, { service })
      : await agent.unsupportedAction!(action);
    sendJson(res, result.statusCode || (!canRunAction ? 501 : result.ok ? 200 : 500), result);
    return true;
  }

  sendJson(res, 404, { ok: false, error: "Not found" });
  return true;
}
