export function getRoutingMode(settings = {}) {
  if (typeof window === "undefined") return "hash";
  const requested = settings?.ui?.routingMode || "hash";
  if (requested === "history" && window.location.protocol !== "file:" && typeof window.history?.pushState === "function") {
    return "history";
  }
  return "hash";
}

export function normalizeRoutePage(page) {
  return String(page || "dashboard").replace(/^\/+/, "").split("/")[0] || "dashboard";
}

export function buildAppRoute(page = "dashboard", options = {}, settings = {}) {
  const mode = getRoutingMode(settings);
  const routePage = normalizeRoutePage(page);
  const params = new URLSearchParams(options.params || "");
  const selectedItemId = options.selectedItemId || options.itemId || options.id || null;
  const section = options.section || params.get("section");
  let path = `/${routePage}`;
  if (routePage === "detail" && selectedItemId) {
    path = `/detail/${encodeURIComponent(selectedItemId)}`;
  }
  if (routePage === "help" && section) {
    if (mode === "history") {
      path = `/help/${encodeURIComponent(section)}`;
      params.delete("section");
    } else {
      params.set("section", section);
    }
  }
  const queryText = params.toString();
  if (mode === "history") {
    return `${path}${queryText ? `?${queryText}` : ""}`;
  }
  return `#${path}${queryText ? `?${queryText}` : ""}`;
}

export function parseAppRoute(locationObj) {
  if (typeof window === "undefined" && !locationObj) {
    return { page: "dashboard", selectedItemId: null, params: new URLSearchParams(), section: null, source: "hash" };
  }
  const loc = locationObj || window.location;
  const hash = loc.hash || "";
  let source = "hash";
  let rawRoute = "";
  if (hash.startsWith("#/") || hash.startsWith("#?")) {
    rawRoute = hash.replace(/^#\/?/, "");
  } else {
    source = "history";
    rawRoute = loc.protocol === "file:" ? "" : `${loc.pathname || ""}${loc.search || ""}`.replace(/^\/+/, "");
    rawRoute = rawRoute.replace(/^(index|video-archive)\.html\/?/i, "");
  }
  const [pathPart = "", queryPart = ""] = rawRoute.split("?");
  const segments = pathPart.split("/").map((segment) => segment.trim()).filter(Boolean);
  const params = new URLSearchParams(queryPart);
  let page = segments[0] || "dashboard";
  if (page.endsWith(".html")) page = "dashboard";
  let selectedItemId = null;
  if (page === "detail" && segments[1]) {
    try {
      selectedItemId = decodeURIComponent(segments[1]);
    } catch {
      selectedItemId = segments[1];
    }
  }
  if (page === "help" && segments[1] && !params.get("section")) {
    try {
      params.set("section", decodeURIComponent(segments[1]));
    } catch {
      params.set("section", segments[1]);
    }
  }
  return { page, selectedItemId, params, section: params.get("section"), source };
}

export function writeAppRoute(page, options = {}, settings = {}, replace = false) {
  if (typeof window === "undefined") return;
  const route = buildAppRoute(page, options, settings);
  const mode = getRoutingMode(settings);
  const current = mode === "history" ? `${window.location.pathname}${window.location.search}` : window.location.hash || "";
  if (current === route) return;
  const selectedItemId = options.selectedItemId || options.itemId || options.id || null;
  const state = { page: normalizeRoutePage(page), selectedItemId, section: options.section || null };
  const method = replace ? "replaceState" : "pushState";
  window.history[method](state, "", route);
}
