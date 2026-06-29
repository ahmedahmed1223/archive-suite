/**
 * Image processing pipeline using Sharp.
 * Generates WebP variants + thumbnails for uploaded images.
 * Falls back gracefully if Sharp is unavailable or input is not an image.
 */
import { createRequire } from "node:module";
import { createLogger } from "../logger.js";

const log = createLogger("imageProcessor");

let sharp: ((buffer: Buffer) => any) | null = null;
try {
  const require = createRequire(import.meta.url);
  sharp = require("sharp");
} catch {
  log.warn("Sharp not available — image processing disabled. Run: pnpm add sharp");
}

interface ImageVariant {
  name: string;
  width: number | null;
  height: number | null;
  fit: "cover" | "inside";
}

/** Variant sizes for srcset */
const VARIANTS: ImageVariant[] = [
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

interface ProcessedImageVariant {
  name: string;
  buffer: Buffer;
  width: number | null;
  height: number | null;
  size: number;
  mimeType: string;
}

interface ProcessedImage {
  original: Buffer;
  variants: ProcessedImageVariant[];
  metadata: {
    width?: number | null;
    height?: number | null;
    format?: string;
    fileSize?: number;
  };
}

export async function processImage(buffer: Buffer, mimeType: string = ""): Promise<ProcessedImage> {
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
          width: variantMeta.width || null,
          height: variantMeta.height || null,
          size: variantBuffer.length,
          mimeType: "image/webp",
        };
      })
    );

    return {
      original: buffer,
      variants: variants.filter((v): v is ProcessedImageVariant => v !== null),
      metadata: {
        width: origWidth || null,
        height: origHeight || null,
        format,
        fileSize: buffer.length,
      },
    };
  } catch (err) {
    log.error({ err }, "Image processing failed — returning original");
    return { original: buffer, variants: [], metadata: {} };
  }
}

export async function generateThumbnail(buffer: Buffer, { width = 200, height = 200 } = {}): Promise<Buffer | null> {
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

export function detectImageMimeType(buffer: Buffer): string | null {
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
