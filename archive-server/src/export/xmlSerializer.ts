/**
 * xmlSerializer.ts — tiny dependency-free XML serialiser (~50 lines).
 *
 * Escapes &, <, >, ", ' in text content and attribute values.
 * Produces well-formed, indented XML with a UTF-8 declaration.
 * No DOM, no library.
 */

/** Escape the five predefined XML entities in a string value. */
export function escapeXml(value: unknown): string {
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
 * @param name element name
 * @param value text content (empty string → self-close)
 * @param attrs attribute name/value pairs
 * @param indent current indent level (2-space)
 * @returns indented XML element string (no trailing newline)
 */
export function serializeElement(name: string, value?: string | number | null, attrs: Record<string, unknown> = {}, indent: number = 0): string {
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
 * @param rootName root element tag name
 * @param rootAttrs attributes on the root element
 * @param children pre-rendered child lines (already indented at level 1)
 * @returns complete XML document string
 */
export function serializeDocument(rootName: string, rootAttrs: Record<string, unknown>, children: (string | undefined | null)[]): string {
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
