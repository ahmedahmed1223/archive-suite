// Rights & License REST API (§22 — نظام إدارة الحقوق الكامل)
//
// Routes (all require Bearer auth; editor+ for writes):
//   GET    /api/rights?itemId=<uid>      — fetch the rights record for an item
//   POST   /api/rights                   — create/upsert a rights record
//   PUT    /api/rights/:id               — update a rights record by its own id
//   DELETE /api/rights/:id               — delete a rights record
//   GET    /api/rights/expiring?days=30  — list records expiring within N days

const VALID_LICENSE_TYPES = new Set(["OWNED", "LICENSED", "PUBLIC_DOMAIN", "FAIR_USE", "UNKNOWN"])

function bad(message, statusCode = 400) {
  const err = new Error(message)
  err.statusCode = statusCode
  return err
}

function parseOptionalDate(value, fieldName) {
  if (value === undefined || value === null || value === "") return undefined
  const d = new Date(value)
  if (isNaN(d.getTime())) throw bad(`${fieldName} must be a valid ISO date string.`)
  return d
}

function parseGeoRestrictions(value) {
  if (value === undefined || value === null) return []
  if (!Array.isArray(value)) throw bad("geoRestrictions must be an array of ISO country codes.")
  for (const code of value) {
    if (typeof code !== "string" || !/^[A-Z]{2}$/.test(code)) {
      throw bad(`Invalid country code: ${JSON.stringify(code)}. Must be ISO 3166-1 alpha-2 (e.g. "SA", "AE").`)
    }
  }
  return value
}

function validateRightsBody(body) {
  if (!body || typeof body !== "object") throw bad("Request body must be a JSON object.")
  const {
    itemId,
    rightsHolder,
    licenseType,
    embargoStart,
    embargoEnd,
    expiresAt,
    geoRestrictions,
    notes,
  } = body

  if (itemId !== undefined && (typeof itemId !== "string" || !itemId.trim())) {
    throw bad("itemId must be a non-empty string.")
  }
  if (rightsHolder !== undefined && (typeof rightsHolder !== "string" || !rightsHolder.trim())) {
    throw bad("rightsHolder must be a non-empty string.")
  }
  if (licenseType !== undefined && !VALID_LICENSE_TYPES.has(licenseType)) {
    throw bad(`licenseType must be one of: ${[...VALID_LICENSE_TYPES].join(", ")}.`)
  }
  if (notes !== undefined && notes !== null && typeof notes !== "string") {
    throw bad("notes must be a string.")
  }

  return {
    itemId: itemId ? String(itemId).trim() : undefined,
    rightsHolder: rightsHolder ? String(rightsHolder).trim() : undefined,
    licenseType,
    embargoStart: parseOptionalDate(embargoStart, "embargoStart"),
    embargoEnd: parseOptionalDate(embargoEnd, "embargoEnd"),
    expiresAt: parseOptionalDate(expiresAt, "expiresAt"),
    geoRestrictions: geoRestrictions !== undefined ? parseGeoRestrictions(geoRestrictions) : undefined,
    notes: notes !== undefined ? (notes === null ? null : String(notes).slice(0, 4000)) : undefined,
  }
}

function formatRecord(r) {
  return {
    id: r.id,
    itemId: r.itemId,
    rightsHolder: r.rightsHolder,
    licenseType: r.licenseType,
    embargoStart: r.embargoStart ?? null,
    embargoEnd: r.embargoEnd ?? null,
    expiresAt: r.expiresAt ?? null,
    geoRestrictions: r.geoRestrictions ?? [],
    notes: r.notes ?? null,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
  }
}

function reply(sendJson, res, code, payload) {
  sendJson(res, code, payload)
  return true
}

/**
 * Handle /api/rights/* routes.
 *
 * @param {object} ctx
 * @param {object} ctx.req
 * @param {object} ctx.res
 * @param {string} ctx.url           — normalised pathname (e.g. "/api/rights")
 * @param {URLSearchParams} ctx.params
 * @param {(res, code, payload) => void} ctx.sendJson
 * @param {() => object|null} ctx.requireAuth   — returns claims or null (already sends 401)
 * @param {() => object|null} ctx.requireEditor — returns claims or null (already sends 401)
 * @param {(res, bucket, req) => boolean} ctx.overLimit
 * @param {() => Promise<object>} ctx.readJsonBody
 * @param {object|null} ctx.prisma
 * @returns {Promise<boolean>} true if the route was handled, false otherwise
 */
export async function handleRightsRoute({
  req,
  res,
  url,
  params,
  sendJson,
  requireAuth,
  requireEditor,
  overLimit,
  readJsonBody,
  prisma,
}) {
  if (!url.startsWith("/api/rights")) return false

  const send = (code, payload) => reply(sendJson, res, code, payload)

  // All rights endpoints require at least a valid session.
  // requireAuth/requireEditor already call sendJson(401) when they return null.

  // ── GET /api/rights/expiring?days=N ──────────────────────────────────────
  if (req.method === "GET" && url.split("?")[0] === "/api/rights/expiring") {
    const claims = requireAuth(req, res)
    if (!claims) return true
    if (!prisma) return send(501, { ok: false, error: "Rights management requires the Postgres backend." })
    const days = Math.max(1, Math.min(365, Number(params.get("days") || 30)))
    const cutoff = new Date(Date.now() + days * 24 * 60 * 60 * 1000)
    try {
      const records = await prisma.rightsRecord.findMany({
        where: { expiresAt: { gt: new Date(), lte: cutoff } },
        orderBy: { expiresAt: "asc" },
      })
      return send(200, { ok: true, records: records.map(formatRecord) })
    } catch (err) {
      return send(500, { ok: false, error: err?.message || "Failed to query expiring rights." })
    }
  }

  // ── GET /api/rights?itemId=X ─────────────────────────────────────────────
  if (req.method === "GET" && url.split("?")[0] === "/api/rights") {
    const claims = requireAuth(req, res)
    if (!claims) return true
    if (!prisma) return send(501, { ok: false, error: "Rights management requires the Postgres backend." })
    const itemId = String(params.get("itemId") || "").trim()
    if (!itemId) return send(400, { ok: false, error: "itemId query parameter is required." })
    try {
      const record = await prisma.rightsRecord.findUnique({ where: { itemId } })
      if (!record) return send(404, { ok: false, error: "No rights record found for this item." })
      return send(200, { ok: true, record: formatRecord(record) })
    } catch (err) {
      return send(500, { ok: false, error: err?.message || "Failed to fetch rights record." })
    }
  }

  // ── POST /api/rights ──────────────────────────────────────────────────────
  if (req.method === "POST" && url.split("?")[0] === "/api/rights") {
    if (overLimit(res, "rpc", req)) return true
    const claims = requireEditor(req, res)
    if (!claims) return true
    if (!prisma) return send(501, { ok: false, error: "Rights management requires the Postgres backend." })
    try {
      const body = await readJsonBody(req)
      const fields = validateRightsBody(body)
      const { itemId, rightsHolder, licenseType } = fields
      if (!itemId) throw bad("itemId is required.")
      if (!rightsHolder) throw bad("rightsHolder is required.")
      if (!licenseType) throw bad("licenseType is required.")

      const data = {
        rightsHolder: fields.rightsHolder,
        licenseType: fields.licenseType,
        embargoStart: fields.embargoStart ?? null,
        embargoEnd: fields.embargoEnd ?? null,
        expiresAt: fields.expiresAt ?? null,
        geoRestrictions: fields.geoRestrictions ?? [],
        notes: fields.notes ?? null,
      }

      const record = await prisma.rightsRecord.upsert({
        where: { itemId },
        create: { itemId, ...data },
        update: data,
      })
      return send(201, { ok: true, record: formatRecord(record) })
    } catch (err) {
      return send(err?.statusCode || 500, { ok: false, error: err?.message || "Failed to create rights record." })
    }
  }

  // ── PUT /api/rights/:id ───────────────────────────────────────────────────
  const putMatch = /^\/api\/rights\/([^/]+)$/.exec(url.split("?")[0])
  if (req.method === "PUT" && putMatch) {
    if (overLimit(res, "rpc", req)) return true
    const claims = requireEditor(req, res)
    if (!claims) return true
    if (!prisma) return send(501, { ok: false, error: "Rights management requires the Postgres backend." })
    const id = decodeURIComponent(putMatch[1])
    try {
      const body = await readJsonBody(req)
      const fields = validateRightsBody(body)

      const updateData = {}
      if (fields.rightsHolder !== undefined) updateData.rightsHolder = fields.rightsHolder
      if (fields.licenseType !== undefined) updateData.licenseType = fields.licenseType
      if (fields.embargoStart !== undefined) updateData.embargoStart = fields.embargoStart
      if (fields.embargoEnd !== undefined) updateData.embargoEnd = fields.embargoEnd
      if (fields.expiresAt !== undefined) updateData.expiresAt = fields.expiresAt
      if (fields.geoRestrictions !== undefined) updateData.geoRestrictions = fields.geoRestrictions
      if (fields.notes !== undefined) updateData.notes = fields.notes

      if (Object.keys(updateData).length === 0) {
        return send(400, { ok: false, error: "No valid fields to update." })
      }

      const existing = await prisma.rightsRecord.findUnique({ where: { id } })
      if (!existing) return send(404, { ok: false, error: "Rights record not found." })

      const record = await prisma.rightsRecord.update({ where: { id }, data: updateData })
      return send(200, { ok: true, record: formatRecord(record) })
    } catch (err) {
      return send(err?.statusCode || 500, { ok: false, error: err?.message || "Failed to update rights record." })
    }
  }

  // ── DELETE /api/rights/:id ────────────────────────────────────────────────
  const deleteMatch = /^\/api\/rights\/([^/]+)$/.exec(url.split("?")[0])
  if (req.method === "DELETE" && deleteMatch) {
    const claims = requireEditor(req, res)
    if (!claims) return true
    if (!prisma) return send(501, { ok: false, error: "Rights management requires the Postgres backend." })
    const id = decodeURIComponent(deleteMatch[1])
    try {
      const existing = await prisma.rightsRecord.findUnique({ where: { id } })
      if (!existing) return send(404, { ok: false, error: "Rights record not found." })
      await prisma.rightsRecord.delete({ where: { id } })
      return send(200, { ok: true })
    } catch (err) {
      return send(err?.statusCode || 500, { ok: false, error: err?.message || "Failed to delete rights record." })
    }
  }

  return false
}
