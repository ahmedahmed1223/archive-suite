import sanitizeHtml from "sanitize-html";

const allowedTags = [
  "section",
  "h2",
  "h3",
  "h4",
  "p",
  "ol",
  "ul",
  "li",
  "strong",
  "em",
  "code",
  "pre",
  "blockquote",
  "table",
  "thead",
  "tbody",
  "tr",
  "th",
  "td",
  "a",
  "hr",
  "br",
  "span",
] as const;

function safeLink(href: string | undefined): { href: string; external: boolean } | null {
  if (!href) return null;

  if (href.startsWith("/") && !href.startsWith("//")) {
    return { href, external: false };
  }

  try {
    const url = new URL(href);
    return url.protocol === "https:" ? { href: url.toString(), external: true } : null;
  } catch {
    return null;
  }
}

export function sanitizeGuideHtml(html: string): string {
  return sanitizeHtml(html, {
    allowedTags: [...allowedTags],
    allowedAttributes: {
      a: ["href", "rel"],
      th: ["scope", "colspan", "rowspan"],
      td: ["colspan", "rowspan"],
      code: ["class"],
    },
    allowedSchemes: ["https"],
    allowProtocolRelative: false,
    disallowedTagsMode: "discard",
    transformTags: {
      h1: "h3",
      h2: "h3",
      a: (_tagName, attributes) => {
        const link = safeLink(attributes.href);
        if (!link) return { tagName: "span", attribs: {} };

        return {
          tagName: "a",
          attribs: {
            href: link.href,
            ...(link.external ? { rel: "noreferrer" } : {}),
          },
        };
      },
    },
  });
}
