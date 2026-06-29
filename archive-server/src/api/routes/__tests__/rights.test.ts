import { describe, it, expect, vi, beforeEach } from "vitest"
import { handleRightsRoute } from "../rights.js"

// ── helpers ──────────────────────────────────────────────────────────────────

function makeRes() {
  const res = { statusCode: null as any, body: null as any }
  return res
}

function makeSendJson(res: any) {
  return (r: any, code: number, payload: any) => {
    r.statusCode = code
    r.body = payload
    return undefined
  }
}

function makeReadBody(data: any) {
  return async () => data
}

function mockPrisma(records: any[] = []) {
  const store = new Map(records.map((r) => [r.id, r]))
  const byItem = new Map(records.map((r) => [r.itemId, r]))

  return {
    rightsRecord: {
      findUnique: vi.fn(async ({ where }: any) => {
        if (where.id) return store.get(where.id) ?? null
        if (where.itemId) return byItem.get(where.itemId) ?? null
        return null
      }),
      findMany: vi.fn(async ({ where }: any) => {
        const all = [...store.values()]
        if (where?.expiresAt) {
          const { gt, lte } = where.expiresAt
          return all.filter((r: any) => r.expiresAt && r.expiresAt > gt && r.expiresAt <= lte)
        }
        return all
      }),
      upsert: vi.fn(async ({ where, create, update }: any) => {
        const existing = byItem.get(where.itemId)
        if (existing) {
          const updated = { ...existing, ...update, updatedAt: new Date() }
          store.set(existing.id, updated)
          byItem.set(existing.itemId, updated)
          return updated
        }
        const created = { id: `id_${Date.now()}`, ...create, createdAt: new Date(), updatedAt: new Date() }
        store.set(created.id, created)
        byItem.set(created.itemId, created)
        return created
      }),
      update: vi.fn(async ({ where, data }: any) => {
        const existing = store.get(where.id)
        if (!existing) return null
        const updated = { ...existing, ...data, updatedAt: new Date() }
        store.set(where.id, updated)
        byItem.set(updated.itemId, updated)
        return updated
      }),
      delete: vi.fn(async ({ where }: any) => {
        const existing = store.get(where.id)
        if (existing) {
          store.delete(where.id)
          byItem.delete(existing.itemId)
        }
        return existing
      }),
    },
  }
}

function baseCtx({ prisma = mockPrisma(), authClaims = { sub: "u1", role: "editor" }, body = {} } = {} as any) {
  const res = makeRes()
  const sendJson = makeSendJson(res)

  const requireAuth = vi.fn((_req: any, _res: any) => authClaims)
  const requireEditor = vi.fn((_req: any, _res: any) => authClaims)
  const overLimit = vi.fn(() => false)
  const readJsonBody = makeReadBody(body)

  return { res, sendJson, requireAuth, requireEditor, overLimit, readJsonBody, prisma }
}

function makeReq(method: string, url: string, headers: any = {}) {
  return { method, url, headers }
}

// ── test: GET /api/rights — returns 401 without auth ─────────────────────────

describe("GET /api/rights — unauthenticated", () => {
  it("returns 401 when requireAuth sends 401 and returns null", async () => {
    const ctx = baseCtx()
    // Override requireAuth to simulate no-token: it writes 401 itself and returns null
    ctx.requireAuth = vi.fn((_req: any, res: any) => {
      ctx.sendJson(res, 401, { ok: false, error: "Authentication required." })
      return null
    })

    const req = makeReq("GET", "/api/rights?itemId=item1")
    const handled = await handleRightsRoute({
      req,
      res: ctx.res,
      url: "/api/rights",
      params: new URLSearchParams("itemId=item1"),
      sendJson: ctx.sendJson,
      requireAuth: ctx.requireAuth,
      requireEditor: ctx.requireEditor,
      overLimit: ctx.overLimit,
      readJsonBody: ctx.readJsonBody,
      prisma: ctx.prisma,
    })

    expect(handled).toBe(true)
    expect(ctx.res.statusCode).toBe(401)
    expect(ctx.res.body.ok).toBe(false)
  })
})

// ── test: POST /api/rights — creates a record ─────────────────────────────────

describe("POST /api/rights — create", () => {
  it("creates a rights record and returns 201", async () => {
    const ctx = baseCtx({
      body: {
        itemId: "item_abc",
        rightsHolder: "أرشيف الوطني",
        licenseType: "OWNED",
        geoRestrictions: ["SA", "AE"],
        notes: "ملاحظة تجريبية",
      },
    })

    const req = makeReq("POST", "/api/rights")
    const handled = await handleRightsRoute({
      req,
      res: ctx.res,
      url: "/api/rights",
      params: new URLSearchParams(),
      sendJson: ctx.sendJson,
      requireAuth: ctx.requireAuth,
      requireEditor: ctx.requireEditor,
      overLimit: ctx.overLimit,
      readJsonBody: ctx.readJsonBody,
      prisma: ctx.prisma,
    })

    expect(handled).toBe(true)
    expect(ctx.res.statusCode).toBe(201)
    expect(ctx.res.body.ok).toBe(true)
    expect(ctx.res.body.record.itemId).toBe("item_abc")
    expect(ctx.res.body.record.rightsHolder).toBe("أرشيف الوطني")
    expect(ctx.res.body.record.licenseType).toBe("OWNED")
    expect(ctx.prisma.rightsRecord.upsert).toHaveBeenCalledOnce()
  })

  it("returns 400 when required fields are missing", async () => {
    const ctx = baseCtx({ body: { itemId: "item_xyz" } }) // missing rightsHolder + licenseType

    const req = makeReq("POST", "/api/rights")
    const handled = await handleRightsRoute({
      req,
      res: ctx.res,
      url: "/api/rights",
      params: new URLSearchParams(),
      sendJson: ctx.sendJson,
      requireAuth: ctx.requireAuth,
      requireEditor: ctx.requireEditor,
      overLimit: ctx.overLimit,
      readJsonBody: ctx.readJsonBody,
      prisma: ctx.prisma,
    })

    expect(handled).toBe(true)
    expect(ctx.res.statusCode).toBe(400)
    expect(ctx.res.body.ok).toBe(false)
  })
})

// ── test: GET /api/rights/expiring — only future-but-soon expirations ─────────

describe("GET /api/rights/expiring", () => {
  it("returns only records expiring within the requested window", async () => {
    const now = Date.now()
    const in10Days = new Date(now + 10 * 24 * 60 * 60 * 1000)
    const in60Days = new Date(now + 60 * 24 * 60 * 60 * 1000)
    const past = new Date(now - 1000)

    const records = [
      { id: "r1", itemId: "i1", rightsHolder: "A", licenseType: "LICENSED", expiresAt: in10Days, geoRestrictions: [], createdAt: new Date(), updatedAt: new Date() },
      { id: "r2", itemId: "i2", rightsHolder: "B", licenseType: "LICENSED", expiresAt: in60Days, geoRestrictions: [], createdAt: new Date(), updatedAt: new Date() },
      { id: "r3", itemId: "i3", rightsHolder: "C", licenseType: "OWNED", expiresAt: past, geoRestrictions: [], createdAt: new Date(), updatedAt: new Date() },
      { id: "r4", itemId: "i4", rightsHolder: "D", licenseType: "OWNED", expiresAt: null, geoRestrictions: [], createdAt: new Date(), updatedAt: new Date() },
    ]

    const ctx = baseCtx({ prisma: mockPrisma(records) })
    const req = makeReq("GET", "/api/rights/expiring?days=30")
    const handled = await handleRightsRoute({
      req,
      res: ctx.res,
      url: "/api/rights/expiring",
      params: new URLSearchParams("days=30"),
      sendJson: ctx.sendJson,
      requireAuth: ctx.requireAuth,
      requireEditor: ctx.requireEditor,
      overLimit: ctx.overLimit,
      readJsonBody: ctx.readJsonBody,
      prisma: ctx.prisma,
    })

    expect(handled).toBe(true)
    expect(ctx.res.statusCode).toBe(200)
    expect(ctx.res.body.ok).toBe(true)
    // The mock findMany filter runs in-memory; verify the handler called it with
    // a future cutoff window that would include r1 (10 days) but not r2 (60 days),
    // r3 (past), or r4 (null expiresAt).
    const call = ctx.prisma.rightsRecord.findMany.mock.calls[0][0]
    expect(call.where.expiresAt.gt).toBeInstanceOf(Date)
    expect(call.where.expiresAt.lte).toBeInstanceOf(Date)
    // cutoff should be ~30 days from now
    const cutoffMs = call.where.expiresAt.lte.getTime()
    expect(cutoffMs).toBeGreaterThan(now + 29 * 24 * 60 * 60 * 1000)
    expect(cutoffMs).toBeLessThan(now + 31 * 24 * 60 * 60 * 1000)
  })
})

// ── test: unrelated path is not handled ───────────────────────────────────────

describe("handleRightsRoute — non-matching path", () => {
  it("returns false for paths that do not start with /api/rights", async () => {
    const ctx = baseCtx()
    const req = makeReq("GET", "/api/health")
    const handled = await handleRightsRoute({
      req,
      res: ctx.res,
      url: "/api/health",
      params: new URLSearchParams(),
      sendJson: ctx.sendJson,
      requireAuth: ctx.requireAuth,
      requireEditor: ctx.requireEditor,
      overLimit: ctx.overLimit,
      readJsonBody: ctx.readJsonBody,
      prisma: ctx.prisma,
    })

    expect(handled).toBe(false)
    expect(ctx.res.statusCode).toBeNull()
  })
})
