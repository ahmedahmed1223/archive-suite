/**
 * session.ts — MOS session abstraction.
 *
 * createMosSession({ mosID, ncsID }) returns a session object that:
 *   - auto-increments messageID per call
 *   - wraps payloads via wrap(payloadXmlLines)
 *   - parses inbound MOS XML via unwrap(xmlString) — regex-based, no DOMParser
 *
 * The parser handles shallow MOS envelopes only (which is all MOS 3.x requires
 * for the message types we support).  Deep nested parsing is not needed here;
 * slice 2 (TCP socket wiring) can extend this if necessary.
 */

// ── Type definitions ──────────────────────────────────────────────────────────

interface EnvelopeMetadata {
  mosID: string;
  ncsID: string;
  messageID: number;
}

interface ParsedMosObject {
  objID: string | null;
  objSlug: string | null;
  objDur: string | null;
}

interface ParsedMessage {
  mosID: string | null;
  ncsID: string | null;
  messageID: string | number | null;
  type: string | null;
  roID: string | null;
  storyID: string | null;
  itemID: string | null;
  objID: string | null;
  objSlug: string | null;
  objDur: string | null;
  objects: ParsedMosObject[];
  raw: string;
  error?: string;
}

interface MosSession {
  mosID: string;
  ncsID: string;
  nextMessageID: () => number;
  wrap: () => EnvelopeMetadata;
  unwrap: (xml: string) => ParsedMessage;
}

// ── Tiny regex-based MOS XML parser (~40 lines) ──────────────────────────────

/**
 * Extract the text content of the first occurrence of a named element.
 * Handles self-closing tags (returns null) and regular text nodes.
 */
function extractText(xml: string, tagName: string): string | null {
  // Self-closing: <tagName/>
  const selfClose = new RegExp(`<${tagName}\\s*/>`, "i");
  if (selfClose.test(xml)) return null;

  // Text content: <tagName ...>content</tagName>
  const withContent = new RegExp(`<${tagName}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${tagName}>`, "i");
  const m = withContent.exec(xml);
  return m ? m[1].trim() : null;
}

/**
 * Extract all element occurrences as an array of text values.
 */
function extractAll(xml: string, tagName: string): string[] {
  const re = new RegExp(`<${tagName}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${tagName}>`, "gi");
  const results: string[] = [];
  let m;
  while ((m = re.exec(xml)) !== null) results.push(m[1].trim());
  return results;
}

/**
 * Determine the primary payload element name (first child of <mos> after the
 * standard header elements).
 */
function extractPayloadType(xml: string): string | null {
  // Strip the known header elements then find the first remaining tag
  const stripped = xml
    .replace(/<\?xml[^?]*\?>/i, "")
    .replace(/<mos>/i, "")
    .replace(/<\/mos>/i, "")
    .replace(/<mosID>[^<]*<\/mosID>/i, "")
    .replace(/<ncsID>[^<]*<\/ncsID>/i, "")
    .replace(/<messageID>[^<]*<\/messageID>/i, "");
  const first = /<([a-zA-Z][a-zA-Z0-9_]*)(?:\s[^>]*)?>/.exec(stripped.trim());
  return first ? first[1] : null;
}

// ── Session factory ───────────────────────────────────────────────────────────

/**
 * Create a MOS session context.
 */
export function createMosSession({ mosID, ncsID }: { mosID: string; ncsID: string }): MosSession {
  if (!mosID || !ncsID) throw new Error("mosID and ncsID are required to create a MOS session.");

  let counter = 0;

  /** Return the next sequential message ID (1-based). */
  function nextMessageID(): number {
    counter += 1;
    return counter;
  }

  /**
   * Build envelope metadata for a new outbound message.
   * Callers combine this with a message builder from messages.js.
   */
  function wrap(): EnvelopeMetadata {
    return { mosID, ncsID, messageID: nextMessageID() };
  }

  /**
   * Parse an inbound MOS XML string into a structured object.
   *
   * Extracts:
   *   mosID, ncsID, messageID — envelope header fields
   *   type                    — payload element name (e.g. "roReq", "objList")
   *   roID, storyID, itemID   — common payload fields (null if absent)
   *   objects                 — array of <mosObj> children (for objList)
   *   raw                     — the original XML string
   */
  function unwrap(xml: string): ParsedMessage {
    if (typeof xml !== "string" || !xml.trim()) {
      return { error: "Empty or non-string XML input", raw: xml, mosID: null, ncsID: null, messageID: null, type: null, roID: null, storyID: null, itemID: null, objID: null, objSlug: null, objDur: null, objects: [] };
    }

    const parsed: ParsedMessage = {
      mosID:     extractText(xml, "mosID"),
      ncsID:     extractText(xml, "ncsID"),
      messageID: extractText(xml, "messageID"),
      type:      extractPayloadType(xml),
      roID:      extractText(xml, "roID"),
      storyID:   extractText(xml, "storyID"),
      itemID:    extractText(xml, "itemID"),
      objID:     extractText(xml, "objID"),
      objSlug:   extractText(xml, "objSlug"),
      objDur:    extractText(xml, "objDur"),
      objects:   extractAll(xml, "mosObj").map((block) => ({
        objID:   extractText(block, "objID"),
        objSlug: extractText(block, "objSlug"),
        objDur:  extractText(block, "objDur"),
      })),
      raw: xml,
    };

    // Coerce messageID to number if present
    if (parsed.messageID !== null) {
      const n = Number(parsed.messageID);
      parsed.messageID = isNaN(n) ? parsed.messageID : n;
    }

    return parsed;
  }

  return { mosID, ncsID, nextMessageID, wrap, unwrap };
}
