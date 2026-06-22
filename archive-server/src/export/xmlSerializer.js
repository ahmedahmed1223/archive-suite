/**
 * xmlSerializer.js — tiny dependency-free XML serialiser (~50 lines).
 *
 * Escapes &, <, >, ", ' in text content and attribute values.
 * Produces well-formed, indented XML with a UTF-8 declaration.
 * No DOM, no library.
 */

/** Escape the five predefined XML entities in a string value. */
export function escapeXml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/**
 * Serialise a single XML element.
 *
 * @param {string} name - element name
 * @param {string|number|null|undefined} value - text content (empty string → self-close)
 * @param {Record<string,string>} [attrs] - attribute name/value pairs
 * @param {number} [indent] - current indent level (2-space)
 * @returns {string} indented XML element string (no trailing newline)
 */
export function serializeElement(name, value, attrs = {}, indent = 0) {
  const pad = "  ".repeat(indent);
  const attrStr = Object.entries(attrs)
    .filter(([, v]) => v != null && v !== "")
    .map(([k, v]) => ` ${k}="${escapeXml(v)}"`)
    .join("");
  const text = value != null ? String(value) : "";
  if (text === "") {
    return `${pad}<${name}${attrStr}/>`;
  }
  return `${pad}<${name}${attrStr}>${escapeXml(text)}</${name}>`;
}

/**
 * Serialise a complete XML document with a UTF-8 declaration.
 *
 * @param {string} rootName - root element tag name
 * @param {Record<string,string>} rootAttrs - attributes on the root element
 * @param {string[]} children - pre-rendered child lines (already indented at level 1)
 * @returns {string} complete XML document string
 */
export function serializeDocument(rootName, rootAttrs, children) {
  const attrStr = Object.entries(rootAttrs)
    .filter(([, v]) => v != null && v !== "")
    .map(([k, v]) => ` ${k}="${escapeXml(v)}"`)
    .join("");
  const inner = children.filter(Boolean).join("\n");
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    `<${rootName}${attrStr}>`,
    inner,
    `</${rootName}>`,
  ].join("\n");
}
