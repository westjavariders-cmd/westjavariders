/**
 * Turns an Admin photo into WebP before it hits Storage.
 * Videos, PDFs and the site favicon never go through here.
 */

export const WEBP_UPLOAD_QUALITY = 0.82;
export const WEBP_MAX_EDGE = 4096;

export function webpUploadName(originalName: string): string {
  const safe = originalName.replace(/[^a-zA-Z0-9._-]/g, "-");
  const base = safe.replace(/\.[^.]+$/, "").replace(/-+$/g, "") || "photo";
  return `${base.slice(-80)}.webp`;
}

export function isSvgUpload(file: File): boolean {
  return file.type === "image/svg+xml" || /\.svg$/i.test(file.name);
}

function looksLikeImage(file: File): boolean {
  if (file.type.startsWith("image/")) return true;
  return /\.(jpe?g|png|webp|gif|bmp|tiff?|heic|heif)$/i.test(file.name);
}

function canvasToWebp(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error("This photo could not be converted to WebP."));
          return;
        }
        resolve(blob);
      },
      "image/webp",
      WEBP_UPLOAD_QUALITY,
    );
  });
}

/**
 * Raster photos become WebP at quality 0.82. Existing WebP is left as-is so
 * it is not compressed twice. Oversized images are scaled so the long edge
 * is at most 4096px (still far above what the site displays).
 */
export async function prepareImageForUpload(file: File): Promise<File> {
  if (!looksLikeImage(file) || file.type.startsWith("video/")) {
    throw new Error("Use a photo.");
  }
  if (isSvgUpload(file)) {
    throw new Error("Use a JPEG, PNG or WebP photo, not an SVG.");
  }

  if (file.type === "image/webp") {
    return new File([file], webpUploadName(file.name), { type: "image/webp" });
  }

  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    throw new Error("This photo could not be read. Try JPEG, PNG or WebP.");
  }

  try {
    const scale = Math.min(1, WEBP_MAX_EDGE / Math.max(bitmap.width, bitmap.height, 1));
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("This photo could not be converted to WebP.");
    ctx.drawImage(bitmap, 0, 0, width, height);
    const blob = await canvasToWebp(canvas);
    return new File([blob], webpUploadName(file.name), { type: "image/webp" });
  } finally {
    bitmap.close();
  }
}
