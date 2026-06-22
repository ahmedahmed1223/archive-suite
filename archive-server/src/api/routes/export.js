/**
 * export.js — REST endpoints for per-item metadata export (§22.x).
 *
 * GET /api/items/:id/export/pbcore.xml     → application/xml
 * GET /api/items/:id/export/dublincore.rdf → application/rdf+xml
 *
 * Both routes require a valid Bearer JWT (same `requireAuth` pattern used
 * throughout server.js).  The item is fetched from any active StorageRow
 * store that contains it by scanning the common archive stores in order.
 */

import { toDublinCore } from "../../export/dublinCore.js";
import { toPBCore } from "../../export/pbcore.js";
import { escapeXml, serializeElement, serializeDocument } from "../../export/xmlSerializer.js";

// Stores searched in priority order when looking up an item by id.
const ITEM_STORES = [
  "video_items", "document_items", "audio_items", "image_items", "media_items",
  "videoItems", "documentItems", "audioItems", "imageItems", "mediaItems",
];

/**
 * Look up an item across the known archive stores.
 *
 * @param {object} storage - StorageProvider
 * @param {string} id
 * @returns {Promise<object|null>}
 */
async function findItem(storage, id) {
  for (const store of ITEM_STORES) {
    try {
      const item = await storage.get(store, id);
      if (item) return item;
    } catch {
      // store may not exist on this backend — try next
    }
  }
  return null;
}

/**
 * Render a Dublin Core record as RDF/XML.
 * Uses the dc: namespace per the DCMI specification.
 *
 * @param {object} dc - result of toDublinCore()
 * @param {string} itemId
 * @returns {string} RDF/XML document
 */
function renderDublinCoreRdf(dc, itemId) {
  const DC_ELEMENTS = [
    "title", "creator", "subject", "description", "publisher",
    "contributor", "date", "type", "format", "identifier",
    "source", "language", "relation", "coverage", "rights",
  ];

  const children = DC_ELEMENTS.map((el) =>
    serializeElement(`dc:${el}`, dc[el] ?? "", {}, 1)
  );

  return serializeDocument(
    "rdf:RDF",
    {
      "xmlns:rdf": "http://www.w3.org/1999/02/22-rdf-syntax-ns#",
      "xmlns:dc": "http://purl.org/dc/elements/1.1/",
    },
    [
      `  <rdf:Description rdf:about="urn:archive:item:${escapeXml(itemId)}">`,
      ...children.map((line) => "  " + line),
      "  </rdf:Description>",
    ]
  );
}

/**
 * Render a PBCore 2.1 record as XML.
 *
 * @param {object} pb - result of toPBCore()
 * @returns {string} PBCore XML document
 */
function renderPBCoreXml(pb) {
  const inst = pb.pbcoreInstantiation;

  // Top-level scalar elements
  const topLevel = [
    serializeElement("pbcoreAssetType", pb.pbcoreAssetType, {}, 1),
    serializeElement("pbcoreAssetDate", pb.pbcoreAssetDate, {}, 1),
    serializeElement("pbcoreIdentifier", pb.pbcoreIdentifier, { source: "local" }, 1),
    serializeElement("pbcoreTitle", pb.pbcoreTitle, { titleType: "Main" }, 1),
    ...(pb.pbcoreSubject.length
      ? pb.pbcoreSubject.map((s) => serializeElement("pbcoreSubject", s, {}, 1))
      : [serializeElement("pbcoreSubject", "", {}, 1)]),
    serializeElement("pbcoreDescription", pb.pbcoreDescription, { descriptionType: "Abstract" }, 1),
    serializeElement("pbcoreGenre", pb.pbcoreGenre, {}, 1),
    serializeElement("pbcoreRelation", pb.pbcoreRelation, {}, 1),
    serializeElement("pbcoreCoverage", pb.pbcoreCoverage, {}, 1),
    serializeElement("pbcoreAudienceLevel", pb.pbcoreAudienceLevel, {}, 1),
    serializeElement("pbcoreAudienceRating", pb.pbcoreAudienceRating, {}, 1),
    serializeElement("pbcoreCreator", pb.pbcoreCreator, {}, 1),
    serializeElement("pbcoreContributor", pb.pbcoreContributor, {}, 1),
    serializeElement("pbcorePublisher", pb.pbcorePublisher, {}, 1),
    serializeElement("pbcoreRightsSummary", pb.pbcoreRightsSummary, {}, 1),
  ];

  // Instantiation block
  const instChildren = Object.entries(inst)
    .map(([k, v]) => serializeElement(k, v ?? "", {}, 2));

  const instBlock = [
    "  <pbcoreInstantiation>",
    ...instChildren,
    "  </pbcoreInstantiation>",
  ].join("\n");

  return serializeDocument(
    "pbcoreDescriptionDocument",
    {
      "xmlns": "http://www.pbcore.org/PBCore/PBCoreNamespace.html",
      "xmlns:xsi": "http://www.w3.org/2001/XMLSchema-instance",
      "xsi:schemaLocation":
        "http://www.pbcore.org/PBCore/PBCoreNamespace.html " +
        "https://raw.githubusercontent.com/WGBH-MLA/PBCore_2.1/master/pbcore-2.1.xsd",
    },
    [...topLevel, instBlock]
  );
}

/**
 * Attach the /api/items/:id/export/* routes to the raw Node HTTP request
 * handling used by server.js.
 *
 * Called once from the main request handler with the normalised `url` string
 * and the already-bound helper functions.
 *
 * @param {object} params
 * @param {string} params.url - normalised URL path (no query string)
 * @param {object} params.req - Node IncomingMessage
 * @param {object} params.res - Node ServerResponse
 * @param {Function} params.requireAuth - () => boolean (sends 401 on failure)
 * @param {Function} params.resolveStorage - () => StorageProvider
 * @param {Function} params.send - (res, status, payload) => void
 * @returns {Promise<boolean>} true when the route matched and was handled
 */
export async function handleExportRoute({ url, req, res, requireAuth, resolveStorage, send }) {
  // Match /api/items/:id/export/pbcore.xml
  const pbcoreMatch = /^\/api\/items\/([^/]+)\/export\/pbcore\.xml$/.exec(url);
  if (pbcoreMatch && req.method === "GET") {
    if (!requireAuth(req, res)) return true;
    const id = decodeURIComponent(pbcoreMatch[1]);
    try {
      const storage = resolveStorage();
      const item = await findItem(storage, id);
      if (!item) {
        send(res, 404, { ok: false, error: "Item not found." });
        return true;
      }
      const pb = toPBCore(item);
      const xml = renderPBCoreXml(pb);
      const buf = Buffer.from(xml, "utf-8");
      res.writeHead(200, {
        "Content-Type": "application/xml; charset=UTF-8",
        "Content-Length": buf.length,
        "Content-Disposition": `attachment; filename="pbcore-${id}.xml"`,
      });
      res.end(buf);
    } catch (err) {
      send(res, err?.statusCode || 500, { ok: false, error: err?.message || "PBCore export failed." });
    }
    return true;
  }

  // Match /api/items/:id/export/dublincore.rdf
  const dcMatch = /^\/api\/items\/([^/]+)\/export\/dublincore\.rdf$/.exec(url);
  if (dcMatch && req.method === "GET") {
    if (!requireAuth(req, res)) return true;
    const id = decodeURIComponent(dcMatch[1]);
    try {
      const storage = resolveStorage();
      const item = await findItem(storage, id);
      if (!item) {
        send(res, 404, { ok: false, error: "Item not found." });
        return true;
      }
      const dc = toDublinCore(item);
      const xml = renderDublinCoreRdf(dc, id);
      const buf = Buffer.from(xml, "utf-8");
      res.writeHead(200, {
        "Content-Type": "application/rdf+xml; charset=UTF-8",
        "Content-Length": buf.length,
        "Content-Disposition": `attachment; filename="dublincore-${id}.rdf"`,
      });
      res.end(buf);
    } catch (err) {
      send(res, err?.statusCode || 500, { ok: false, error: err?.message || "Dublin Core export failed." });
    }
    return true;
  }

  return false;
}
