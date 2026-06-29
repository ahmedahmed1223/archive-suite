/**
 * messages.ts — MOS 3.x protocol message builders.
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

// ── Type definitions ──────────────────────────────────────────────────────────

interface EnvelopeParams {
  mosID: string;
  ncsID: string;
  messageID: number;
  payload?: string[];
}

interface MosItem {
  itemID: string;
  objID: string;
  objSlug: string;
  objDur?: number;
}

interface MosObject {
  objID: string;
  objSlug: string;
  objDur?: number;
  mosAbstract?: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Build the standard MOS envelope around a payload block.
 */
function buildEnvelope({ mosID, ncsID, messageID, payload = [] }: EnvelopeParams): string {
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
 */
export function roReq(params: EnvelopeParams & { roID: string; [key: string]: unknown }): string {
  const { mosID, ncsID, messageID, roID } = params as any;
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
 */
export function roCreate(params: EnvelopeParams & {
  roID: string;
  roSlug: string;
  roEdStart?: string;
  [key: string]: unknown;
}): string {
  const { mosID, ncsID, messageID, roID, roSlug, roEdStart = "" } = params;
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
 */
export function roStorySend(params: EnvelopeParams & {
  roID: string;
  storyID: string;
  storySlug: string;
  items?: MosItem[] | Array<Record<string, unknown>>;
  [key: string]: unknown;
}): string {
  const { mosID, ncsID, messageID, roID, storyID, storySlug, items = [] } = params as any;
  const itemLines = items.flatMap((item: any) => [
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
 */
export function roElementAction(params: EnvelopeParams & {
  roID: string;
  operation: "INSERT" | "REPLACE" | "DELETE";
  storyID: string;
  itemID?: string;
  [key: string]: unknown;
}): string {
  const { mosID, ncsID, messageID, roID, operation, storyID, itemID = "" } = params as any;
  const VALID_OPS = new Set<string>(["INSERT", "REPLACE", "DELETE"]);
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
 */
export function objList(params: EnvelopeParams & {
  objListID?: string;
  objects?: MosObject[] | Array<Record<string, unknown>>;
  [key: string]: unknown;
}): string {
  const { mosID, ncsID, messageID, objListID = "", objects = [] } = params as any;
  const objLines = objects.flatMap((obj: any) => [
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
 */
export function objCreate(params: EnvelopeParams & {
  objID: string;
  objSlug: string;
  objDur?: number;
  mosAbstract?: string;
  mosExternalMetadata?: string;
  [key: string]: unknown;
}): string {
  const { mosID, ncsID, messageID, objID, objSlug, objDur, mosAbstract = "", mosExternalMetadata = "" } = params as any;
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
