/**
 * Image processing pipeline using Sharp.
 * Generates WebP variants + thumbnails for uploaded images.
 * Falls back gracefully if Sharp is unavailable or input is not an image.
 */
import { createRequire } from "node:module";
import { createLogger } from "../logger.js";

const log = createLogger("imageProcessor");

let sharp;
try {
  const require = createRequire(import.meta.url);
  sharp = require("sharp");
} catch {
  log.warn("Sharp not available — image processing disabled. Run: pnpm add sharp");
}

/** Variant sizes for srcset */
const VARIANTS = [
  { name: "thumb", width: 200, height: 200, fit: "cover" },
  { name: "sm",    width: 400, height: null, fit: "inside" },
  { name: "md",    width: 800, height: null, fit: "inside" },
  { name: "lg",    width: 1600, height: null, fit: "inside" },
];

/** MIME types we process */
export const PROCESSABLE_IMAGE_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/tiff",
  "image/avif",
]);

/**
 * Process an uploaded image buffer, returning WebP variants.
 * @param {Buffer} buffer - raw image data
 * @param {string} mimeType - detected MIME type
 * @returns {Promise<{ original: Buffer, variants: Array<{name, buffer, width, height, size, mimeType}>, metadata: object }>}
 */
export async function processImage(buffer, mimeType = "") {
  if (!sharp || !PROCESSABLE_IMAGE_TYPES.has(mimeType)) {
    return { original: buffer, variants: [], metadata: { width: null, height: null } };
  }

  try {
    const img = sharp(buffer).rotate(); // auto-rotate based on EXIF
    const metadata = await img.metadata();
    const { width: origWidth, height: origHeight, format } = metadata;

    const variants = await Promise.all(
      VARIANTS.map(async ({ name, width, height, fit }) => {
        // Don't upscale
        if (width && origWidth && width > origWidth) return null;

        const pipeline = img.clone().webp({ quality: 82, effort: 4 });
        if (width || height) {
          pipeline.resize(width, height, { fit, withoutEnlargement: true });
        }

        const variantBuffer = await pipeline.toBuffer();
        const variantMeta = await sharp(variantBuffer).metadata();

        return {
          name,
          buffer: variantBuffer,
          width: variantMeta.width,
          height: variantMeta.height,
          size: variantBuffer.length,
          mimeType: "image/webp",
        };
      })
    );

    return {
      original: buffer,
      variants: variants.filter(Boolean),
      metadata: {
        width: origWidth,
        height: origHeight,
        format,
        fileSize: buffer.length,
      },
    };
  } catch (err) {
    log.error({ err }, "Image processing failed — returning original");
    return { original: buffer, variants: [], metadata: {} };
  }
}

/**
 * Generate a single thumbnail Buffer (for quick preview generation).
 * @param {Buffer} buffer - raw image data
 * @param {{ width?: number, height?: number }} [options]
 * @returns {Promise<Buffer|null>}
 */
export async function generateThumbnail(buffer, { width = 200, height = 200 } = {}) {
  if (!sharp) return null;
  try {
    return await sharp(buffer)
      .rotate()
      .resize(width, height, { fit: "cover", position: "centre" })
      .webp({ quality: 70 })
      .toBuffer();
  } catch {
    return null;
  }
}

/**
 * Detect if a Buffer is an image by magic bytes.
 * @param {Buffer} buffer
 * @returns {string|null} MIME type or null
 */
export function detectImageMimeType(buffer) {
  if (!buffer || buffer.length < 12) return null;
  if (buffer[0] === 0xFF && buffer[1] === 0xD8) return "image/jpeg";
  if (buffer.slice(0, 4).toString() === "\x89PNG") return "image/png";
  if (
    buffer.slice(0, 4).toString() === "RIFF" &&
    buffer.slice(8, 12).toString() === "WEBP"
  ) return "image/webp";
  if (
    buffer.slice(0, 6).toString() === "GIF87a" ||
    buffer.slice(0, 6).toString() === "GIF89a"
  ) return "image/gif";
  return null;
}
