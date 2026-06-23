/**
 * messages.js — MOS 3.x protocol message builders.
 *
 * Each exported function produces a complete, well-formed MOS XML string
 * using the shared xmlSerializer from the export layer.  No sockets or
 * network I/O here — this is a pure data-construction module.
 *
 * Supported message types:
 *   roReq             — request a running order from NRCS
 *   roCreate          — create a new running order
 *   roStorySend       — send a story within a running order
 *   roElementAction   — act on a MOS element (INSERT / REPLACE / DELETE)
 *   objList           — list available MOS objects (query response)
 *   objCreate         — create a new MOS object in the NRCS
 *
 * MOS envelope structure (MOS 3.x):
 *   <mos>
 *     <mosID>…</mosID>
 *     <ncsID>…</ncsID>
 *     <messageID>…</messageID>
 *     <…payload…/>
 *   </mos>
 */

import { serializeElement, serializeDocument } from "../../export/xmlSerializer.js";

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Build the standard MOS envelope around a payload block.
 *
 * @param {object} params
 * @param {string} params.mosID      - MOS device identifier
 * @param {string} params.ncsID      - NCS (NRCS) identifier
 * @param {number} params.messageID  - sequential message counter
 * @param {string[]} params.payload  - pre-rendered inner XML lines (indent level 1)
 * @returns {string} complete MOS XML document
 */
function buildEnvelope({ mosID, ncsID, messageID, payload }) {
  const children = [
    serializeElement("mosID", mosID, {}, 1),
    serializeElement("ncsID", ncsID, {}, 1),
    serializeElement("messageID", messageID, {}, 1),
    ...payload,
  ];
  return serializeDocument("mos", {}, children);
}

// ── Message builders ──────────────────────────────────────────────────────────

/**
 * roReq — request the current running order from the NRCS.
 *
 * @param {object} params
 * @param {string} params.mosID
 * @param {string} params.ncsID
 * @param {number} params.messageID
 * @param {string} params.roID - ID of the running order to fetch
 * @returns {string} MOS XML
 */
export function roReq({ mosID, ncsID, messageID, roID }) {
  return buildEnvelope({
    mosID,
    ncsID,
    messageID,
    payload: [
      `  <roReq>`,
      serializeElement("roID", roID, {}, 2),
      `  </roReq>`,
    ],
  });
}

/**
 * roCreate — instruct NRCS to create a new running order.
 *
 * @param {object} params
 * @param {string} params.mosID
 * @param {string} params.ncsID
 * @param {number} params.messageID
 * @param {string} params.roID
 * @param {string} params.roSlug   - human-readable running order title
 * @param {string} [params.roEdStart] - editorial start time (ISO 8601)
 * @returns {string} MOS XML
 */
export function roCreate({ mosID, ncsID, messageID, roID, roSlug, roEdStart = "" }) {
  return buildEnvelope({
    mosID,
    ncsID,
    messageID,
    payload: [
      `  <roCreate>`,
      serializeElement("roID", roID, {}, 2),
      serializeElement("roSlug", roSlug, {}, 2),
      ...(roEdStart ? [serializeElement("roEdStart", roEdStart, {}, 2)] : []),
      `  </roCreate>`,
    ],
  });
}

/**
 * roStorySend — transmit a story (with items) as part of a running order.
 *
 * @param {object} params
 * @param {string} params.mosID
 * @param {string} params.ncsID
 * @param {number} params.messageID
 * @param {string} params.roID
 * @param {string} params.storyID
 * @param {string} params.storySlug
 * @param {Array<{itemID:string, objID:string, objSlug:string, objDur?:number}>} [params.items]
 * @returns {string} MOS XML
 */
export function roStorySend({ mosID, ncsID, messageID, roID, storyID, storySlug, items = [] }) {
  const itemLines = items.flatMap((item) => [
    `    <item>`,
    serializeElement("itemID", item.itemID, {}, 3),
    serializeElement("objID", item.objID, {}, 3),
    serializeElement("objSlug", item.objSlug, {}, 3),
    ...(item.objDur != null ? [serializeElement("objDur", item.objDur, {}, 3)] : []),
    `    </item>`,
  ]);

  return buildEnvelope({
    mosID,
    ncsID,
    messageID,
    payload: [
      `  <roStorySend>`,
      serializeElement("roID", roID, {}, 2),
      `    <story>`,
      serializeElement("storyID", storyID, {}, 3),
      serializeElement("storySlug", storySlug, {}, 3),
      ...itemLines,
      `    </story>`,
      `  </roStorySend>`,
    ],
  });
}

/**
 * roElementAction — request an action (INSERT / REPLACE / DELETE) on a MOS element.
 *
 * @param {object} params
 * @param {string} params.mosID
 * @param {string} params.ncsID
 * @param {number} params.messageID
 * @param {string} params.roID
 * @param {"INSERT"|"REPLACE"|"DELETE"} params.operation
 * @param {string} params.storyID
 * @param {string} [params.itemID]
 * @returns {string} MOS XML
 */
export function roElementAction({ mosID, ncsID, messageID, roID, operation, storyID, itemID = "" }) {
  const VALID_OPS = new Set(["INSERT", "REPLACE", "DELETE"]);
  const op = VALID_OPS.has(operation) ? operation : "INSERT";

  return buildEnvelope({
    mosID,
    ncsID,
    messageID,
    payload: [
      `  <roElementAction operation="${op}">`,
      serializeElement("roID", roID, {}, 2),
      serializeElement("storyID", storyID, {}, 2),
      ...(itemID ? [serializeElement("itemID", itemID, {}, 2)] : []),
      `  </roElementAction>`,
    ],
  });
}

/**
 * objList — return a list of MOS objects matching a search.
 *
 * @param {object} params
 * @param {string} params.mosID
 * @param {string} params.ncsID
 * @param {number} params.messageID
 * @param {string} [params.objListID]  - echoes back the search request ID
 * @param {Array<{objID:string, objSlug:string, objDur?:number, mosAbstract?:string}>} [params.objects]
 * @returns {string} MOS XML
 */
export function objList({ mosID, ncsID, messageID, objListID = "", objects = [] }) {
  const objLines = objects.flatMap((obj) => [
    `    <mosObj>`,
    serializeElement("objID", obj.objID, {}, 3),
    serializeElement("objSlug", obj.objSlug, {}, 3),
    ...(obj.objDur != null ? [serializeElement("objDur", obj.objDur, {}, 3)] : []),
    ...(obj.mosAbstract ? [serializeElement("mosAbstract", obj.mosAbstract, {}, 3)] : []),
    `    </mosObj>`,
  ]);

  return buildEnvelope({
    mosID,
    ncsID,
    messageID,
    payload: [
      `  <objList>`,
      ...(objListID ? [serializeElement("objListID", objListID, {}, 2)] : []),
      ...objLines,
      `  </objList>`,
    ],
  });
}

/**
 * objCreate — instruct NRCS to create a MOS object.
 *
 * @param {object} params
 * @param {string} params.mosID
 * @param {string} params.ncsID
 * @param {number} params.messageID
 * @param {string} params.objID
 * @param {string} params.objSlug
 * @param {number} [params.objDur]     - duration in seconds
 * @param {string} [params.mosAbstract]
 * @param {string} [params.mosExternalMetadata] - raw XML string for extension
 * @returns {string} MOS XML
 */
export function objCreate({ mosID, ncsID, messageID, objID, objSlug, objDur, mosAbstract = "", mosExternalMetadata = "" }) {
  return buildEnvelope({
    mosID,
    ncsID,
    messageID,
    payload: [
      `  <objCreate>`,
      serializeElement("objID", objID, {}, 2),
      serializeElement("objSlug", objSlug, {}, 2),
      ...(objDur != null ? [serializeElement("objDur", objDur, {}, 2)] : []),
      ...(mosAbstract ? [serializeElement("mosAbstract", mosAbstract, {}, 2)] : []),
      ...(mosExternalMetadata ? [`    <mosExternalMetadata>${mosExternalMetadata}</mosExternalMetadata>`] : []),
      `  </objCreate>`,
    ],
  });
}
