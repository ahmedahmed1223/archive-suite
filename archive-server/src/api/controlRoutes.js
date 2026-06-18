const CONTROL_ACTIONS = new Set(["start", "stop", "restart", "apply-config"]);

export async function handleControlRoute({
  req,
  res,
  url,
  requestUrl,
  authorizeAdmin,
  sendJson,
  agent,
  overLimit
}) {
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
    const result = await agent.unsupportedAction(action);
    sendJson(res, 501, result);
    return true;
  }

  sendJson(res, 404, { ok: false, error: "Not found" });
  return true;
}
