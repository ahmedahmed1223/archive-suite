/**
 * session.js — MOS session abstraction.
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

// ── Tiny regex-based MOS XML parser (~40 lines) ──────────────────────────────

/**
 * Extract the text content of the first occurrence of a named element.
 * Handles self-closing tags (returns null) and regular text nodes.
 *
 * @param {string} xml
 * @param {string} tagName
 * @returns {string|null}
 */
function extractText(xml, tagName) {
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
 *
 * @param {string} xml
 * @param {string} tagName
 * @returns {string[]}
 */
function extractAll(xml, tagName) {
  const re = new RegExp(`<${tagName}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${tagName}>`, "gi");
  const results = [];
  let m;
  while ((m = re.exec(xml)) !== null) results.push(m[1].trim());
  return results;
}

/**
 * Determine the primary payload element name (first child of <mos> after the
 * standard header elements).
 *
 * @param {string} xml
 * @returns {string|null}
 */
function extractPayloadType(xml) {
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
 *
 * @param {object} opts
 * @param {string} opts.mosID - identifier of this MOS device (archive gateway)
 * @param {string} opts.ncsID - identifier of the target NRCS (ENPS / iNEWS)
 * @returns {{ mosID:string, ncsID:string, nextMessageID:()=>number,
 *             wrap:(lines:string[])=>object, unwrap:(xml:string)=>object }}
 */
export function createMosSession({ mosID, ncsID }) {
  if (!mosID || !ncsID) throw new Error("mosID and ncsID are required to create a MOS session.");

  let counter = 0;

  /** Return the next sequential message ID (1-based). */
  function nextMessageID() {
    counter += 1;
    return counter;
  }

  /**
   * Build envelope metadata for a new outbound message.
   * Callers combine this with a message builder from messages.js.
   *
   * @returns {{ mosID:string, ncsID:string, messageID:number }}
   */
  function wrap() {
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
   *
   * @param {string} xml
   * @returns {object}
   */
  function unwrap(xml) {
    if (typeof xml !== "string" || !xml.trim()) {
      return { error: "Empty or non-string XML input", raw: xml };
    }

    const parsed = {
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
